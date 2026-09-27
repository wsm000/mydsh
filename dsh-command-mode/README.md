# dsh-command-mode

宿主级 `/mode` 命令，用于在当前 DeepSeek Harness 会话中持久化切换 agent preset。

```text
/mode list
/mode show
/mode <preset id 或显示名称>
/mode off
```

`/mode off` 会切换到命令执行时配置的默认 preset，并把该选择作为本会话的新持久记录；如果以后全局默认值改变，这个旧会话仍会保留当时选中的 preset。切换会等待正在运行的活动到达 idle 边界，然后立即重新绑定当前 agent；不会修改 `minimal` 或任何其他 preset 的工具定义。
