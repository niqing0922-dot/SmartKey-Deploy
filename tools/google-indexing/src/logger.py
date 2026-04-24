#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
日志配置模块
提供统一的日志接口,支持控制台和文件输出
"""

import logging
import sys
from pathlib import Path
from typing import Optional
from datetime import datetime


class ColoredFormatter(logging.Formatter):
    """彩色日志格式化器"""

    # ANSI 颜色代码
    COLORS = {
        'DEBUG': '\033[36m',    # 青色
        'INFO': '\033[32m',     # 绿色
        'WARNING': '\033[33m',  # 黄色
        'ERROR': '\033[31m',    # 红色
        'CRITICAL': '\033[35m', # 紫色
    }
    RESET = '\033[0m'

    def format(self, record):
        # 添加颜色
        if record.levelname in self.COLORS:
            record.levelname = (
                f"{self.COLORS[record.levelname]}{record.levelname}{self.RESET}"
            )
        return super().format(record)


def setup_logger(
    name: str = "google_indexing",
    level: str = "INFO",
    log_file: Optional[str] = None,
    log_dir: str = "logs"
) -> logging.Logger:
    """
    设置并返回配置好的日志记录器

    Args:
        name: 日志记录器名称
        level: 日志级别 (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: 日志文件路径 (可选)
        log_dir: 日志目录 (当 log_file 为相对路径时使用)

    Returns:
        配置好的日志记录器
    """
    # 创建日志记录器
    logger = logging.getLogger(name)
    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # 避免重复添加处理器
    if logger.handlers:
        return logger

    # 格式化器
    console_format = ColoredFormatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    file_format = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(funcName)s:%(lineno)d - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # 控制台处理器
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(getattr(logging, level.upper(), logging.INFO))
    console_handler.setFormatter(console_format)
    logger.addHandler(console_handler)

    # 文件处理器
    if log_file:
        log_path = Path(log_file)
        # 如果是相对路径,使用 log_dir
        if not log_path.is_absolute():
            Path(log_dir).mkdir(parents=True, exist_ok=True)
            log_path = Path(log_dir) / log_path
        else:
            log_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_path, encoding='utf-8')
        file_handler.setLevel(logging.DEBUG)  # 文件记录所有级别
        file_handler.setFormatter(file_format)
        logger.addHandler(file_handler)

    return logger


def get_logger(name: str = "google_indexing") -> logging.Logger:
    """
    获取日志记录器实例

    Args:
        name: 日志记录器名称

    Returns:
        日志记录器实例
    """
    return logging.getLogger(name)


def print_section(title: str, char: str = "=") -> None:
    """
    打印分节标题

    Args:
        title: 标题文本
        char: 分隔线字符
    """
    line = char * 70
    print(f"\n{line}")
    print(f"  {title}")
    print(f"{line}\n")


def print_summary(
    title: str,
    items: list[str],
    max_items: int = 10
) -> None:
    """
    打印摘要信息

    Args:
        title: 摘要标题
        items: 项目列表
        max_items: 最多显示的项目数
    """
    print(f"{title}: {len(items)} 个")
    if items:
        for item in items[:max_items]:
            print(f"  - {item}")
        if len(items) > max_items:
            print(f"  ... 还有 {len(items) - max_items} 个")


def print_progress(
    current: int,
    total: int,
    prefix: str = "",
    suffix: str = "",
    bar_length: int = 50
) -> None:
    """
    打印进度条

    Args:
        current: 当前进度
        total: 总数
        prefix: 前缀文本
        suffix: 后缀文本
        bar_length: 进度条长度
    """
    if total == 0:
        return

    percent = min(100, (current / total) * 100)
    filled_length = int(bar_length * current // total)
    bar = '█' * filled_length + '-' * (bar_length - filled_length)

    print(f'\r{prefix} |{bar}| {percent:.1f}% {suffix}', end='', flush=True)

    if current >= total:
        print()  # 完成后换行


class ProgressTracker:
    """进度跟踪器"""

    def __init__(self, total: int, description: str = "进度"):
        self.total = total
        self.description = description
        self.current = 0
        self.start_time = datetime.now()

    def update(self, increment: int = 1) -> None:
        """更新进度"""
        self.current += increment
        self._print()

    def _print(self) -> None:
        """打印当前进度"""
        if self.total == 0:
            return

        percent = (self.current / self.total) * 100
        elapsed = (datetime.now() - self.start_time).total_seconds()
        rate = self.current / elapsed if elapsed > 0 else 0
        eta = (self.total - self.current) / rate if rate > 0 else 0

        print(
            f"\r{self.description}: {self.current}/{self.total} "
            f"({percent:.1f}%) | "
            f"速度: {rate:.1f}/s | "
            f"剩余: {eta:.0f}s",
            end='',
            flush=True
        )

    def finish(self) -> None:
        """完成进度"""
        self.current = self.total
        elapsed = (datetime.now() - self.start_time).total_seconds()
        print(f"\r{self.description}: {self.current}/{self.total} 完成 "
              f"(耗时 {elapsed:.1f}s)")


def log_api_response(
    logger: logging.Logger,
    status_code: int,
    url: str,
    response_text: Optional[str] = None,
    success: bool = True
) -> None:
    """
    记录 API 响应

    Args:
        logger: 日志记录器
        status_code: HTTP 状态码
        url: 请求 URL
        response_text: 响应文本
        success: 是否成功
    """
    if success:
        logger.info(f"✅ {url} - 成功 ({status_code})")
    else:
        logger.error(f"❌ {url} - 失败 ({status_code})")
        if response_text:
            logger.debug(f"   响应: {response_text[:200]}")


def log_batch_progress(
    logger: logging.Logger,
    batch_num: int,
    total_batches: int,
    batch_size: int
) -> None:
    """
    记录批次进度

    Args:
        logger: 日志记录器
        batch_num: 当前批次号
        total_batches: 总批次数
        batch_size: 批次大小
    """
    progress = (batch_num / total_batches) * 100
    logger.info(f"批次进度: {batch_num}/{total_batches} ({progress:.1f}%) - "
                f"每批 {batch_size} 个 URL")


def log_statistics(
    logger: logging.Logger,
    total: int,
    success: int,
    failed: int,
    elapsed: float = 0
) -> None:
    """
    记录统计信息

    Args:
        logger: 日志记录器
        total: 总数
        success: 成功数
        failed: 失败数
        elapsed: 耗时(秒)
    """
    print_section("提交完成统计")

    logger.info(f"总计: {total} 个")
    logger.info(f"✅ 成功: {success} 个 ({success/total*100:.1f}%)" if total > 0 else "✅ 成功: 0 个")
    logger.info(f"❌ 失败: {failed} 个 ({failed/total*100:.1f}%)" if total > 0 else "❌ 失败: 0 个")

    if elapsed > 0:
        rate = total / elapsed
        logger.info(f"平均速度: {rate:.2f} URL/秒")
        logger.info(f"总耗时: {elapsed:.1f} 秒")
