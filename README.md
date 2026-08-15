# mydsh

My personal [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) plugins.

> Built on [Cordis](https://github.com/cordiverse/cordis) — everything is a plugin.

## Plugins

| 目录 | 说明 |
|---|---|
| `dsh-presets/band-router/` | Band Router (experimental):任务感知思维模式路由预设(spec/react/weak 三行为带 + 近距离引导 + 模式隔离) |
| `dsh-presets/repo-watch/` | 仓库巡检预设(自定义) |
| `routing-suite-research/` | dsh-routing-suite 研究套装:注入器 × 思维模式路由(preset 与安装链、研究报告) |

> `routing-suite-research/.gitmodules` 引用上游 GitHub 仓库(dsh-super-injector / dsh-router-standard),内容为当时快照,未以 submodule 形式纳入。

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
