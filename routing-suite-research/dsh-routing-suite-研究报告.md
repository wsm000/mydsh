# dsh-routing-suite 插件研究报告

> 调研时间：2026-08-15 · 数据来源：GitHub API + 三个仓库的 README / 源码 / issues / releases

## 一、这是什么

**dsh-routing-suite** 是 DeepSeek Harness (DSH) 生态里的一个 **"运行时注入器 × 思维模式路由" 套装**（聚合仓库），
由 `yjh051108` 发布于 2026-08-14，目前 **133 stars、3 个 open issues、无 license、无 release**（仅有 README 中声称的版本号）。

它本身不含代码，只是把两个独立演进的子模块（submodule）聚合在一起并提供一键安装脚本：

| 路径 | 子模块仓库 | 版本 | 作用 |
|---|---|---|---|
| `injector/` | [yjh051108/dsh-super-injector](https://github.com/yjh051108/dsh-super-injector)（23★，TypeScript） | 0.3.3 | **运行时注入器**：免重启把插件包注入运行中的 DSH web（dev_* 工具全家桶） |
| `preset/` | [yjh051108/dsh-router-standard](https://github.com/yjh051108/dsh-router-standard)（13★，JavaScript） | 0.1.0 | **任务感知思维模式路由预设**：spec / react / weak 三模式 + 近距离引导 + 单任务三锚 |

套装 repo 结构极简：`README.md`、`install.ps1`、`.gitmodules`、两个 submodule 指针。

## 二、组件 1：dsh-super-injector（运行时注入器）

定位是 **"BepInEx 式模组注入入口"**（BepInEx = 游戏 Mod 注入器）：官方装配机制（bundle / repository 插件）是"唯一的官方入口，像游戏只有启动器能装模组"；本插件打破这一点——**引导器走官方入口装一次，之后万物皆可运行时注入**。

### 核心机制
1. **junction 链接**：把插件包链接到 `~/.dsh/profiles/web/node_modules`（loader 标准解析路径）；
2. **`ctx.loader.create({ name, config })`** 运行时装配（拿到完整 ctx，host 工具 + client UI 全部生效）；
3. **清单持久化**：`~/.dsh/super-injector/registry.json`，web 重启后自动恢复注入；
4. **client 联动**：清除 loader 幽灵 entry 隔离（normalizeEntry）、补扫 client 模块表，浏览器端 bundle rev 联动更新。

### dev_* 工具全家桶（全部免重启）
| 工具 | 功能 |
|---|---|
| `dev_inject_plugin` / `dev_uninject_plugin` | 运行时注入 / 一键卸载（fiber 全清理） |
| `dev_injected_list` / `dev_install_package` | 注入清单 / 热装配本地 bundle 插件（重启后官方接管） |
| `dev_reload_package` | 整包热重载（清缓存 → 重新 import → 重建 fiber，失败回滚保留旧代，支持自重载） |
| `dev_plugin_status` / `dev_clear_routes` | 插件状态统计 / webserver 孤儿路由自愈 |
| `dev_stage_add/call/list/promote/demote` | 开发侧挂区：测试工具挂"后侧"不进 tools schema，一键转正 |

### 亮点声明
- **云源自举**：下载 release 副本 → 装配 → 注入器从云端副本运行（自检 8/8）；失败 → touch patch 进程内重装配，6 秒复活；
- **DSH 正式版兼容**：peerDependencies 全用范围声明（`@deepseek-ai/dsh-tools: >=0.0.1-rc <2`、`cordis: >=4.0.0-rc <5`），不硬编码版本；
- 与 dsh-evolve 的定位差异：evolve 是"创造模式"（agent 现场写单文件插件热挂载），injector 是"手术台"（注入开发者预构建的完整插件包）。

## 三、组件 2：dsh-router-standard（思维模式路由预设）

核心主张：**V4 Pro / Flash 的模型行为沿 persona 轴不是连续谱，而是塌缩成几个稳定区域（行为带），带之间有相变**。
所以路由器把连续轴量化为稳定带，而不是假装轴是连续可调的。

### 三个实测行为带（21 个模式点 × n=2，官方 API，reasoning_effort=max，V4 Pro）
| 带 | 模式值 | 实测行为 |
|---|---|---|
| `spec` | 0 – 0.19 | 稳定"计划-集体"（`We` 轨迹，let-me ≈ 0） |
| `mixed` | 0.2 – 0.49 | **过渡陷阱**：`We`/`The`/`Let` 不稳定混合（自动路由永不选它） |
| `react` | 0.5 – 1.0 | 稳定"执行者"（`The`/`Let` 第一人称，we ≈ 0）——11 个模式值行为相同 |

V4 Flash 是阈值型的（0–0.5 全是 spec 侧，0.75+ 才跳变）。

### 工作机制
1. **读会话第一条用户消息** → `classifyTask()` 按关键词计数（REACT_RE / SPEC_RE）分类：
   react 计数多 → `react`(1)；spec 多 → `spec`(0)；**打平/模糊 → `weak`（内路由，交模型自分类）**；
2. **首轮请求注入 persona + 首轮核心工具集**（`system-prompt/assemble` Waterfall 过滤）：
   - spec → 最小 RL 对齐句 + read/edit/glob/grep（read-first）
   - react → 动手派 persona + read/write/edit（write-first）
   - weak → 按模型选 persona：Pro = spec 句 + few-shot 分类指令（+5.00）；Flash = neutral + "classify then act"（+5.67）
3. **首次 tool/call 后**：恢复完整 Standard 工具目录，路由器不再碰任何东西；
4. **模式从持久 session events 推导** → resume/reload 不丢；
5. **plan-mode 保留**：`applyPersona()` 只替换 persona section，plan 边界不失忆。

### 近距离引导（weak 模式）
每条真实用户消息后，往 inbox 追加一条固定引导（`session/event` 监听 → `target.inbox.append`）：
- 简单任务 → 快速收敛引导；复杂任务（长度 > 120 或架构类关键词）→ 深度引导（"Think deeply about architecture/edge cases…End each reasoning block with a decision or an information need"）
- 实测缓存命中 92–94%，路由 96% + 收敛 100% + 反稀释

### 自优化工具
- `dev_router_status` — 当前 mode/band/persona/核心工具/override 状态
- `dev_router_mode <spec|weak|mixed|react|0-100|0.0-1.0|auto>` — 显式设模式（数字输入量化为三带）
- `dev_mode_subagent <mode> <task>` — 用**不同**思维模式在全新隔离上下文跑一个任务（因为会话中途切 persona 会作废整个前缀缓存，尾段 persona 无效 P6，原生 subagent 会继承当前 persona——只有全新 LLM 调用才是可靠隔离）

### 理论依据："双吸引子 RL 策略"（god/ghost duality）
- 同一模型：维护基准（Project2）spec 条件 99/96，绿地构建任务（Mario）react 条件 10/10；**模式错了分别只有 91 / 6**——纯提示词条件化就有 ~10 分摆动；
- persona 是主导触发器（一句话切换就翻转轨迹），工具 schema 面是次要条件，目录文本无效；
- 行为路径承诺：锚定后扩展工具目录最多扰动一个推理块，不会翻转模式；
- **模型不能自路由**（P3/P5/P8）：唯一内部路由窗口是 weak persona + few-shot 分类指令（lean 不 flip，区分度 +2.3~+3.3）。结论：**模式选择必须来自外部**——人、启发式分类器或学习型路由器。本预设就是外部路由的自动化版。

## 四、安装链与当前问题 ⚠️

### 官方安装（三步）
```powershell
# 1. 拉套装（含两个 submodule）
git clone --recurse-submodules https://github.com/yjh051108/dsh-routing-suite.git
cd dsh-routing-suite

# 2. 一键安装（注入器装配 + 预设复制 + 提示重启）
.\install.ps1
#   = dsh plugin --profile web add .\injector
#   + Copy-Item -Recurse .\preset\preset ~/.dsh/.agent-presets\router-standard

# 3. 重启 DSH → 新会话选择 "Router Standard (experimental)"
```

### 已知问题（3 个 open issues，2026-08-15）
1. **#1 / #3：submodule URL 是坏的** — `.gitmodules` 指向 `dsh-external/dsh-super-injector`（不存在，404），实际应为 **`yjh051108/dsh-super-injector`**。后果：`git clone --recurse-submodules` 直接失败；README 组件表链接也坏。**当前官方安装链不可用**，需手动修正 URL 或单独克隆注入器。
2. **#1：注入器启动报错 `Cannot find package '@deepseek-ai/dsh-tools'`** — 注入器 lib 从包自身 node_modules 解析依赖，需照 build.sh 建 junction 到 DSH checkout 包（如 `node_modules/@deepseek-ai/dsh-tools → <checkout>/packages/core/tools`）。install.ps1 对缺 lib 的情况只提示"先构建"而不会自动处理。
3. **#2：Flash 上仍有很多 "let me" 思维链** — 维护者回复"是正常的"（weak 路由下 Flash 的正常表现）。

### 风险提示
- **无 license**（不能合法复用/分发其代码）；
- 注入器属于**深度侵入运行时**的黑魔法（junction + loader.create + 路由表直改 + 进程内重装配），
  与官方"配置即状态"的插件哲学相悖，可能随 DSH 版本升级失效（尽管声称 peerDeps 范围声明兼容 rc.6）；
- 实验性研究产物（README 自称 research artifact），"P1-P23 实测"数据来自作者自己的探针，未见第三方复现；
- 预设依赖 DSH 0.1.0-rc.6 的 Standard 组合，随官方 preset 演进可能漂移。

## 五、结论

- **值不值得用**：如果你想要"免重启装插件 + 热重载 + 侧挂测试"的 Mod 级体验，或想试"任务感知思维模式路由"，值得关注；
- **现在别直接照 README 装**：submodule URL 是坏的，需先修正（`git submodule set-url injector https://github.com/yjh051108/dsh-super-injector.git`）；
- **想只试路由预设**：可绕过套装，直接装 `dsh-router-standard`（有 v0.1.0 release tgz，13★），只复制 preset 目录到 `~/.dsh/.agent-presets/`，不需要注入器；
- **最值得借鉴的是方法论**：行为带量化、双吸引子证据、首轮锚定、近距离引导——这些机制已在注入器 README 的"规范铁律 10 条"和 router-standard 的 `docs/paper.md` 中沉淀，可平移到任何 DSH 预设开发。

## 附：调研文件清单（/home/simin/Desktop/routing-suite-research/）
- `README.md` — 套装 README
- `install.ps1` — 一键安装脚本（29 行）
- `.gitmodules` — 子模块声明（URL 已坏）
- `injector-README.md` — dsh-super-injector README（253 行，含规范铁律）
- `preset-README.md` — dsh-router-standard README（144 行）
- `preset/agent.cordis.yml` — 完整 rc.6 Standard 组合 + router 行
- `preset/preset.yml` — 预设清单声明
- `preset/router-core.mjs` — 纯路由逻辑（分类/band/persona，零依赖）
- `preset/router-bootstrap.mjs` — Cordis 插件（Waterfall + 近距离引导 + 三个 dev 工具）
