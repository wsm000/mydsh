# dsh-academic-search

DeepSeek Harness 的**学术论文搜索提供方**（`ctx.web` seam 插件）。

## 背景

现有的通用网页搜索插件对学术论文的搜索效果不佳，因为通用搜索引擎：
- 学术内容索引不全
- 缺少论文元数据（作者、引用数、DOI等）
- 结果排序不适合学术场景

本插件专门针对学术论文搜索，整合多个免费的学术搜索API，提供高质量的论文检索结果。

## 支持的学术搜索后端

| 顺序 | 后端 | 覆盖领域 | 特点 |
|---|---|---|---|
| 1 | **arXiv** | 物理、数学、计算机、统计等 | 预印本论文，更新及时 |
| 2 | **Semantic Scholar** | 跨学科（AI驱动） | 提供引用数、关联论文推荐 |
| 3 | **PubMed** | 生物医学、生命科学 | NCBI官方，权威性高 |
| 4 | **CORE** | 开放获取论文 | 全球最大的开放学术聚合器 |

## 核心特性

### 1. 并行搜索
所有后端**并行执行**，最大化速度和覆盖率。单个后端失败不影响其他后端。

### 2. 智能去重
通过 **DOI**、**arXiv ID**、**URL** 进行去重，保留元数据最完整的版本。

### 3. 引用感知排序
结果排序综合考虑：
- **相关性**（70%）：标题与查询的匹配度
- **影响力**（30%）：引用数（对数缩放）

### 4. 丰富的元数据
每条结果包含：
- `url`: 论文链接
- `title`: 标题
- `snippet`: 摘要片段（最多300字符）
- `authors`: 作者列表
- `year`: 发表年份
- `citations`: 引用数（如果可用）
- `doi`: DOI标识符（如果可用）
- `source`: 来源后端

## 注册

- provider id：`academic-paper`
- inject：`web`
- 导出：`apply(ctx)` → `ctx.web.registerSearchProvider(...)`

## 接入方式（web profile）

### 1. 添加依赖

编辑 `~/.dsh/profiles/web/package.json`，在 `dependencies` 中添加：

```json
"dsh-academic-search": "link:C:/Users/86150/Documents/deepseekharness/mydsh/dsh-academic-search"
```

### 2. 配置 Cordis patch

编辑 `~/.dsh/profiles/web/cordis.patch.yml`：

#### 方案 A：作为默认搜索（推荐）

```yaml
# 插入学术搜索插件
- $match:
    "~id": "^web-search-"
  $before:
    - id: academic-search
      name: dsh-academic-search

# 设置为默认搜索提供方
- $match:
    id: web
  config:
    searchProvider: academic-paper
```

#### 方案 B：与通用搜索并存

保持 `web.config.searchProvider` 为 `free-web`（通用网页搜索），但注册学术搜索插件。在需要时，agent可以通过工具参数选择使用哪个provider。

```yaml
- $match:
    "~id": "^web-search-"
  $before:
    - id: academic-search
      name: dsh-academic-search
```

### 3. 安装并重启

在 profile 目录执行：

```powershell
cd ~/.dsh/profiles/web
pnpm install
```

`postinstall` 钩子会自动排队重启服务（15秒延迟）。

### 4. 创建符号链接（如果 pnpm link 失败）

如果全局 DSH 更新后依赖解析失败，手动创建 junction：

```powershell
# 在 mydsh/dsh-academic-search 目录
New-Item -ItemType Junction -Path "node_modules/@deepseek-ai" -Target "C:\Users\86150\AppData\Roaming\npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai"
```

## 网络

- 使用 Node 24 内置 fetch，支持 `NODE_USE_ENV_PROXY=1` + `HTTPS_PROXY`
- 正常启动路径下自动走 Clash Verge (127.0.0.1:7897)
- 所有后端失败时抛出 `WEB_PROVIDER_ERROR`
- 单个后端失败不影响其他后端

## 环境变量

目前无需额外配置，所有API都是免费公开的。

## 使用示例

在 DSH 中使用 `web_search` 工具时，如果配置了 `searchProvider: academic-paper`，会自动使用学术搜索：

```javascript
// Agent 自动调用
web_search({
  queries: ["transformer attention mechanism"],
  maxResults: 10
})
```

## API 限制说明

| 后端 | 速率限制 | 注意事项 |
|---|---|---|
| arXiv | 无明确限制 | 稳定可靠 |
| Semantic Scholar | 100 req/5min（匿名） | 高频使用可能触发限制 |
| PubMed | 3 req/s（无API key） | 两步请求（search + summary） |
| CORE | 1000 req/day（匿名） | 开放获取论文专用 |

**推荐**：正常使用（每次搜索4个后端并行）不会触发限制。如需大规模批量搜索，建议申请各API的免费key并修改代码添加认证。

## 回切到通用搜索

如需切换回通用网页搜索，编辑 `~/.dsh/profiles/web/cordis.patch.yml`：

```yaml
- $match:
    id: web
  config:
    searchProvider: free-web  # 或 deepseek-official
```

然后重启服务。

## 测试

```bash
node --test tests/
```

## 示例搜索查询

- `"attention is all you need"` → 找经典论文
- `"GPT-4 architecture"` → 找最新研究
- `"CRISPR gene editing"` → 跨领域搜索（生物医学）
- `"quantum computing algorithms"` → 物理/计算机交叉

## 许可

MIT License
