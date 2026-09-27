# dsh-session-cost

一个独立的 DeepSeek Harness Web 插件，在会话顶栏（“…”）里显示一块实时状态条，包含三项：

1. **会话费用估算（CNY）** —— 由 `tokenUsage` 投影 × 当前模型的单价换算而来。
2. **步数** —— 该对话已经结束的模型步骤数（`sessionStats` 投影的 `steps`）。
3. **峰谷（峰/谷）时段指示** —— 实时显示现在是 DeepSeek 峰谷定价的 **高峰时段** 还是 **空闲时段（半价）**，每 30 秒刷新一次，帮你挑平价时段使用。

> 说明：DeepSeek 自 **2026-08-17** 起实行峰谷定价 ——
> 高峰时段为北京时间 **9:00–12:00、14:00–18:00（仅周一至周五）**；**每周双休日（周六、周日）全天按空闲计**，
> 其余时间为空闲时段，**空闲价格为高峰的一半**。

---

## 价格表（高峰价，空闲自动 ×0.5）

2026-09 起 DeepSeek 官方价目改为 **美元计价**，插件内按 `USD_TO_CNY` 换算成 ¥ 展示。
价格集中维护在 [`src/client/pricing.ts`](src/client/pricing.ts) 的 `COST_PRICES_USD`，改价直接改那张表：

官方价（每 1M tokens，PEAK，USD）：

| 模型 | 输入（缓存未命中） | 缓存命中 | 输出 |
|---|---|---|---|
| deepseek-flash | $0.30 | $0.006 | $1.20 |
| deepseek-v4-pro | $1.32 | $0.044 | $3.96 |

> 注：旧模型名 `deepseek-v4-flash` / `deepseek-v4-flash-vision-exp` 仍可用，但实际由 V4.1-Flash 服务并按 Flash 价计费，
> 所以表里这三个 id 用同一行价格。峰谷窗口未变：北京时间 9:00–12:00、14:00–18:00（仅工作日）为高峰，
> 双休日全天空闲。汇率 `USD_TO_CNY` 为固定参考值，¥ 金额仅为界面估算参考，实际账单以供应商结算为准。

---

## 结构

```
src/client/index.ts    apply：注册 locale 字典 + conversation.session.header.actions 插槽
src/client/pricing.ts  价格表、峰谷窗口、估算公式（纯函数）
src/client/locales.ts  中英文案
src/client/styles.ts   内联样式（dsh_sc 前缀，--dsw-alias-* 设计 token）
src/index.ts           host 空实现（仅为了让 Loader 形成活动 fiber，从而被 client 注册表发现）
build.mjs              esbuild 单文件 client 构建（ModuleLoader CJS 协议）
```

### 构建

用兄弟插件 `dsh-file-panel` 的 esbuild 独立二进制：

```bash
node build.mjs
```

生成 `lib/index.js`（host 空实现）与 `lib/client.js`（浏览器端，由
`/plugins/dsh-session-cost/client.js` 提供）。

### 安装到 profile

- 在 `~/.dsh/profiles/web/node_modules` 中建立到本目录的 **Junction**；
- 在 `~/.dsh/profiles/web/package.json` 的 `dependencies` 加
  `"dsh-session-cost": "link:C:/.../mydsh/dsh-session-cost"`，并在
  `dsh.profile.bundles` 加入 `"dsh-session-cost"`；
- 重启服务后，浏览器**硬刷新（Ctrl+Shift+R）**即可看到顶栏状态条。

---

## 许可

MIT
