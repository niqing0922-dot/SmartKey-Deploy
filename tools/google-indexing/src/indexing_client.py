#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Google Indexing API 客户端
处理与 Google Indexing API 的所有交互
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import json
import threading
from typing import Optional, List, Dict, Any
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from dataclasses import dataclass, field
from collections import deque

import requests
from google.oauth2 import service_account
from google.auth.transport.requests import Request

from config.config import Config
from exceptions import (
    CredentialsError,
    AuthenticationError,
    APIRequestError,
    RateLimitError,
    PermissionDeniedError,
    NetworkError,
    TimeoutError,
    MaxRetriesExceededError
)
from logger import get_logger, log_api_response


@dataclass
class SubmissionResult:
    """提交结果"""

    url: str
    success: bool
    status_code: int
    status_message: str
    response_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    retry_count: int = 0
    timestamp: str = field(default_factory=lambda: time.strftime('%Y-%m-%dT%H:%M:%S'))


class IndexingClient:
    """Google Indexing API 客户端"""

    def __init__(self, config: Config, logger=None):
        """
        初始化客户端

        Args:
            config: 配置对象
            logger: 日志记录器
        """
        self.config = config
        self.logger = logger or get_logger()
        self.credentials = None
        self._session: Optional[requests.Session] = None
        self._direct_session: Optional[requests.Session] = None
        self._request_rate_limiter = RequestRateLimiter(
            max_requests=config.max_workers * 2,
            time_window=1.0
        )

    @property
    def session(self) -> requests.Session:
        """获取或创建请求会话"""
        if self._session is None:
            self._session = requests.Session()
            proxies = self.config.get_proxies()
            if proxies:
                self._session.proxies.update(proxies)
            self.logger.debug(f"会话已创建,代理: {proxies}")
        return self._session

    def test_credentials(self) -> bool:
        """
        测试并加载凭证

        Returns:
            凭证是否有效

        Raises:
            CredentialsError: 凭证文件不存在或无效
            AuthenticationError: 认证失败
        """
        key_file = Path(self.config.key_file)

        if not key_file.exists():
            raise CredentialsError(f"找不到密钥文件: {self.config.key_file}")

        try:
            self.logger.info("正在加载服务账号凭证...")
            self.credentials = service_account.Credentials.from_service_account_file(
                self.config.key_file,
                scopes=self.config.api_scopes
            )
            self.logger.info("凭证加载成功")

            self.logger.info("正在获取访问令牌...")
            self._refresh_token_with_fallback()

            self.logger.info("成功获取访问令牌")
            self.logger.debug(f"令牌前缀: {self.credentials.token[:20]}...")

            return True

        except Exception as e:
            raise AuthenticationError(f"凭证验证失败: {e}")

    def _refresh_token_with_fallback(self) -> None:
        """
        刷新访问令牌。
        在 Windows + 本地代理环境下，代理可能会导致 TLS/连接被重置(10054)。
        这里会先用当前 session(可能带代理)刷新，失败时自动用直连 session 再试一次。
        """
        if not self.credentials:
            raise AuthenticationError("未加载有效的凭证")

        proxies = self.config.get_proxies()

        try:
            request = Request(session=self.session)
            self.credentials.refresh(request)
            return
        except Exception as first_error:
            # 若未使用代理，则直接抛出
            if not proxies:
                raise first_error

            # 使用直连 session 重试一次（复用已创建的 session）
            self.logger.warning(
                "获取令牌时疑似代理/网络导致连接中断，尝试直连方式重试一次..."
            )
            if self._direct_session is None:
                self._direct_session = requests.Session()
            request = Request(session=self._direct_session)
            self.credentials.refresh(request)

    def submit_single_url(
        self,
        url: str,
        submission_type: Optional[str] = None
    ) -> SubmissionResult:
        """
        提交单个 URL

        Args:
            url: 要提交的 URL
            submission_type: 提交类型 (URL_UPDATED 或 URL_DELETED)

        Returns:
            提交结果
        """
        if not self.credentials or not self.credentials.token:
            raise AuthenticationError("未加载有效的凭证")

        # 如令牌已过期，尝试刷新（带代理失败则直连重试）
        try:
            if getattr(self.credentials, "expired", False):
                self.logger.info("访问令牌已过期，正在刷新...")
                self._refresh_token_with_fallback()
        except Exception as e:
            raise AuthenticationError(f"刷新访问令牌失败: {e}")

        submission_type = submission_type or self.config.submission_type

        headers = {
            'Authorization': f'Bearer {self.credentials.token}',
            'Content-Type': 'application/json'
        }

        data = {
            "url": url,
            "type": submission_type
        }

        # 应用速率限制
        self._request_rate_limiter.acquire()

        try:
            response = self.session.post(
                self.config.api_endpoint,
                headers=headers,
                data=json.dumps(data),
                timeout=self.config.request_timeout
            )

            # 处理响应
            return self._handle_response(url, response)

        except requests.exceptions.Timeout:
            return SubmissionResult(
                url=url,
                success=False,
                status_code=0,
                status_message="请求超时",
                error="timeout"
            )

        except requests.exceptions.ConnectionError as e:
            return SubmissionResult(
                url=url,
                success=False,
                status_code=0,
                status_message="网络错误",
                error=str(e)
            )

        except requests.exceptions.RequestException as e:
            return SubmissionResult(
                url=url,
                success=False,
                status_code=0,
                status_message="请求异常",
                error=str(e)
            )

    def _handle_response(self, url: str, response: requests.Response) -> SubmissionResult:
        """
        处理 API 响应

        Args:
            url: 请求的 URL
            response: HTTP 响应

        Returns:
            提交结果
        """
        status_code = response.status_code

        if status_code == 200:
            try:
                response_data = response.json()
                return SubmissionResult(
                    url=url,
                    success=True,
                    status_code=200,
                    status_message="成功",
                    response_data=response_data
                )
            except json.JSONDecodeError:
                return SubmissionResult(
                    url=url,
                    success=True,
                    status_code=200,
                    status_message="成功"
                )

        elif status_code == 403:
            return SubmissionResult(
                url=url,
                success=False,
                status_code=403,
                status_message="权限被拒绝",
                error="权限被拒绝,请检查 Search Console 配置"
            )

        elif status_code == 401:
            return SubmissionResult(
                url=url,
                success=False,
                status_code=401,
                status_message="认证失败",
                error="访问令牌无效或已过期"
            )

        elif status_code == 429:
            return SubmissionResult(
                url=url,
                success=False,
                status_code=429,
                status_message="请求过多",
                error="API 请求过多,请增加延迟时间"
            )

        elif status_code == 400:
            return SubmissionResult(
                url=url,
                success=False,
                status_code=400,
                status_message="请求错误",
                error=response.text[:200]
            )

        else:
            return SubmissionResult(
                url=url,
                success=False,
                status_code=status_code,
                status_message=f"HTTP {status_code}",
                error=response.text[:200]
            )

    def submit_urls_with_retry(
        self,
        url: str,
        max_retries: Optional[int] = None
    ) -> SubmissionResult:
        """
        提交 URL 并在失败时重试

        Args:
            url: 要提交的 URL
            max_retries: 最大重试次数 (默认使用配置中的值)

        Returns:
            提交结果
        """
        max_retries = max_retries or self.config.max_retries
        result = None

        for attempt in range(max_retries + 1):
            result = self.submit_single_url(url)
            result.retry_count = attempt

            if result.success:
                return result

            # 对于某些错误,不重试
            if result.status_code in [400, 401, 403]:
                return result

            # 对于 429 错误,使用更温和且可配置的等待时间
            if result.status_code == 429:
                # 至少等待一个批次间隔,再按尝试次数线性增加
                base = max(self.config.delay_between_batches, 10.0)
                wait_time = base * (attempt + 1)
                self.logger.warning(f"遇到速率限制,等待 {wait_time:.1f} 秒后重试...")
                time.sleep(wait_time)
            elif attempt < max_retries:
                wait_time = max(self.config.delay_between_requests, 1.0) * (attempt + 1)
                self.logger.warning(
                    f"重试 {attempt}/{max_retries} {url}: "
                    f"{result.status_message}, 等待 {wait_time:.1f} 秒"
                )
                time.sleep(wait_time)

        return result

    def submit_urls_concurrent(
        self,
        urls: List[str],
        batch_size: Optional[int] = None
    ) -> List[SubmissionResult]:
        """
        并发提交多个 URL

        Args:
            urls: URL 列表
            batch_size: 每批处理的数量 (默认使用配置中的值)

        Returns:
            提交结果列表
        """
        batch_size = batch_size or self.config.batch_size
        all_results = []
        total = len(urls)

        self.logger.info(f"开始并发提交 {total} 个 URL")
        self.logger.info(f"最大并发数: {self.config.max_workers}")
        self.logger.info(f"批次大小: {batch_size}")

        for i in range(0, total, batch_size):
            batch = urls[i:i + batch_size]
            batch_num = (i // batch_size) + 1
            total_batches = (total + batch_size - 1) // batch_size

            self.logger.info(
                f"\n处理批次 {batch_num}/{total_batches} "
                f"(URL {i+1}-{min(i+batch_size, total)}/{total})"
            )

            # 使用线程池并发处理
            with ThreadPoolExecutor(max_workers=self.config.max_workers) as executor:
                future_to_url = {
                    executor.submit(self.submit_urls_with_retry, url): url
                    for url in batch
                }

                batch_results = []
                for future in as_completed(future_to_url):
                    result = future.result()
                    batch_results.append(result)

                    # 记录结果
                    if result.success:
                        self.logger.info(f"  OK {result.url}")
                    else:
                        self.logger.warning(f"  FAIL {result.url} - {result.status_message}")

                all_results.extend(batch_results)

            # 批次间延迟
            if i + batch_size < total:
                self.logger.info(
                    f"批次 {batch_num}/{total_batches} 完成, "
                    f"暂停 {self.config.delay_between_batches} 秒...\n"
                )
                time.sleep(self.config.delay_between_batches)

        return all_results

    def close(self):
        """关闭会话"""
        if self._session:
            self._session.close()
            self._session = None
        if self._direct_session:
            self._direct_session.close()
            self._direct_session = None


class RequestRateLimiter:
    """请求速率限制器（使用 deque 实现滑动窗口）"""

    def __init__(self, max_requests: int, time_window: float = 1.0):
        """
        初始化速率限制器

        Args:
            max_requests: 时间窗口内的最大请求数
            time_window: 时间窗口(秒)
        """
        self.max_requests = max_requests
        self.time_window = time_window
        self._requests: deque = deque()
        self._lock = threading.Lock()

    def acquire(self, timeout: Optional[float] = None):
        """
        获取请求许可

        Args:
            timeout: 超时时间 (None 表示无限等待)
        """
        deadline = time.time() + timeout if timeout is not None else None

        while True:
            with self._lock:
                now = time.time()
                # 移除时间窗口外的旧请求 O(1) 操作
                while self._requests and now - self._requests[0] >= self.time_window:
                    self._requests.popleft()

                if len(self._requests) < self.max_requests:
                    self._requests.append(now)
                    return

                # 计算等待时间
                sleep_time = self.time_window - (now - self._requests[0])

            if deadline is not None and now + sleep_time > deadline:
                raise TimeoutError("获取请求许可超时")

            time.sleep(sleep_time)
