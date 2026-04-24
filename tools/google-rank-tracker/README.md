# Google 排名批量查询

这个工具会读取 Excel 里的关键词，查询 `waveteliot.com` 在 Google 自然搜索结果中的页码和位次，并导出新的 `xlsx/csv`。
默认读取脚本同目录下的 `IoT Keywords - 1.xlsx` 里的 `Keywords_Clean` 工作表，输出结果默认写回 Excel 所在文件夹。
省额度策略已经内置：

- SerpAPI 默认每次请求拉取 100 条结果，而不是 10 条
- 默认只保留结果文件一份，支持 `--resume` 续跑
- 默认可配保留剩余额度，避免把免费额度一次用光

## 文件

- `rank_tracker.py`: 主程序
- `requirements.txt`: Python 依赖

## 安装

```powershell
python -m pip install -r requirements.txt
```

## 推荐运行方式

`SerpAPI` 比直接抓 Google 稳定很多，适合批量查询。

```powershell
$env:SERPAPI_API_KEY="你的key"
python .\rank_tracker.py `
  --provider serpapi `
  --resume `
  --limit 5 `
  --max-pages 3 `
  --results-per-request 100 `
  --reserve-credits 10 `
  --hl en `
```

运行后会在 Excel 同目录输出：

- `waveteliot_google_rankings.xlsx`
- `waveteliot_google_rankings.csv`

字段说明：

- `keyword`: 关键词
- `found`: 是否命中目标域名
- `page`: 第几页
- `position`: 自然结果总位次
- `url`: 命中的页面 URL
- `provider`: 查询来源
- `error`: 错误信息

## 免费额度建议

免费档适合先查前 10 页，因为：

- `--max-pages 3` 配合 `--results-per-request 100` 时，1 个关键词通常只消耗 1 次搜索
- 28 个关键词大约消耗 28 次搜索
- 用 `--resume` 可以中断后继续，不会重复消耗已完成关键词

## 免 API 兜底模式

```powershell
python .\rank_tracker.py --provider google_html
```

这个模式直接请求 Google HTML，容易遇到 JavaScript 页面、验证码或反爬限制，只适合少量测试，不适合长期稳定跑批。
- 默认不指定国家地区参数，不强制按某个国家结果抓取
