# dsh-web-search-free

DeepSeek Harness 的**免费无密钥**搜索提供方（`ctx.web` seam 插件）。

## 背景

DSH 自带的搜索提供方 `@deepseek-ai/dsh-web-search-deepseek`（`deepseek-official`）
走 DeepSeek Anthropic 兼容接口的原生 `web_search_20250305` 服务端工具，
按次计费。账号欠费后所有 `web_search` 调用直接失败。

本插件抓取**多个免密钥 HTML 搜索端点**，解析结果为 `{ url, title, snippet }`，
不需要任何 API key、不产生费用。DuckDuckGo 的 html/lite 端点对匿名客户端返回
HTTP 202 人机验证页，实测不可用。

## 后端链（首个命中即返回）

| 顺序 | 后端 | 定位 | 已知问题 |
|---|---|---|---|
| 1 | Bing（`ensearch=1`） | 质量最高 | zh 市场对部分 CJK 查询周期性投毒（返回无关热榜）；出口 IP 信任塌陷后会长期投毒 |
| 2 | Mojeek | 英文/技术强、爬虫友好 | 中文索引为空；突发高频会 403 |
| 3 | Baidu | 中文 | 间歇性返回"网络不给力"占位页 |
| 4 | So.com (360) | 中文、稳定 | 结果带 `so.com/link?m=` 重定向 href |

**投毒检测**：Bing 投毒的整页结果与查询词零命中。启发式——小于 5 条的小结果集
视为诚实稀疏命中直接接受；≥5 条且无任何结果包含查询 token 的视为投毒，跳到下一
后端。全链皆投毒时默认返回空结果（诚实为空，比误导更好）；设
`DSH_WEB_SEARCH_FREE_BESTEFFORT=1` 则返回首个非空集。

## 注册

- provider id：`free-web`
- inject：`web`
- 导出：`apply(ctx)` → `ctx.web.registerSearchProvider(...)`

## 接入方式（web profile）

1. `~/.dsh/profiles/web/package.json` 依赖加入
   `"dsh-web-search-free": "link:C:/Users/86150/Documents/deepseekharness/mydsh/dsh-web-search-free"`
2. `~/.dsh/profiles/web/cordis.patch.yml`：
   - `insert` 本插件条目；
   - 覆盖 `web` 条目 `config.searchProvider: free-web`。
3. 在 profile 目录跑一次包管理器（postinstall 会自动排队重启服务）。

## 运行时依赖解析

本包通过 `link:` 挂进 profile，Node ESM 按真实路径解析裸说明符，因此仓库内
自带 `node_modules/@deepseek-ai/dsh-web` junction 指向全局安装树：

```
node_modules/@deepseek-ai/dsh-web
  → C:\Users\86150\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-web
```

⚠️ `更新DSH.bat` 全局自更新后若目标目录变动导致 junction 失效，重建该 junction 即可
（与 `mydsh/dsh-toolkit` 的 `link-deps.sh` 同一约定）。

## 网络

Node 24 内置 fetch 支持 `NODE_USE_ENV_PROXY=1` + `HTTPS_PROXY`，正常启动路径下
自动走 Clash Verge (127.0.0.1:7897)。全部后端失败（如代理断开）时抛
`WEB_PROVIDER_ERROR`，不会静默返回空；个别后端失败只跳过该后端。

## 可调项（环境变量）

- `DSH_WEB_SEARCH_FREE_ENSEARCH`（默认 `1`）— Bing 国际版模式，修复中文投毒的必要项。
- `DSH_WEB_SEARCH_FREE_MKT`（默认空）— Bing 结果市场，如 `zh-CN` / `en-US`。
- `DSH_WEB_SEARCH_FREE_BESTEFFORT`（默认 `0`）— 全链投毒时 `1` 返回首个非空集，
  `0` 返回空结果。

## 回切 DeepSeek 官方搜索

充值恢复后，把 `~/.dsh/profiles/web/cordis.patch.yml` 里 `web` 条目的
`config.searchProvider` 改回 `deepseek-official` 并重启即可；`web-search-deepseek`
插件始终注册，随时可选。

## 测试

```
node tests/parse.test.mjs   # 离线 fixture（不打网络），13 个用例
```