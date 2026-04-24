#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""批量提交 CSV 中的 URL 到 Google Indexing API - Rich 简化版"""

import sys, os, signal, time, random, concurrent.futures, threading
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict
from dataclasses import dataclass, field
from collections import deque

if sys.platform == 'win32':
    os.environ['PYTHONIOENCODING'] = 'utf-8'
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from config.config import Config, load_config
from logger import setup_logger
from exceptions import GoogleIndexingException
from indexing_client import IndexingClient, SubmissionResult
from utils import (
    read_urls_from_csv, read_urls_from_text_file, save_results_to_csv,
    save_urls_to_file, generate_timestamp, read_urls_from_excel,
)

from rich.console import Console
from rich.progress import (
    Progress, SpinnerColumn, BarColumn, TaskProgressColumn,
    TimeElapsedColumn, MofNCompleteColumn, TextColumn,
)
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

console = Console()


# ── 重试策略 ────────────────────────────────────────────────────────────────
@dataclass
class RetryPolicy:
    max_retries: int = 5
    base_delay: float = 1.0
    max_delay: float = 60.0
    backoff_factor: float = 2.0
    retry_on_status: Dict[int, bool] = field(default_factory=lambda: {
        429: True, 500: True, 502: True, 503: True, 504: True,
        400: False, 403: False, 404: False,
    })

    def get_delay(self, attempt: int, status_code: Optional[int] = None) -> float:
        multiplier = 3 if status_code == 429 else 1
        delay = min(self.base_delay * (self.backoff_factor ** attempt) * multiplier, self.max_delay)
        return delay * (0.5 + random.random() * 0.5)

    def should_retry(self, attempt: int, status_code: Optional[int] = None) -> bool:
        if attempt >= self.max_retries:
            return False
        return self.retry_on_status.get(status_code, True) if status_code else True


# ── 主提交器 ────────────────────────────────────────────────────────────────
class BatchSubmitter:

    def __init__(self, config: Config):
        self.config = config
        self.logger = setup_logger("google_indexing", level=config.log_level, log_file=config.log_file)
        self.retry_policy = RetryPolicy(max_retries=config.max_retries)
        self.client: Optional[IndexingClient] = None
        self.results: List[SubmissionResult] = []
        self._interrupted = False
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)

    def _signal_handler(self, signum, frame):
        self._interrupted = True
        console.print("\n[yellow][WARN] 收到中断信号，正在保存进度...[/yellow]")
        if self.results:
            self._save_results_on_interrupt()
        sys.exit(1)

    def _save_results_on_interrupt(self):
        ts = generate_timestamp()
        Path(self.config.output_dir).mkdir(parents=True, exist_ok=True)
        data = [{'url': r.url, 'success': r.success, 'http_code': r.status_code,
                 'error': r.error or '', 'retry_count': r.retry_count, 'timestamp': r.timestamp}
                for r in self.results]
        if data:
            save_results_to_csv(data, f"{self.config.output_dir}/interrupted_{ts}.csv")

    def print_config(self):
        table = Table(title="配置信息", show_header=False, box=None, padding=(0, 2))
        table.add_column("Key", style="cyan")
        table.add_column("Value")
        for k, v in [
            ("CSV 文件",  self.config.csv_file),
            ("URL 列名",  self.config.url_column or "无 (纯文本)"),
            ("提交类型",  self.config.submission_type),
            ("最大并发",  self.config.max_workers),
            ("最大重试",  self.retry_policy.max_retries),
            ("使用代理",  "是" if self.config.use_proxy else "否"),
        ]:
            table.add_row(k, str(v))
        console.print(table)

    def load_urls(self) -> List[str]:
        console.rule("[bold]读取 URL[/bold]")
        if self.config.resume_from_failed:
            urls = read_urls_from_text_file(self.config.csv_file, skip_invalid=True, remove_duplicates=True)
        elif self.config.url_column:
            ext = Path(self.config.csv_file).suffix.lower()
            fn = read_urls_from_excel if ext in ('.xls', '.xlsx') else read_urls_from_csv
            urls = fn(self.config.csv_file, url_column=self.config.url_column,
                      skip_invalid=False, remove_duplicates=True)
        else:
            urls = read_urls_from_text_file(self.config.csv_file, skip_invalid=False, remove_duplicates=True)

        if len(urls) > 1000:
            console.print(f"[yellow][WARN] URL 数量较大 ({len(urls)} 个)，请耐心等待...[/yellow]")

        console.print(f"[green][OK][/green] 成功读取 {len(urls)} 个 URL")
        for url in urls[:3]:
            console.print(f"  {url}", style="dim")
        if len(urls) > 3:
            console.print(f"  ... 还有 {len(urls)-3} 个", style="dim")
        return urls

    def confirm_submission(self, urls: List[str]) -> bool:
        if self.config.no_confirm:
            return True
        console.print(f"\n即将提交 [bold]{len(urls)}[/bold] 个 URL（类型: {self.config.submission_type}）")
        return input("确认继续? (yes/no): ").strip().lower() in ('yes', 'y')

    def initialize_client(self):
        console.rule("[bold]验证 Google 凭证[/bold]")
        self.client = IndexingClient(self.config, self.logger)
        try:
            self.client.test_credentials()
            console.print("[green][OK][/green] 凭证验证成功")
        except Exception as e:
            console.print(f"[red][ERR][/red] 凭证验证失败: {e}")
            raise

    def _submit_with_retry(self, url: str) -> SubmissionResult:
        last_result = None
        for attempt in range(self.retry_policy.max_retries + 1):
            try:
                result = self.client.submit_single_url(url, self.config.submission_type)
                result.retry_count = attempt
                if result.success:
                    return result
                else:
                    if self.retry_policy.should_retry(attempt, result.status_code):
                        time.sleep(self.retry_policy.get_delay(attempt, result.status_code))
                    else:
                        result.retry_count = attempt
                        return result
                last_result = result
            except Exception as e:
                last_result = SubmissionResult(url=url, success=False, status_code=0,
                                               status_message=str(e), error=str(e))
                if attempt < self.retry_policy.max_retries:
                    time.sleep(self.retry_policy.get_delay(attempt))

        if last_result:
            last_result.retry_count = self.retry_policy.max_retries
        return last_result

    def submit_urls(self, urls: List[str]) -> List[SubmissionResult]:
        console.rule("[bold]批量提交 URL[/bold]")
        results = []

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            MofNCompleteColumn(),
            TaskProgressColumn(),
            TimeElapsedColumn(),
            console=console,
        ) as progress:
            task = progress.add_task("提交中...", total=len(urls))

            with concurrent.futures.ThreadPoolExecutor(max_workers=self.config.max_workers) as ex:
                futures = {ex.submit(self._submit_with_retry, url): url for url in urls}
                for future in concurrent.futures.as_completed(futures):
                    if self._interrupted:
                        break
                    result = future.result()
                    results.append(result)
                    progress.advance(task)

        # Summary
        ok   = sum(1 for r in results if r.success)
        fail = len(results) - ok
        console.print(f"\n[green]成功: {ok}[/green]  [red]失败: {fail}[/red]")

        if fail > 0:
            error_counts: Dict[str, List[str]] = {}
            for r in results:
                if not r.success:
                    key = f"HTTP {r.status_code}" if r.status_code else (r.error or "未知错误")
                    error_counts.setdefault(key, []).append(r.url)

            console.print(f"\n[red]❌ 提交失败的 URL 列表 ({fail} 个):[/red]")
            for err_type, urls_list in sorted(error_counts.items()):
                console.print(f"\n  [yellow]{err_type}[/yellow] ({len(urls_list)} 个):")
                for url in urls_list[:5]:
                    console.print(f"    - {url}", style="dim")
                if len(urls_list) > 5:
                    console.print(f"    ... 还有 {len(urls_list)-5} 个", style="dim")
        else:
            console.print("[green]✓ 所有 URL 提交成功！[/green]")

        return results

    def save_results(self, results: List[SubmissionResult]):
        console.rule("[bold]保存结果[/bold]")
        ts = generate_timestamp()
        Path(self.config.output_dir).mkdir(parents=True, exist_ok=True)

        results_file = f"{self.config.output_dir}/submission_results_{ts}.csv"
        save_results_to_csv([
            {'url': r.url, 'status': r.status_message, 'success': r.success,
             'http_code': r.status_code, 'error': r.error or '',
             'retry_count': r.retry_count, 'timestamp': r.timestamp}
            for r in results
        ], results_file)
        console.print(f"[green][OK][/green] 详细结果: {results_file}")

        success_urls = [r.url for r in results if r.success]
        failed_urls  = [r.url for r in results if not r.success]

        if success_urls:
            f = f"{self.config.output_dir}/success_{ts}.txt"
            save_urls_to_file(success_urls, f)
            console.print(f"[green][OK][/green] 成功列表: {f} ({len(success_urls)} 个)")

        if failed_urls:
            f = f"{self.config.output_dir}/failed_{ts}.txt"
            save_urls_to_file(failed_urls, f)
            console.print(f"[yellow][WARN][/yellow] 失败列表: {f} ({len(failed_urls)} 个)")
            console.print(f"[dim][INFO] 重新提交: python batch_submit_from_csv.py --csv-file {f}[/dim]")
        else:
            console.print("[green][OK][/green] 所有 URL 提交成功！")

    def run(self):
        try:
            if not self.config.validate():
                console.print("[red][ERR] 配置验证失败[/red]")
                sys.exit(1)
            console.print(Panel.fit("[bold blue]批量提交 URL 到 Google Indexing API[/bold blue]"))
            self.print_config()
            self.initialize_client()
            urls = self.load_urls()
            if not self.confirm_submission(urls):
                console.print("[dim][INFO] 用户取消操作[/dim]")
                return
            self.results = self.submit_urls(urls)
            self.save_results(self.results)
            console.print(f"\n[bold green]========== 任务完成 {datetime.now():%Y-%m-%d %H:%M:%S} ==========[/bold green]")
        except KeyboardInterrupt:
            console.print("\n[yellow][WARN] 用户中断程序[/yellow]")
        except GoogleIndexingException as e:
            console.print(f"[red][ERR] 程序错误: {e}[/red]")
            sys.exit(1)
        except Exception as e:
            import traceback
            console.print(f"[red][ERR] 程序异常: {e}[/red]")
            traceback.print_exc()
            sys.exit(1)
        finally:
            if self.client:
                self.client.close()


def main():
    BatchSubmitter(load_config()).run()


if __name__ == "__main__":
    main()
