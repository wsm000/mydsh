# Band Router — 任务感知思维模式路由预设（自制版）

基于 **dsh-router-standard 方法论**（行为带量化 + 首轮锚定 + 近距离引导 + 模式隔离）实现的
DSH agent 预设。与上游的关系：**方法论与 persona 文本沿用实测最优值（MIT 归属见 NOTICE），
路由逻辑、引导文本、工具与持久化是本次的独立实现**。

## 方法（实测依据）

DeepSeek V4 Pro/Flash 沿 react↔spec persona 轴的行为**不是连续谱**，而是塌缩为几个稳定区
（21 模式点 × n=2 探针，官方 API，reasoning_effort=max）：

| 带 | 模式值 | 行为 |
|---|---|---|
| `spec` | 0 – 0.19 | 稳定"计划-集体"（We 轨迹，let-me ≈ 0） |
| `mixed` | 0.2 – 0.49 | **过渡陷阱**：不稳定混合（自动路由永不选） |
| `react` | 0.5 – 1.0 | 稳定"执行者"（11 个模式值行为相同） |
| `weak` | — | **内路由**：模型按任务自分类（唯一实测可行的内部路由窗口） |

模型不能自路由（P3/P5/P8），模式选择必须来自外部——本预设就是自动化外部路由器。

## 工作机制

1. **分类**：读会话首条用户消息 → 关键词证据计数（react/spec 家族）→ 分类；
2. **首轮注入**（`system-prompt/assemble` Waterfall）：匹配的 persona + 首轮核心工具集
   （spec → read-first，react/weak → write-first），首次 `tool/call` 后放开全量 Standard 目录；
3. **plan-mode 保留**：只替换 persona section，plan 边界不失忆；
4. **近距离引导**（仅 weak）：每条真实用户消息后追加一条固定引导（静态文本，缓存稳定），
   简单任务 → 快速收敛引导；复杂任务 → 深度引导；
5. **自优化工具**：`dev_router_status` / `dev_router_mode` / `dev_mode_subagent`
   （模式隔离：不同模式 = 全新 LLM 上下文，因为中途切 persona 会作废前缀缓存）。

## 与上游（dsh-router-standard v0.1.0）的设计差异

| # | 上游 | Band Router | 理由 |
|---|---|---|---|
| 1 | `react > spec` 即判 react | **margin 门控**：\|margin\| ≥ 2 才提交强带，其余落 weak | 单个反例词（"创建脚本**修复**崩溃"）不再翻转行为带 |
| 2 | 仅 flash/pro 二值 | **modelFamily()**：light/pro/unknown 分桶（未知走 pro 安全默认） | 新模型名出现时行为可预测 |
| 3 | 长度 > 120 或关键词判复杂 | 增加**需求密度**信号（≥2 个分句或问号） | 短但多要求的任务也吃深度引导 |
| 4 | 覆盖值仅存内存 | **持久化到 overrides.json**（预设目录旁，防抖写盘，失败静默降级内存） | reload/重启后覆盖不丢 |
| 5 | 引导文本（上游措辞） | 自撰引导文本（同样原则：先分类、复杂先深想、决策闭合） | 措辞不影响测量属性，缓存原则不变 |
| 6 | 装配含 codex/claude-code 行 | 裁剪（只留 spawn/fork） | 预设聚焦路由，不背产品 provider 行 |

persona **文本**保持实测最优原样（改词即丢测量属性）；引导/分类阈值/工具是本次独立实现。

## 文件

```
band-router/
├── preset.yml            # GUI 显示名与描述（"Band Router (experimental)"）
├── agent.cordis.yml      # rc.6 Standard 组合 + router 行（17 行，3 个 isolate 组）
├── router-core.mjs       # 纯决策核心：分类/行为带/persona/复杂度（零依赖）
├── router-bootstrap.mjs  # Cordis 插件：装配/锚定/引导/dev 工具/覆盖持久化
├── router.test.mjs       # 18 个单元测试（node --test，全部通过）
├── overrides.json        # 运行时生成：dev_router_mode 覆盖持久化
├── README.md / LICENSE / NOTICE
```

## 安装

```powershell
# Windows
$target = Join-Path $env:USERPROFILE '.dsh\.agent-presets\band-router'
Copy-Item -Recurse . $target
```

```bash
# Linux/macOS
mkdir -p ~/.dsh/.agent-presets
cp -r . ~/.dsh/.agent-presets/band-router
```

然后重启 DSH，新建会话 → 选择 **Band Router (experimental)**。

> ⚠️ 与上游一致：安装副本的模块文件名必须保持唯一（loader 按 URL 缓存 ESM，
> 不要原地覆盖同目录文件）。

## 测试

```sh
node --test router.test.mjs   # 18 tests, all pass
```

## 使用

- 发任务：生成任务自动 react，维护任务自动 spec，模糊任务进 weak 内路由；
- `dev_router_status` — 查看当前 mode/band/persona/模型家族/核心工具；
- `dev_router_mode <spec|weak|mixed|react|0-100|0.0-1.0|auto>` — 显式设模式（持久化）；
- `dev_mode_subagent <spec|react|balanced> <task>` — 用另一种模式在隔离上下文跑任务。

## 兼容性

- 面向 DSH 0.1.0-rc.6（本机安装版本一致）；
- bootstrap 零外部依赖（preset 目录解析不到 `@deepseek-ai/*`，工具内联最小 schema 编译器）；
- 注入的 `systemPrompt` / `tools` / `llm` 服务来自 DSH Standard 组合，随官方改名需同步。

## 归属

- 方法论与 persona 文本：yjh051108/dsh-router-standard（MIT）——见 NOTICE；
- 装配组合：DeepSeek Harness Standard preset（MIT）派生——见 NOTICE。
