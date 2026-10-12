# mydsh

My personal [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) plugins.

> Built on [Cordis](https://github.com/cordiverse/cordis) — everything is a plugin.

## Plugins

| 目录 | 说明 |
|---|---|
| `dsh-presets/band-router/` | Band Router (experimental):任务感知思维模式路由预设(spec/react/weak 三行为带 + 近距离引导 + 模式隔离) |
| `dsh-presets/repo-watch/` | 仓库巡检预设(自定义) |
| `routing-suite-research/` | dsh-routing-suite 研究套装:注入器 × 思维模式路由(preset 与安装链、研究报告) |
| `dsh-at-file/` | Codex 风格 `@路径` 引用插件(web GUI 路径选择器,不注入文件内容),v0.4.0 |
| `dsh-toolkit/` | DSH 零依赖工具包 collection:time / encoding / json / calculator / csv / regex / markdown / diff / stat / schema 十个确定性工具,统一入口一键安装(main 快照) |
| `dsh-web-search-free/` | 免密钥多后端搜索提供方(`free-web`):Bing → Mojeek → Baidu → So.com 故障转移 + 投毒检测,DeepSeek 原生 web_search 欠费替代,已发布 npm `dsh-web-search-free` |
| `dsh-compaction-counter/` | 上下文压缩计数:宿主会话投影折叠 `compaction/summary` / `end(error)` / `prune`,会话标题栏 chip 显示「压缩 N 次」+ 失败徽标 + 明细 tooltip;含折叠单测、client bundle 握手测试与 55 份真实日志回放校验 |

> `routing-suite-research/.gitmodules` 引用上游 GitHub 仓库(dsh-super-injector / dsh-router-standard),内容为当时快照,未以 submodule 形式纳入。
> `dsh-at-file/` 与 `dsh-toolkit/` 为 [omdsh-dev](https://github.com/omdsh-dev) 上游仓库的发布态快照(v0.4.0 / main),本地开发与安装即以本目录内容为准;安装命令见各子目录 README。

## Plugin install

```sh
# dsh-at-file (v0.4.0)
dsh plugin --profile web add https://github.com/omdsh-dev/dsh-at-file/archive/refs/tags/v0.4.0.tar.gz

# dsh-toolkit 子包(独立 bundle,推荐)或 meta 包,见 dsh-toolkit/README.md

# dsh-web-search-free (free-web,免密钥)
npm install -g dsh-web-search-free   # 或 profile 内 link: 本地目录,见 dsh-web-search-free/README.md
# 然后按插件 README 在 profile cordis.patch.yml 挂载并把 web.searchProvider 切到 free-web

# dsh-compaction-counter (上下文压缩计数)
# 构建: node mydsh/dsh-compaction-counter/build.mjs
# 安装(主目标是桌面端 desktop profile;web 可选):
#   node mydsh/dsh-compaction-counter/tools/install-into-profile.mjs "%USERPROFILE%\.dsh\profiles\desktop" dsh-compaction-counter <pluginDir>
# 然后在该 profile 目录执行 pnpm install;运行中的 Desktop 宿主会热挂载,未生效则重启应用;详见 dsh-compaction-counter/README.md
```

## Development

- Node.js 22.19+
- pnpm (`corepack enable`)
- TypeScript

```sh
pnpm install
pnpm run typecheck
```

## Resources

- [DeepSeek Harness docs](https://github.com/deepseek-ai/deepseek-harness/tree/master/docs)
- [Tool authoring reference](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/cookbook/adding-a-tool.md)
