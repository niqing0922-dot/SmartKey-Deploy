#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
查找网站中未被 Google 索引的页面 (优化版)

功能:
- 爬取网站所有页面
- 使用 Google Search Console API 查询索引状态
- 将未索引的页面写入 CSV 文件
- 支持断点续传
- 完善的错误处理和日志记录
- 支持代理设置

使用方法:
    python find_unindexed_pages.py --site https://www.waveteliot.com/
    python find_unindexed_pages.py --site https://www.waveteliot.com/ --use-proxy
"""

import sys
import csv
import json
import time
import argparse
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Set, Tuple
from urllib.parse import urljoin, urlparse
# from concurrent.futures import ThreadPoolExecutor, as_completed  # 预留并发功能
from dataclasses import dataclass, asdict

import requests
from bs4 import BeautifulSoup
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError


@dataclass
class URLInfo:
    """URL 信息"""
    url: str
    indexed: bool = False
    coverage: str = ''
    indexing_state: str = ''
    last_crawl: str = ''
    error: str = ''
    checked_at: str = ''


class Config:
    """配置类"""

    def __init__(self, args):
        self.site_url = args.site.rstrip('/')
        self.credentials_path = args.credentials
        self.max_pages = args.max_pages
        self.crawl_delay = args.crawl_delay
        self.check_delay = args.check_delay
        self.include_indexed = args.include_indexed
        self.output_file = args.output
        self.url_file = args.url_file
        self.resume = args.resume
        self.output_dir = args.output_dir
        self.use_proxy = args.use_proxy
        self.proxy_host = args.proxy_host
        self.proxy_port = args.proxy_port
        self.max_workers = args.max_workers
        self.timeout = args.timeout
        self.verbose = args.verbose

        # 代理 URL
        self.proxy_url = None
        if self.use_proxy:
            self.proxy_url = f"http://{self.proxy_host}:{self.proxy_port}"

        # 确保输出目录存在
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)

    @property
    def proxy_dict(self) -> Optional[Dict[str, str]]:
        """获取代理字典"""
        if self.proxy_url:
            return {'http': self.proxy_url, 'https': self.proxy_url}
        return None


def setup_logger(verbose: bool = False) -> logging.Logger:
    """设置日志记录器"""
    level = logging.DEBUG if verbose else logging.INFO
    logger = logging.getLogger('unindexed_finder')
    logger.setLevel(level)

    # 清除现有处理器
    logger.handlers.clear()

    # 控制台处理器
    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_format = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s',
        datefmt='%H:%M:%S'
    )
    console_handler.setFormatter(console_format)
    logger.addHandler(console_handler)

    return logger


class URLCrawler:
    """网站爬虫"""

    # 不需要爬取的 URL 扩展名
    SKIP_EXTENSIONS = {'.pdf', '.doc', '.docx', '.xls', '.xlsx', '.zip', '.rar', '.jpg', '.png', '.gif', '.svg', '.mp4', '.mp3'}

    def __init__(self, config: Config, logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.base_url = config.site_url
        self.domain = urlparse(config.site_url).netloc
        self.max_pages = config.max_pages
        self.delay = config.crawl_delay

        self.visited: Set[str] = set()
        self.urls: List[str] = []
        self.session = self._create_session()

    def _create_session(self) -> requests.Session:
        """创建请求会话"""
        session = requests.Session()
        session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        })

        # 设置代理
        if self.config.proxy_dict:
            session.proxies.update(self.config.proxy_dict)
            self.logger.debug(f"使用代理: {self.config.proxy_url}")

        # 设置超时
        session.timeout = self.config.timeout

        return session

    def is_same_domain(self, url: str) -> bool:
        """检查 URL 是否属于同一域名"""
        parsed = urlparse(url)
        return parsed.netloc == self.domain or parsed.netloc == ''

    def should_skip(self, url: str) -> bool:
        """检查是否应该跳过此 URL"""
        # 跳过特定的文件类型
        if any(url.lower().endswith(ext) for ext in self.SKIP_EXTENSIONS):
            return True

        # 跳过特定类型的链接
        if any(x in url.lower() for x in ['tel:', 'mailto:', 'javascript:', '#']):
            return True

        return False

    def normalize_url(self, url: str) -> Optional[str]:
        """标准化 URL"""
        if self.should_skip(url):
            return None

        # 处理相对路径
        if url.startswith('//'):
            url = 'https:' + url
        elif url.startswith('/'):
            url = self.base_url + url
        elif not url.startswith('http'):
            url = urljoin(self.base_url + '/', url)

        # 移除 fragment
        url = url.split('#')[0]

        # 移除尾部斜杠 (保留根路径)
        if len(url) > len(self.base_url) + 1 and url.endswith('/'):
            url = url[:-1]

        return url if self.is_same_domain(url) else None

    def extract_links(self, html: str, current_url: str) -> List[str]:
        """从 HTML 中提取链接"""
        try:
            # 优先使用 lxml（更快），回退到 html.parser
            for parser in ('lxml', 'html.parser'):
                try:
                    soup = BeautifulSoup(html, parser)
                    break
                except Exception:
                    continue

            links = []

            for a in soup.find_all('a', href=True):
                href = a['href'].strip()
                normalized = self.normalize_url(href)

                if (normalized and
                    normalized.startswith('http') and
                    normalized not in self.visited and
                    normalized not in links):
                    links.append(normalized)

            return links

        except Exception as e:
            self.logger.warning(f"解析链接失败 ({current_url}): {e}")
            return []

    def crawl_page(self, url: str) -> Tuple[bool, List[str]]:
        """
        爬取单个页面

        Returns:
            (成功, 链接列表)
        """
        try:
            response = self.session.get(url, timeout=self.config.timeout)

            if response.status_code != 200:
                self.logger.debug(f"  状态码 {response.status_code}: {url}")
                return False, []

            # 检查内容类型
            content_type = response.headers.get('Content-Type', '')
            if 'text/html' not in content_type.lower():
                return False, []

            self.urls.append(url)

            # 提取链接
            links = self.extract_links(response.text, url)

            return True, links

        except requests.exceptions.Timeout:
            self.logger.warning(f"  超时: {url}")
            return False, []
        except requests.exceptions.ConnectionError:
            self.logger.warning(f"  连接错误: {url}")
            return False, []
        except Exception as e:
            self.logger.warning(f"  错误 ({url}): {e}")
            return False, []

    def crawl(self) -> List[str]:
        """爬取网站所有页面"""
        self.logger.info(f"开始爬取网站: {self.base_url}")
        self.logger.info(f"最大页面数: {self.max_pages}")

        queue = [self.base_url]

        while queue and len(self.urls) < self.max_pages:
            url = queue.pop(0)

            if url in self.visited:
                continue

            self.visited.add(url)
            self.logger.debug(f"  [{len(self.urls)}/{self.max_pages}] 爬取: {url}")

            success, links = self.crawl_page(url)

            if success:
                # 限制每个页面添加的新链接数
                new_links = [l for l in links if l not in self.visited and l not in queue]
                queue.extend(new_links[:30])

            # 请求延迟
            if queue:
                time.sleep(self.delay)

        self.logger.info(f"✅ 爬取完成,共发现 {len(self.urls)} 个页面")
        return self.urls

    def close(self):
        """关闭会话"""
        self.session.close()


class IndexChecker:
    """索引状态检查器"""

    def __init__(self, config: Config, logger: logging.Logger):
        self.config = config
        self.logger = logger
        self.credentials_path = config.credentials_path
        self.site_url = config.site_url
        self.service = None

    def connect(self):
        """连接到 Search Console API"""
        self.logger.info("连接到 Google Search Console API...")

        try:
            credentials = service_account.Credentials.from_service_account_file(
                self.credentials_path,
                scopes=['https://www.googleapis.com/auth/webmasters']
            )

            # 设置代理
            http_options = {}
            if self.config.proxy_url:
                from googleapiclient.http import ProxyInfo
                proxy = ProxyInfo.from_url(self.config.proxy_url)
                http_options['proxy'] = proxy

            self.service = build('webmasters', 'v3', credentials=credentials)
            self.logger.info("✅ 连接成功")

        except FileNotFoundError:
            raise FileNotFoundError(f"凭证文件不存在: {self.credentials_path}")
        except Exception as e:
            raise ConnectionError(f"连接 Search Console API 失败: {e}")

    def check_index_status(self, url: str) -> URLInfo:
        """检查单个 URL 的索引状态"""
        info = URLInfo(url=url, checked_at=datetime.now().isoformat())

        try:
            response = self.service.urlInspection().index().inspect(
                body={
                    'inspectionUrl': url,
                    'siteUrl': self.site_url
                }
            ).execute()

            result = response.get('inspectionResult', {})
            index_status = result.get('indexStatusResult', {})

            coverage = index_status.get('coverageState', '')

            # 判断是否已索引
            indexed_states = [
                'URL is on Google',
                'URL is indexed, not submitted in sitemap',
                'URL is indexed, but blocked from crawling'
            ]
            info.indexed = any(state in coverage for state in indexed_states)

            info.coverage = coverage
            info.indexing_state = index_status.get('indexingState', '')
            info.last_crawl = index_status.get('lastCrawlTime', '')

        except HttpError as e:
            if e.resp.status == 403:
                info.error = '权限被拒绝 (403)'
            elif e.resp.status == 429:
                info.error = '请求过多 (429)'
            else:
                info.error = f'HTTP {e.resp.status}: {e.error_details}'
            self.logger.warning(f"  API 错误 ({url}): {info.error}")

        except Exception as e:
            info.error = str(e)
            self.logger.warning(f"  检查失败 ({url}): {e}")

        return info

    def batch_check(self, urls: List[str]) -> List[URLInfo]:
        """批量检查 URL 索引状态"""
        self.logger.info(f"\n开始检查 {len(urls)} 个 URL 的索引状态...")

        results = []

        for i, url in enumerate(urls, 1):
            self.logger.debug(f"  [{i}/{len(urls)}] 检查: {url}")
            info = self.check_index_status(url)
            results.append(info)

            # 进度显示
            if i % 10 == 0 or i == len(urls):
                indexed = sum(1 for r in results if r.indexed)
                self.logger.info(f"  进度: {i}/{len(urls)} | 已索引: {indexed} | 未索引: {i - indexed}")

            # 请求延迟
            if i < len(urls):
                time.sleep(self.config.check_delay)

        # 统计结果
        indexed_count = sum(1 for r in results if r.indexed)
        error_count = sum(1 for r in results if r.error)

        self.logger.info(f"\n✅ 检查完成")
        self.logger.info(f"   总计: {len(results)}")
        self.logger.info(f"   已索引: {indexed_count}")
        self.logger.info(f"   未索引: {len(results) - indexed_count}")
        self.logger.info(f"   检查错误: {error_count}")

        return results


class ResultManager:
    """结果管理器"""

    def __init__(self, config: Config, logger: logging.Logger):
        self.config = config
        self.logger = logger

    def save_to_csv(self, results: List[URLInfo], filename: str = None):
        """保存结果到 CSV 文件"""
        if not results:
            self.logger.warning("没有数据需要保存")
            return

        # 过滤数据
        if not self.config.include_indexed:
            results = [r for r in results if not r.indexed]

        if not results:
            self.logger.info("没有未索引的页面需要保存")
            return

        # 生成文件名
        if filename is None:
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = self.config.output_file.replace('.csv', f'_{timestamp}.csv')

        filepath = Path(self.config.output_dir) / filename

        # 写入 CSV
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            fieldnames = [
                'url', 'indexed', 'coverage', 'indexing_state',
                'last_crawl', 'error', 'checked_at'
            ]
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for info in results:
                writer.writerow(asdict(info))

        self.logger.info(f"✅ 结果已保存到: {filepath}")
        self.logger.info(f"   共 {len(results)} 条记录")

    def save_unindexed_urls(self, results: List[URLInfo]):
        """保存未索引的 URL 列表到文本文件"""
        unindexed = [r.url for r in results if not r.indexed]

        if not unindexed:
            return

        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filepath = Path(self.config.output_dir) / f'unindexed_urls_{timestamp}.txt'

        with open(filepath, 'w', encoding='utf-8') as f:
            for url in unindexed:
                f.write(url + '\n')

        self.logger.info(f"✅ 未索引 URL 列表已保存: {filepath}")

    def load_resume_state(self) -> List[str]:
        """加载断点续传状态"""
        state_file = Path(self.config.output_dir) / 'crawl_state.json'

        if not state_file.exists():
            return []

        try:
            with open(state_file, 'r', encoding='utf-8') as f:
                state = json.load(f)
                return state.get('checked_urls', [])
        except Exception as e:
            self.logger.warning(f"加载状态文件失败: {e}")
            return []

    def save_resume_state(self, results: List[URLInfo]):
        """保存断点续传状态"""
        state_file = Path(self.config.output_dir) / 'crawl_state.json'

        state = {
            'site_url': self.config.site_url,
            'checked_urls': [r.url for r in results],
            'timestamp': datetime.now().isoformat()
        }

        with open(state_file, 'w', encoding='utf-8') as f:
            json.dump(state, f, indent=2, ensure_ascii=False)

        self.logger.debug(f"状态已保存: {state_file}")


def print_banner():
    """打印横幅"""
    banner = """
╔════════════════════════════════════════════════════════════════╗
║  Google 索引状态检查工具                                        ║
║  查找网站中未被 Google 索引的页面                              ║
╚════════════════════════════════════════════════════════════════╝
    """
    print(banner)


def parse_args():
    """解析命令行参数"""
    parser = argparse.ArgumentParser(
        description='查找网站中未被 Google 索引的页面',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s --site https://www.waveteliot.com/
  %(prog)s --site https://www.waveteliot.com/ --max-pages 100
  %(prog)s --site https://www.waveteliot.com/ --url-file my_urls.txt
  %(prog)s --site https://www.waveteliot.com/ --resume
  %(prog)s --site https://www.waveteliot.com/ --use-proxy --proxy-host 127.0.0.1 --proxy-port 7890
        """
    )

    # 必需参数
    parser.add_argument(
        '--site',
        required=True,
        help='网站地址 (例如: https://www.waveteliot.com/)'
    )

    # 凭证配置
    parser.add_argument(
        '--credentials',
        default='service_account.json',
        help='Google 服务账号凭证文件路径 (默认: service_account.json)'
    )

    # 爬取配置
    parser.add_argument(
        '--max-pages',
        type=int,
        default=500,
        help='最大爬取页面数 (默认: 500)'
    )
    parser.add_argument(
        '--crawl-delay',
        type=float,
        default=1.0,
        help='爬取请求间延迟秒数 (默认: 1.0)'
    )
    parser.add_argument(
        '--timeout',
        type=int,
        default=15,
        help='请求超时秒数 (默认: 15)'
    )

    # 索引检查配置
    parser.add_argument(
        '--check-delay',
        type=float,
        default=0.5,
        help='索引检查请求间延迟秒数 (默认: 0.5)'
    )

    # 并发配置
    parser.add_argument(
        '--max-workers',
        type=int,
        default=1,
        help='并发检查数 (默认: 1, 谨慎使用可能导致速率限制)'
    )

    # 代理配置
    parser.add_argument(
        '--use-proxy',
        action='store_true',
        help='使用代理'
    )
    parser.add_argument(
        '--proxy-host',
        default='127.0.0.1',
        help='代理服务器地址 (默认: 127.0.0.1)'
    )
    parser.add_argument(
        '--proxy-port',
        type=int,
        default=7890,
        help='代理服务器端口 (默认: 7890)'
    )

    # 输出配置
    parser.add_argument(
        '--output-dir',
        default='results',
        help='输出目录 (默认: results)'
    )
    parser.add_argument(
        '--output',
        default='unindexed_pages.csv',
        help='输出 CSV 文件名 (默认: unindexed_pages.csv)'
    )
    parser.add_argument(
        '--include-indexed',
        action='store_true',
        help='在结果中包含已索引的页面'
    )

    # 其他配置
    parser.add_argument(
        '--url-file',
        help='从指定文件读取 URL (每行一个), 跳过爬取'
    )
    parser.add_argument(
        '--resume',
        action='store_true',
        help='从上次中断处继续'
    )
    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='详细输出模式'
    )

    return parser.parse_args()


def main():
    """主函数"""
    print_banner()

    # 解析参数
    args = parse_args()
    config = Config(args)
    logger = setup_logger(args.verbose)

    crawler = None
    start_time = datetime.now()

    try:
        # 1. 获取 URL 列表
        urls: List[str] = []

        if args.url_file:
            # 从文件读取 URL
            logger.info(f"从文件读取 URL: {args.url_file}")

            url_path = Path(args.url_file)
            if not url_path.exists():
                raise FileNotFoundError(f"URL 文件不存在: {args.url_file}")

            with open(url_path, 'r', encoding='utf-8') as f:
                for line in f:
                    url = line.strip()
                    if url and url.startswith('http'):
                        urls.append(url)

            logger.info(f"✅ 读取到 {len(urls)} 个 URL")

        else:
            # 爬取网站
            crawler = URLCrawler(config, logger)
            urls = crawler.crawl()

        if not urls:
            logger.error("没有找到任何 URL")
            return

        # 断点续传
        if args.resume:
            manager = ResultManager(config, logger)
            checked_urls = manager.load_resume_state()

            if checked_urls:
                urls = [u for u in urls if u not in checked_urls]
                logger.info(f"断点续传: 跳过已检查的 {len(checked_urls)} 个 URL")

        if not urls:
            logger.info("所有 URL 都已检查完毕")
            return

        # 2. 检查索引状态
        checker = IndexChecker(config, logger)
        checker.connect()

        results = checker.batch_check(urls)

        # 3. 保存结果
        manager = ResultManager(config, logger)

        # 保存 CSV
        manager.save_to_csv(results)

        # 保存未索引 URL 列表
        if not args.include_indexed:
            manager.save_unindexed_urls(results)

        # 保存状态
        manager.save_resume_state(results)

        # 4. 显示统计信息
        unindexed = [r for r in results if not r.indexed]
        errors = [r for r in results if r.error]

        if unindexed:
            logger.info(f"\n未索引的页面 ({len(unindexed)} 个):")
            for item in unindexed[:15]:
                logger.info(f"  - {item.url}")
            if len(unindexed) > 15:
                logger.info(f"  ... 还有 {len(unindexed) - 15} 个")

        if errors:
            logger.warning(f"\n检查出错的 URL ({len(errors)} 个):")
            for item in errors[:5]:
                logger.warning(f"  - {item.url}: {item.error}")
            if len(errors) > 5:
                logger.warning(f"  ... 还有 {len(errors) - 5} 个")

        # 完成摘要
        elapsed = (datetime.now() - start_time).total_seconds()
        logger.info(f"\n{'='*60}")
        logger.info(f"任务完成! 耗时: {elapsed:.1f} 秒")
        logger.info(f"{'='*60}")

        if not unindexed:
            logger.info("\n🎉 所有页面都已索引!")

    except KeyboardInterrupt:
        logger.warning("\n\n⚠️ 用户中断程序")
    except FileNotFoundError as e:
        logger.error(f"\n❌ 文件错误: {e}")
        sys.exit(1)
    except ConnectionError as e:
        logger.error(f"\n❌ 连接错误: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"\n❌ 程序错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    finally:
        if crawler:
            crawler.close()


if __name__ == '__main__':
    main()
