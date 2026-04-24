#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工具函数模块
提供 URL 验证、文件处理等辅助函数
"""

import re
import csv
import json
from pathlib import Path
from typing import Optional, Set, List
from datetime import datetime

import pandas as pd

from exceptions import (
    FileNotFoundError,
    InvalidURLError,
    DuplicateURLError,
    EmptyCSVError,
    ColumnNotFoundError,
    CSVReadError
)


def is_valid_url(url: str, allowed_schemes: Optional[List[str]] = None) -> bool:
    """
    验证 URL 格式

    Args:
        url: 要验证的 URL
        allowed_schemes: 允许的协议列表 (默认: ['http', 'https'])

    Returns:
        URL 是否有效
    """
    if not url or not isinstance(url, str):
        return False

    url = url.strip()

    if allowed_schemes is None:
        allowed_schemes = ['http', 'https']

    # 基本格式验证
    url_pattern = re.compile(
        r'^(?:' + '|'.join(allowed_schemes) + r')://'  # 协议
        r'(?:\S+(?::\S*)?@)?'  # 用户认证 (可选)
        r'(?:'  # IP 或域名
        r'(?P<private_ip>'
        r'10(?:\.\d{1,3}){3}|'  # 10.0.0.0/8
        r'127(?:\.\d{1,3}){3}|'  # 127.0.0.0/8
        r'169\.254(?:\.\d{1,3}){2}|'  # 169.254.0.0/16
        r'192\.168(?:\.\d{1,3}){2}|'  # 192.168.0.0/16
        r'172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}'  # 172.16.0.0/12
        r')|'
        r'(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])'  # 公网 IP
        r'(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){3}'
        r'|'
        r'(?:(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)'  # 域名
        r'(?:\.(?:[a-z\u00a1-\uffff0-9]-*)*[a-z\u00a1-\uffff0-9]+)*'
        r'(?:\.(?:[a-z\u00a1-\uffff]{2,}))'  # 顶级域名
        r')'
        r'(?::\d{2,5})?'  # 端口 (可选)
        r'(?:[/?#]\S*)?$'  # 路径、查询、片段 (可选)
        , re.IGNORECASE
    )

    return bool(url_pattern.match(url))


def validate_urls(urls: List[str], allow_duplicates: bool = True) -> List[str]:
    """
    验证 URL 列表

    Args:
        urls: URL 列表
        allow_duplicates: 是否允许重复 URL

    Returns:
        验证后的有效 URL 列表

    Raises:
        InvalidURLError: 包含无效 URL 时
        DuplicateURLError: 包含重复 URL 且 allow_duplicates=False 时
    """
    if not urls:
        raise InvalidURLError("URL 列表为空")

    valid_urls = []
    seen_urls: Set[str] = set()

    for url in urls:
        url = url.strip()

        if not url:
            continue

        if not is_valid_url(url):
            raise InvalidURLError(f"无效的 URL: {url}")

        # 检查重复
        if url in seen_urls:
            if not allow_duplicates:
                raise DuplicateURLError(f"发现重复 URL: {url}")
            continue

        seen_urls.add(url)
        valid_urls.append(url)

    return valid_urls


def read_urls_from_csv(
    csv_file: str,
    url_column: str = 'URL',
    skip_invalid: bool = False,
    remove_duplicates: bool = True
) -> List[str]:
    """
    从 CSV 文件读取 URL

    Args:
        csv_file: CSV 文件路径
        url_column: URL 所在的列名
        skip_invalid: 是否跳过无效 URL
        remove_duplicates: 是否去除重复 URL

    Returns:
        URL 列表

    Raises:
        FileNotFoundError: 文件不存在
        EmptyCSVError: CSV 文件为空
        ColumnNotFoundError: 指定的列不存在
    """
    file_path = Path(csv_file)

    if not file_path.exists():
        raise FileNotFoundError(f"找不到文件: {csv_file}")

    urls = []

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)

            if not reader.fieldnames:
                raise EmptyCSVError("CSV 文件没有列头")

            # 处理可能存在的 BOM 和前后空白
            normalized_fieldnames = [
                (name.lstrip('\ufeff').strip() if isinstance(name, str) else name)
                for name in reader.fieldnames
            ]

            # 如果标准化后列名发生变化，更新 reader 的 fieldnames
            if normalized_fieldnames != reader.fieldnames:
                reader.fieldnames = normalized_fieldnames

            # 优先使用指定列名，其次自动检测 URL 列
            target_column = url_column
            if target_column not in reader.fieldnames:
                # 只有一列时，自动认为这一列是 URL
                if len(reader.fieldnames) == 1:
                    target_column = reader.fieldnames[0]
                else:
                    # 常见 URL 列名的变体
                    lower_map = {name.lower(): name for name in reader.fieldnames if isinstance(name, str)}
                    for cand in ("url", "urls", "link", "links", "page", "page url"):
                        if cand in lower_map:
                            target_column = lower_map[cand]
                            break

            if target_column not in reader.fieldnames:
                raise ColumnNotFoundError(url_column, list(reader.fieldnames))

            for row in reader:
                url = row[target_column].strip()
                if url:
                    urls.append(url)

        if not urls:
            raise EmptyCSVError(f"CSV 文件 '{csv_file}' 中没有找到 URL")

    except Exception as e:
        if isinstance(e, (FileNotFoundError, EmptyCSVError, ColumnNotFoundError)):
            raise
        raise CSVReadError(f"读取 CSV 文件失败: {e}")

    # 验证和处理 URL
    try:
        return validate_urls(urls, allow_duplicates=not remove_duplicates)
    except InvalidURLError as e:
        if skip_invalid:
            # 只返回有效的 URL
            valid_urls = [url for url in urls if is_valid_url(url)]
            if not valid_urls:
                raise EmptyCSVError("没有有效的 URL")
            return list(dict.fromkeys(valid_urls)) if remove_duplicates else valid_urls
        raise


def read_urls_from_excel(
    excel_file: str,
    url_column: str = 'URL',
    skip_invalid: bool = False,
    remove_duplicates: bool = True
) -> List[str]:
    """
    从 Excel 文件读取 URL

    Args:
        excel_file: Excel 文件路径
        url_column: URL 所在的列名
        skip_invalid: 是否跳过无效 URL
        remove_duplicates: 是否去除重复 URL

    Returns:
        URL 列表
    """
    file_path = Path(excel_file)

    if not file_path.exists():
        raise FileNotFoundError(f"找不到文件: {excel_file}")

    try:
        df = pd.read_excel(file_path)
    except Exception as e:
        raise CSVReadError(f"读取 Excel 文件失败: {e}")

    if df.empty:
        raise EmptyCSVError(f"Excel 文件 '{excel_file}' 内容为空")

    if url_column not in df.columns:
        raise ColumnNotFoundError(url_column, list(df.columns))

    urls = [
        str(value).strip()
        for value in df[url_column].dropna().tolist()
        if str(value).strip()
    ]

    if not urls:
        raise EmptyCSVError(f"Excel 文件 '{excel_file}' 中没有找到 URL")

    # 验证和处理 URL
    try:
        return validate_urls(urls, allow_duplicates=not remove_duplicates)
    except InvalidURLError:
        if skip_invalid:
            valid_urls = [url for url in urls if is_valid_url(url)]
            if not valid_urls:
                raise EmptyCSVError("没有有效的 URL")
            return list(dict.fromkeys(valid_urls)) if remove_duplicates else valid_urls
        raise


def read_urls_from_text_file(
    file_path: str,
    skip_invalid: bool = False,
    remove_duplicates: bool = True
) -> List[str]:
    """
    从文本文件读取 URL (每行一个)

    Args:
        file_path: 文件路径
        skip_invalid: 是否跳过无效 URL
        remove_duplicates: 是否去除重复 URL

    Returns:
        URL 列表
    """
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"找不到文件: {file_path}")

    urls = []

    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            url = line.strip()
            if url and not url.startswith('#'):  # 跳过注释和空行
                urls.append(url)

    if not urls:
        raise EmptyCSVError(f"文件 '{file_path}' 中没有找到 URL")

    # 验证和处理 URL
    try:
        return validate_urls(urls, allow_duplicates=not remove_duplicates)
    except InvalidURLError as e:
        if skip_invalid:
            valid_urls = [url for url in urls if is_valid_url(url)]
            if not valid_urls:
                raise EmptyCSVError("没有有效的 URL")
            return list(dict.fromkeys(valid_urls)) if remove_duplicates else valid_urls
        raise


def normalize_url(url: str) -> str:
    """
    标准化 URL (去除尾部斜杠,转换为小写协议等)

    Args:
        url: 要标准化的 URL

    Returns:
        标准化后的 URL
    """
    url = url.strip()

    # 移除尾部斜杠 (保留根路径的斜杠)
    if len(url) > 1 and url.endswith('/'):
        url = url[:-1]

    return url


def get_domain(url: str) -> Optional[str]:
    """
    从 URL 中提取域名

    Args:
        url: URL

    Returns:
        域名 (如果 URL 有效)
    """
    if not is_valid_url(url):
        return None

    from urllib.parse import urlparse
    parsed = urlparse(url)
    return parsed.netloc


def ensure_dir(path: str) -> Path:
    """
    确保目录存在,不存在则创建

    Args:
        path: 目录路径

    Returns:
        Path 对象
    """
    dir_path = Path(path)
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def save_results_to_csv(results: List[dict], file_path: str) -> None:
    """
    保存结果到 CSV 文件

    Args:
        results: 结果列表
        file_path: 文件路径
    """
    if not results:
        return

    file_path_obj = Path(file_path)
    ensure_dir(file_path_obj.parent)

    with open(file_path, 'w', newline='', encoding='utf-8') as f:
        fieldnames = list(results[0].keys())
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for result in results:
            writer.writerow(result)


def save_urls_to_file(urls: List[str], file_path: str) -> None:
    """
    保存 URL 列表到文本文件

    Args:
        urls: URL 列表
        file_path: 文件路径
    """
    if not urls:
        return

    file_path_obj = Path(file_path)
    ensure_dir(file_path_obj.parent)

    with open(file_path, 'w', encoding='utf-8') as f:
        for url in urls:
            f.write(url + '\n')


def generate_timestamp() -> str:
    """
    生成时间戳字符串

    Returns:
        格式为 YYYYMMDD_HHMMSS 的时间戳
    """
    return datetime.now().strftime('%Y%m%d_%H%M%S')


def retry_with_backoff(
    func,
    max_retries: int = 3,
    backoff_factor: float = 2.0,
    exceptions: tuple = (Exception,),
    logger=None
):
    """
    带指数退避的重试装饰器

    Args:
        func: 要重试的函数
        max_retries: 最大重试次数
        backoff_factor: 退避因子
        exceptions: 要捕获的异常类型
        logger: 日志记录器

    Returns:
        函数包装器
    """
    import time

    def wrapper(*args, **kwargs):
        retry_count = 0
        last_exception = None

        while retry_count < max_retries:
            try:
                return func(*args, **kwargs)
            except exceptions as e:
                retry_count += 1
                last_exception = e

                if retry_count < max_retries:
                    wait_time = backoff_factor ** retry_count
                    if logger:
                        logger.warning(
                            f"重试 {retry_count}/{max_retries}: "
                            f"{str(e)}, 等待 {wait_time:.1f} 秒"
                        )
                    time.sleep(wait_time)
                else:
                    if logger:
                        logger.error(f"达到最大重试次数 ({max_retries})")
                    raise

        raise last_exception

    return wrapper


def truncate_response(response_text: str, max_length: int = 200) -> str:
    """
    截断响应文本

    Args:
        response_text: 响应文本
        max_length: 最大长度

    Returns:
        截断后的文本
    """
    if not response_text:
        return ""
    if len(response_text) <= max_length:
        return response_text
    return response_text[:max_length] + "..."
