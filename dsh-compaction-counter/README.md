# dsh-compaction-counter — 上下文压缩计数

DSH Web GUI 插件：在会话标题栏（`conversation.session.header.actions`）显示**本会话的上下文被压缩了多少次**。

> 已发布到自有仓库：[wsm000/mydsh → dsh-compaction-counter](https://github.com/wsm000/mydsh/tree/main/dsh-compaction-counter)（MIT）。

## 显示什么

| 位置 | 内容 |
|---|---|
| chip 主体 | `压缩 N 次`（成功的摘要式压缩总数：自动 + 手动 `/compact`） |
| 红色徽标 | 有压缩尝试以错误收尾时显示 `失败 M` |
| 悬浮提示 | 自动/手动拆分、累计折叠掉的 token 估算、最近一次压缩的时间/模型/供应商、工具结果修剪（prune）次数与其 token 估算 |

只要投影可用就渲染（`压缩 0 次` 也是有效答案：说明这段上下文还没有被压缩过）；只有宿主半边未挂载、或尚未收到投影基线时才不渲染。

## 数据来源（为什么准确）

宿主半边注册了一个会话投影单元 `compactionStats`，对**完整持久日志**做纯折叠，只认三种压缩事件（见 `@deepseek-ai/dsh-compaction/types`）：

| 事件 | 计数含义 |
|---|---|
| `compaction/summary` | 一次成功的摘要式压缩（`sourceCommandId` 存在 = 手动 `/compact`） |
| `compaction/end` 带 `error` | 一次失败的压缩尝试（单独计数，不计入「压缩次数」） |
| `compaction/prune` | 无模型的工具结果修剪（单独计数，不虚增压缩次数） |

因为折的是整条日志，**分页历史与压缩本身都不会让数字变化**；插件挂载前发生的压缩也会被首次读取时的惰性折叠计入。

## 结构

| 文件 | 职责 |
|---|---|
| `src/types.ts` | `CompactionStats` 形状、投影键声明合并、零依赖校验器 |
| `src/index.ts` | 宿主入口：注册 `compactionStats` 投影单元（`inject: ['sessionProjections']`） |
| `src/client/index.ts` | 浏览器半边：注册标题栏 chip 与样式 |
| `src/client/locales.ts` | 中英文案（命名空间 `compaction-counter`） |
| `src/client/styles.ts` | 注入式样式（`dsh_cc_` 前缀，只用 `--dsw-alias-*` 设计变量） |
| `build.mjs` | esbuild 构建（host ESM + client CJS/ModuleLoader 握手） |

## 构建 · 测试 · 安装 · 验证

```powershell
$node  = "C:\Users\86150\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
$plugin = "C:\Users\86150\Documents\deepseekharness\mydsh\dsh-compaction-counter"
cd $plugin
& $node build.mjs                       # 产物 lib/index.js（宿主，零运行时依赖）+ lib/client.js（浏览器）

# 测试：折叠语义 / 校验器
& $node tests/fold.test.mjs
# 测试：真实构建产物经 ModuleLoader 握手加载后的注册与渲染
& $node tests/client-bundle.test.mjs
# 交叉校验：把真实会话日志喂给折叠，与独立朴素统计逐字段比对
& $node tests/replay-log.mjs ((& $node tools/find-compaction-logs.mjs "$env:USERPROFILE\.dsh\sessions") -split "`t" | ForEach-Object { $_[1] })
```

安装进 profile（两个文件都会先备份）。**主目标是桌面端**——Desktop 应用的 GUI 跑的就是 `desktop` profile：

```powershell
# 1) 桌面端（主目标）
& $node tools/install-into-profile.mjs "$env:USERPROFILE\.dsh\profiles\desktop" dsh-compaction-counter $plugin
cd "$env:USERPROFILE\.dsh\profiles\desktop"
& $node "C:\Users\86150\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" install

# 2) Web 端（可选，3080 服务）
& $node tools/install-into-profile.mjs "$env:USERPROFILE\.dsh\profiles\web" dsh-compaction-counter $plugin
cd "$env:USERPROFILE\.dsh\profiles\web"
& $node "C:\Users\86150\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs" install
```

重载组成的区别：

- **desktop**：该 profile 由 Desktop 应用独占（直接跑 `dsh --profile desktop` 会被拒绝：*managed exclusively by the Electron application*），只能用应用自身的方式。实测结论：**改动 `cordis.patch.yml` 后运行中的宿主会直接热挂载，不需要重启应用**（见下方“验证”）；若某个版本不热挂载，重启一次 Desktop 应用即可。
- **web**：3080 服务需重启一次才生效，用 `restart-server.ps1 -Reason dsh-compaction-counter`，或你自己终端里的 关闭DSH.bat → 启动DSH.bat。

从 GitHub 仓库安装（不共用本地目录时）：

```powershell
git clone https://github.com/wsm000/mydsh C:\src\mydsh
cd C:\src\mydsh\dsh-compaction-counter
& $node build.mjs
& $node tools\install-into-profile.mjs "$env:USERPROFILE\.dsh\profiles\web" dsh-compaction-counter (Get-Location).Path
```

`package.json` 未设 `private`，因此也可 `npm publish`（npm 上该名字目前未被占用）；发布前建议先 `npm pack --dry-run` 核对包内容。

验证“宿主是否真的挂上了”（不需要重启也不需要浏览器）——插件的客户端投影值会落进会话投影缓存：

```powershell
& $node tools\read-projection-cache.mjs
# 出现 ver=1 的 compactionStats 行即说明运行中的宿主已加载本插件
```

桌面端安装过的副本还要满足宿主的客户端发现链路（`dsh-client-modules` 扫描 Loader 条目 → 校验 `dsh.client` → 解析 `exports["./client"]` → 要求构建产物存在）。这条链路可离线核对：从 `~/.dsh/profiles/desktop/package.json` 的解析根定位到包，校验 `dsh.client` 字段、`lib/client.js` 是否存在且带同 id 的 ModuleLoader 握手、以及宿主半边能否 `import` 出 `apply`/`inject`/`name`。2026-10-12 在桌面端实测全部通过（包解析到本地 link、bundle 6228 B、握手 id 与包名一致、宿主半边导出正常）。

## 卸载

删除 profile 的 `cordis.patch.yml` 里的挂载行，并从 `package.json` 的 `dependencies` 移除该 link，再重启宿主；投影键随插件 fiber 一起消失，不残留。
