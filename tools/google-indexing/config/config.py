#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
配置管理模块
支持命令行参数、环境变量和默认配置
"""

import os
import argparse
from dataclasses import dataclass, field
from typing import Optional
from pathlib import Path


@dataclass
class Config:
    """应用配置类"""

    # 文件路径配置
    key_file: str = "config/service_account.json"
    csv_file: str = "data/waveteliot_indexing_urls.xlsx"
    url_column: str = "URL"

    # 代理配置
    use_proxy: bool = True
    proxy_host: str = "127.0.0.1"
    proxy_port: int = 7890

    # 提交配置（单条提交：每次 1 个 URL，间隔 60 秒）
    batch_size: int = 1
    delay_between_batches: float = 60.0
    delay_between_requests: float = 0.0

    # API 配置
    api_endpoint: str = "https://indexing.googleapis.com/v3/urlNotifications:publish"
    api_scopes: list[str] = field(default_factory=lambda: ["https://www.googleapis.com/auth/indexing"])
    request_timeout: int = 30
    max_retries: int = 3
    retry_backoff_factor: float = 2.0

    # 并发配置（单线程，确保一次只提交一个）
    max_workers: int = 1

    # 提交类型
    submission_type: str = "URL_UPDATED"  # URL_UPDATED 或 URL_DELETED

    # 日志配置
    log_level: str = "INFO"
    log_file: Optional[str] = None

    # 输出配置
    output_dir: str = "results"
    no_confirm: bool = False
    show_progress: bool = True

    # 恢复配置
    resume_from_failed: bool = False

    @classmethod
    def from_args(cls, args: argparse.Namespace) -> "Config":
        """从命令行参数创建配置"""
        config = cls()

        for key, value in vars(args).items():
            if value is not None and hasattr(config, key):
                setattr(config, key, value)

        return config

    @classmethod
    def from_env(cls) -> "Config":
        """从环境变量创建配置"""
        config = cls()

        env_mappings = {
            "GOOGLE_KEY_FILE": "key_file",
            "CSV_FILE": "csv_file",
            "URL_COLUMN": "url_column",
            "USE_PROXY": "use_proxy",
            "PROXY_HOST": "proxy_host",
            "PROXY_PORT": "proxy_port",
            "BATCH_SIZE": "batch_size",
            "DELAY_BATCHES": "delay_between_batches",
            "DELAY_REQUESTS": "delay_between_requests",
            "MAX_RETRIES": "max_retries",
            "MAX_WORKERS": "max_workers",
            "SUBMISSION_TYPE": "submission_type",
            "LOG_LEVEL": "log_level",
            "LOG_FILE": "log_file",
            "OUTPUT_DIR": "output_dir",
            "NO_CONFIRM": "no_confirm",
            "RESUME_FROM_FAILED": "resume_from_failed",
        }

        for env_key, config_key in env_mappings.items():
            env_value = os.getenv(env_key)
            if env_value is not None:
                # 类型转换
                if config_key in ["use_proxy", "no_confirm", "resume_from_failed", "show_progress"]:
                    value = env_value.lower() in ("true", "1", "yes", "y")
                elif config_key in ["batch_size", "proxy_port", "request_timeout", "max_retries", "max_workers"]:
                    value = int(env_value)
                elif config_key in ["delay_between_batches", "delay_between_requests", "retry_backoff_factor"]:
                    value = float(env_value)
                else:
                    value = env_value
                setattr(config, config_key, value)

        return config

    def validate(self) -> bool:
        """验证配置是否有效"""
        errors = []

        # 检查文件路径
        if not Path(self.key_file).exists():
            errors.append(f"密钥文件不存在: {self.key_file}")

        if not Path(self.csv_file).exists():
            errors.append(f"CSV 文件不存在: {self.csv_file}")

        # 检查配置值
        if self.batch_size <= 0:
            errors.append("batch_size 必须大于 0")

        if self.delay_between_batches < 0:
            errors.append("delay_between_batches 不能为负数")

        if self.delay_between_requests < 0:
            errors.append("delay_between_requests 不能为负数")

        if self.max_workers <= 0:
            errors.append("max_workers 必须大于 0")

        if self.submission_type not in ["URL_UPDATED", "URL_DELETED"]:
            errors.append(f"submission_type 必须是 'URL_UPDATED' 或 'URL_DELETED'")

        if self.log_level not in ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]:
            errors.append(f"log_level 必须是 DEBUG, INFO, WARNING, ERROR 或 CRITICAL")

        # 检查代理配置
        if self.use_proxy:
            if not self.proxy_host:
                errors.append("use_proxy=True 时必须设置 proxy_host")

            if self.proxy_port <= 0 or self.proxy_port > 65535:
                errors.append("proxy_port 必须在 1-65535 范围内")

        if errors:
            for error in errors:
                print(f"[CONFIG ERROR] {error}")
            return False

        return True

    def get_proxy_url(self) -> Optional[str]:
        """获取代理 URL"""
        if self.use_proxy:
            return f"http://{self.proxy_host}:{self.proxy_port}"
        return None

    def get_proxies(self) -> Optional[dict[str, str]]:
        """获取代理配置字典"""
        proxy_url = self.get_proxy_url()
        if proxy_url:
            return {"http": proxy_url, "https": proxy_url}
        return None


def parse_args() -> argparse.Namespace:
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description="批量提交 CSV 中的 URL 到 Google Indexing API",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s --csv-file my_urls.csv
  %(prog)s --csv-file my_urls.csv --batch-size 20 --no-confirm
  %(prog)s --resume --csv-file failed_urls_20240101_120000.txt
  %(prog)s --submission-type URL_DELETED --no-confirm
        """
    )

    # 文件路径
    file_group = parser.add_argument_group("文件路径")
    file_group.add_argument(
        "--key-file",
        help="Google 服务账号密钥文件路径 (默认: service_account.json)"
    )
    file_group.add_argument(
        "--csv-file",
        help="CSV 文件路径 (默认: Table.csv)"
    )
    file_group.add_argument(
        "--url-column",
        help="CSV 文件中 URL 所在的列名 (默认: URL)"
    )

    # 代理配置
    proxy_group = parser.add_argument_group("代理配置")
    proxy_group.add_argument(
        "--use-proxy",
        type=lambda x: x.lower() in ("true", "1", "yes", "y"),
        help="是否使用代理 (默认: True)"
    )
    proxy_group.add_argument(
        "--proxy-host",
        help="代理服务器地址 (默认: 127.0.0.1)"
    )
    proxy_group.add_argument(
        "--proxy-port",
        type=int,
        help="代理服务器端口 (默认: 7890)"
    )
    proxy_group.add_argument(
        "--no-proxy",
        action="store_true",
        help="禁用代理"
    )

    # 提交配置
    submit_group = parser.add_argument_group("提交配置")
    submit_group.add_argument(
        "--batch-size",
        type=int,
        help="每批提交的 URL 数量 (默认: 10)"
    )
    submit_group.add_argument(
        "--delay-batches",
        type=float,
        help="批次间延迟秒数 (默认: 5.0)"
    )
    submit_group.add_argument(
        "--delay-requests",
        type=float,
        help="请求间延迟秒数 (默认: 1.0)"
    )

    # API 配置
    api_group = parser.add_argument_group("API 配置")
    api_group.add_argument(
        "--max-retries",
        type=int,
        help="最大重试次数 (默认: 3)"
    )
    api_group.add_argument(
        "--request-timeout",
        type=int,
        help="请求超时秒数 (默认: 30)"
    )

    # 并发配置
    concurrent_group = parser.add_argument_group("并发配置")
    concurrent_group.add_argument(
        "--max-workers",
        type=int,
        help="最大并发工作线程数 (默认: 3)"
    )

    # 提交类型
    type_group = parser.add_argument_group("提交类型")
    type_group.add_argument(
        "--submission-type",
        choices=["URL_UPDATED", "URL_DELETED"],
        help="提交类型: URL_UPDATED (更新) 或 URL_DELETED (删除)"
    )

    # 日志配置
    log_group = parser.add_argument_group("日志配置")
    log_group.add_argument(
        "--log-level",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="日志级别 (默认: INFO)"
    )
    log_group.add_argument(
        "--log-file",
        help="日志文件路径"
    )
    log_group.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="详细输出模式 (等同于 --log-level DEBUG)"
    )

    # 输出配置
    output_group = parser.add_argument_group("输出配置")
    output_group.add_argument(
        "--output-dir",
        help="输出目录 (默认: results)"
    )
    output_group.add_argument(
        "--no-confirm",
        action="store_true",
        help="跳过确认提示"
    )
    output_group.add_argument(
        "--no-progress",
        action="store_true",
        help="不显示进度条"
    )

    # 恢复配置
    recovery_group = parser.add_argument_group("恢复配置")
    recovery_group.add_argument(
        "--resume",
        action="store_true",
        help="从失败文件恢复提交 (会自动检测并读取最新的失败文件)"
    )

    args = parser.parse_args()

    # 处理快捷参数
    if args.no_proxy:
        args.use_proxy = False
    if args.verbose:
        args.log_level = "DEBUG"

    return args


def load_config() -> Config:
    """加载配置 (优先级: 命令行参数 > 环境变量 > 默认值)"""
    args = parse_args()
    config = Config.from_args(args)

    # 处理 --resume 参数
    if args.resume:
        config.resume_from_failed = True
        # 查找最新的失败文件
        failed_files = sorted(Path(".").glob("submission_failed_*.txt"), reverse=True)
        if failed_files:
            config.csv_file = str(failed_files[0])
            config.url_column = None  # 失败文件是纯文本,不需要列名

    return config
