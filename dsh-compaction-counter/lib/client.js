window.__ModuleLoader__.load({ id: 'dsh-compaction-counter', factory: (require) => { var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  CompactionChip: () => CompactionChip,
  CompactionChipView: () => CompactionChipView,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");

// src/client/locales.ts
var zh = {
  "compact.label": "\u538B\u7F29",
  "compact.value": "{count} \u6B21",
  "compact.failed": "\u5931\u8D25 {count}",
  "compact.aria": "\u672C\u4F1A\u8BDD\u4E0A\u4E0B\u6587\u538B\u7F29\u8BA1\u6570",
  "compact.tip.auto": "\u81EA\u52A8\u538B\u7F29\uFF1A{count} \u6B21",
  "compact.tip.manual": "\u624B\u52A8\u538B\u7F29\uFF08/compact\uFF09\uFF1A{count} \u6B21",
  "compact.tip.failed": "\u538B\u7F29\u5931\u8D25\uFF1A{count} \u6B21",
  "compact.tip.shadowed": "\u7D2F\u8BA1\u6298\u53E0\u4E0A\u4E0B\u6587\uFF1A\u2248 {tokens} tokens",
  "compact.tip.prunes": "\u5DE5\u5177\u7ED3\u679C\u4FEE\u526A\uFF1A{count} \u6B21\uFF08\u2248 {tokens} tokens\uFF09",
  "compact.tip.last": "\u6700\u8FD1\u4E00\u6B21\uFF1A{time} \xB7 {model}\uFF08{provider}\uFF0C\u2248 {tokens} tokens\uFF09"
};
var en = {
  "compact.label": "Compacted",
  "compact.value": "{count}\xD7",
  "compact.failed": "{count} failed",
  "compact.aria": "Context compactions in this session",
  "compact.tip.auto": "Automatic compactions: {count}",
  "compact.tip.manual": "Manual compactions (/compact): {count}",
  "compact.tip.failed": "Failed compact attempts: {count}",
  "compact.tip.shadowed": "Context folded away in total: \u2248 {tokens} tokens",
  "compact.tip.prunes": "Tool-result prunes: {count} (\u2248 {tokens} tokens)",
  "compact.tip.last": "Latest: {time} \xB7 {model} ({provider}, \u2248 {tokens} tokens)"
};
var NS = "compaction-counter";

// src/client/styles.ts
var STYLE_ID = "dsh-compaction-counter-style";
var cssText = `
.dsh_cc_chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
  white-space: nowrap;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
  cursor: default;
}
.dsh_cc_label {
  color: var(--dsw-alias-label-tertiary);
}
.dsh_cc_count {
  color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.dsh_cc_failed {
  padding: 0 6px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--dsw-alias-state-error-primary, #e5484d);
  background: var(--dsw-alias-state-error-secondary, rgba(229, 72, 77, 0.12));
}
`;
function adoptStyles() {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = cssText;
  document.head.appendChild(style);
}

// src/client/index.ts
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "locale"];
function formatTokens(value) {
  if (value < 1e3) return String(value);
  if (value < 1e6) return `${(value / 1e3).toFixed(value < 1e5 ? 1 : 0)}k`;
  return `${(value / 1e6).toFixed(2)}M`;
}
function formatTime(value) {
  const date = new Date(value);
  const pad = (part) => String(part).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
function CompactionChipView({ useProjection, t }) {
  const stats = useProjection("compactionStats");
  if (stats === void 0) return null;
  const { count, manual, failed, prunes, shadowedTokens, prunedTokens, lastTime, lastProvider, lastModel, lastShadowedTokens } = stats;
  const automatic = Math.max(0, count - manual);
  const lines = [t("compact.tip.auto", { count: automatic })];
  if (manual > 0) lines.push(t("compact.tip.manual", { count: manual }));
  if (failed > 0) lines.push(t("compact.tip.failed", { count: failed }));
  if (shadowedTokens > 0) lines.push(t("compact.tip.shadowed", { tokens: formatTokens(shadowedTokens) }));
  if (lastTime !== null && lastModel !== null) {
    lines.push(t("compact.tip.last", {
      time: formatTime(lastTime),
      model: lastModel,
      provider: lastProvider ?? "\u2014",
      tokens: formatTokens(lastShadowedTokens ?? 0)
    }));
  }
  if (prunes > 0) lines.push(t("compact.tip.prunes", { count: prunes, tokens: formatTokens(prunedTokens) }));
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsh_cc_chip", role: "group", "aria-label": t("compact.aria"), title: lines.join("\n"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh_cc_label", children: t("compact.label") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh_cc_count", children: t("compact.value", { count }) }),
    failed > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh_cc_failed", children: t("compact.failed", { count: failed }) })
  ] });
}
var CompactionChip = (0, import_react.memo)(CompactionChipView);
function apply(ctx) {
  adoptStyles();
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-compaction-counter: dictionaries");
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
    name: "conversation.session.header.actions",
    id: "compaction-counter",
    order: 61,
    locale: NS
  }, CompactionChip));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
