# 学术搜索插件升级完成

## ✓ 已完成的工作

### 1. 创建了新的学术搜索插件 `dsh-academic-search`

**位置**: `mydsh/dsh-academic-search`

**特性**:
- ✓ 并行搜索 4 个学术数据库：arXiv、Semantic Scholar、PubMed、CORE
- ✓ 智能去重（基于 DOI、arXiv ID、URL）
- ✓ 引用感知排序（相关性 70% + 引用数 30%）
- ✓ 丰富的元数据（作者、年份、引用数、DOI、摘要）
- ✓ 通过 12 个单元测试

**覆盖领域**:
- arXiv: 物理、数学、计算机、统计等预印本
- Semantic Scholar: AI 驱动的跨学科搜索，提供引用数据
- PubMed: 生物医学和生命科学
- CORE: 全球最大的开放获取论文聚合器

### 2. 插件已集成到 DSH Web Profile

**配置文件**:
- ✓ `~/.dsh/profiles/web/cordis.patch.yml` - 已注册学术搜索插件
- ✓ 插件文件已复制到 `node_modules/dsh-academic-search`

**当前状态**: 
- 通用网页搜索 (`free-web`) 是默认提供方 ✓
- 学术搜索 (`academic-paper`) 已注册，可随时切换 ✓

## 如何使用

### 方式 1: 切换到学术搜索作为默认（推荐用于学术研究场景）

编辑 `~/.dsh/profiles/web/cordis.patch.yml`，找到这一段：

```yaml
- id: web
  name: '@deepseek-ai/dsh-web'
  config:
    searchProvider: free-web  # 改为 academic-paper
```

然后重启服务器：
```powershell
cd C:\Users\86150\Documents\deepseekharness
.\restart-server.ps1 -Reason "switch-to-academic-search"
```

### 方式 2: 保持当前配置，需要时手动指定

如果 DSH 的 `web_search` 工具支持 `provider` 参数，可以这样调用：
```javascript
web_search({
  queries: ["transformer attention mechanism"],
  provider: "academic-paper"  // 指定使用学术搜索
})
```

## 搜索效果对比

### 通用搜索 (free-web) - 适用于

- 新闻和时事
- 通用网页内容
- 产品和服务信息
- 中文内容为主的查询

### 学术搜索 (academic-paper) - 适用于

- 查找学术论文和预印本
- 获取引用数和影响力数据
- 查找特定作者的研究
- 追踪研究前沿和最新进展
- 需要 DOI 等学术元数据

**示例查询**:
- ✓ "diffusion model watermarking"
- ✓ "attention is all you need"
- ✓ "CRISPR gene editing review"
- ✓ "quantum computing algorithms"

## 测试示例 - 扩散模型水印研究

刚才使用通用搜索测试查询 "diffusion model watermarking"，找到了 8 篇相关论文：

1. **SuperMark** (arXiv:2412.10049) - 基于扩散超分辨率的鲁棒水印
2. **Image Watermarking of Generative Diffusion Models** (arXiv:2502.10465) - 频域水印方法
3. **Attack-Resilient Image Watermarking** (arXiv:2401.04247) - 抗攻击水印
4. **Embedding Watermarks in Diffusion Process** (arXiv:2410.22445) - 模型知识产权保护
5. **DistSeal** (arXiv:2601.16140) - 潜空间水印方法
6. **Stable Signature is Unstable** (arXiv:2405.07145) - Meta 水印框架的脆弱性分析

如果切换到学术搜索，这些结果会包含：
- 引用数排序（高引用论文优先）
- 作者信息
- 发表年份
- DOI 标识符
- 更精准的相关性匹配

## 插件文件结构

```
mydsh/dsh-academic-search/
├── lib/
│   └── index.js          # 主插件代码（并行搜索、解析、去重、排序）
├── tests/
│   └── parse.test.mjs    # 12 个单元测试（全部通过 ✓）
├── package.json          # 插件元数据
├── README.md             # 详细文档
├── LICENSE               # MIT 许可证
└── node_modules/         # DSH 依赖的 junction

```

## 维护说明

### 更新插件代码

插件源码位于 `mydsh/dsh-academic-search`。修改后需要：

1. 运行测试: `cd mydsh/dsh-academic-search && node tests/parse.test.mjs`
2. 重新复制到 profile（或重启会自动更新，如果用的是符号链接）

### API 限制

| 后端 | 匿名限制 | 备注 |
|---|---|---|
| arXiv | 无 | 非常稳定 |
| Semantic Scholar | 100 req/5min | 正常使用不会触发 |
| PubMed | 3 req/s | 使用两步查询（search+summary） |
| CORE | 1000 req/day | 开放获取专用 |

如需大规模使用，建议申请各 API 的免费 key。

## 故障排查

### 如果插件加载失败

检查插件文件是否存在：
```powershell
Test-Path "C:\Users\86150\.dsh\profiles\web\node_modules\dsh-academic-search\lib\index.js"
```

如果返回 `False`，重新复制插件：
```powershell
Copy-Item "C:\Users\86150\Documents\deepseekharness\mydsh\dsh-academic-search" `
  -Destination "C:\Users\86150\.dsh\profiles\web\node_modules\dsh-academic-search" `
  -Recurse -Force
```

### 如果搜索没有结果

1. 检查代理是否运行（Clash Verge on 127.0.0.1:7897）
2. 查看 DSH 日志中的错误信息
3. 尝试切换回通用搜索 (`free-web`) 对比

---

**升级完成时间**: 2026-09-08  
**插件版本**: 0.1.0  
**状态**: ✓ 已集成，可随时启用
