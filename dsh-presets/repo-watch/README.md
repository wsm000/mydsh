# Repo Watch — DSH 仓库巡检预设（守护模式）

一个 **预设 + 守护插件** 的组合：DSH 里多一个 "Repo Watch (experimental)" 会话模式，
其守护插件每 **3 天** 自动巡检一次 GitHub 仓库
[`yjh051108/dsh-routing-suite`](https://github.com/yjh051108/dsh-routing-suite)，
有变化就写入巡检日志；打开巡检会话时，模型自动汇报最新动态。

## 工作原理

```
每 3 天（或重启补查）
   └─ 守护插件 watchdog（挂在预设的 standing mount 上）
        ├─ GET /repos/{repo}         → stars / open issues / pushed_at / 描述
        ├─ GET /repos/{repo}/issues?state=all&per_page=5   → 最近 issue（排除 PR）
        ├─ GET /repos/{repo}/releases?per_page=3           → 最近 release
        ├─ 与上次快照 diff（watch-state.json）
        └─ 有变化 → 追加 markdown 条目到 watch-log.md（保留最近 200 行）
```

- **快照/日志落盘**：`watch-state.json` + `watch-log.md`，放在预设目录旁；
- **重启补查**：挂载时发现上次检查已过期（> 3 天）→ 立即补查一次，错过的检查不丢；
- **失败软着陆**：GitHub 网络错误/限流 → 日志记一行失败原因，下个周期自动重试，插件不崩；
- **零外部依赖**：只用 Node 内置 `fetch`/`fs` 与 DSH 的 `timer` 服务（dsh-base 已装配）；
- **定时器规范**：`ctx.timer.interval()` 自带 ctx.effect 绑定，随上下文销毁自动清理。

## 使用

1. 安装（见下）；
2. **重启 DSH**，新建会话 → 选择 **Repo Watch (experimental)**；
   —— 这一步会挂载守护插件：若从未检查过或已过期，5 秒后立即补查一次，之后每 3 天自动检查；
   —— 守护挂在 standing mount 上，**会话关掉后定时器继续跑**，直到进程结束；
   —— 进程重启后，下次打开巡检会话会再次补查。
3. 会话内模型会自动调用 `watch_status` 汇报；随时可让 AI 执行：
   - `watch_status` — 目标仓库、上次/下次检查时间、错误、日志尾部
   - `watch_now` — 手动立即巡检一次
4. 查看原始日志：`~/.dsh/.agent-presets/repo-watch/watch-log.md`

## 改监控目标 / 周期

编辑 `~/.dsh/.agent-presets/repo-watch/agent.cordis.yml` 里的 watchdog 行：

```yaml
- id: watchdog
  name: ./watchdog.mjs
  config:
    repo: yjh051108/dsh-routing-suite   # 换成任意 owner/repo
    intervalDays: 3                     # 换成任意天数
    # token: ghp_xxx                   # 可选：GitHub token（匿名限流 60 次/小时，3 天一次远用不完）
```

改完重启生效（新会话使用新组合；已运行的会话保留装载时的组合）。

## 文件

```
repo-watch/
├── preset.yml           # GUI 显示名 "Repo Watch (experimental)"
├── agent.cordis.yml     # Standard 组合 + watchdog 行 + 巡检 persona
├── watch-core.mjs       # 纯逻辑：URL/解析/快照/diff/日志条目/调度（零依赖）
├── watchdog.mjs         # 守护插件：定时器 + 拉取 + 落盘 + watch_status/watch_now
├── watch.test.mjs       # 11 个单元测试（node --test，全部通过）
├── watch-state.json     # 运行时生成：上次检查/下次检查/最近快照
├── watch-log.md         # 运行时生成：巡检日志
└── README.md / LICENSE / NOTICE
```

## 测试

```sh
node --test watch.test.mjs   # 11 tests, all pass
```

已做真实 API 冒烟：拉取 → 快照 → diff → 日志条目全链路验证通过。

## 注意

- 守护只在**至少一次会话挂载过该预设**的进程生命周期内运行；想让定时器常驻，保持 DSH web
  进程不退出即可（web 服务本来就常驻），但每次进程重启后需要打开一次巡检会话触发挂载。
- 巡检是无鉴权 GitHub API：60 次/小时匿名限额，3 天一次完全够用；被限流时日志会写明原因。
- 会话内汇报依赖模型读取 `watch_status` 与日志——persona 已写明开场动作，无需手动提醒。
