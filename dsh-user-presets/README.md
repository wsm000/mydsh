# @local/dsh-user-presets

DSH 0.2.0 removed the legacy `$DSH_HOME/.agent-presets/<id>/` preset directory
("Nothing reads that directory any more" — `dsh-agent-preset` skill
`editing-cordis-compositions`). This bundle re-declares the three user presets as
`@deepseek-ai/dsh-agent-preset` rows so both profiles (web / desktop) can load them
with a `link:` dependency.

- `standard95` — 标准模式（95% 压缩）
- `grok-no-web` — 标准模式（95% 压缩）· Grok 无网页
- `code-agentrouter` — Code + AgentRouter Subagents (experimental)

`plugins` are verbatim from the legacy `agent.cordis.yml` files; the only edit is
`workflow-worker-thread` → `workflow-ptc` (the old package was removed in 0.2.0).

Install (per profile): add to `package.json`
`"@local/dsh-user-presets": "link:C:/Users/86150/Documents/deepseekharness/mydsh/dsh-user-presets"`
and to `dsh.profile.bundles`, then `pnpm install` and restart.
