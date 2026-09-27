window.__ModuleLoader__.load({ id: 'dsh-session-cost', factory: (require) => { var module = { exports: {} }; var exports = module.exports;
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
  CostChip: () => CostChip,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react = require("react");

// src/client/locales.ts
var zh = {
  "cost.label": "\u4F1A\u8BDD\u8D39\u7528",
  "cost.value": "\u2248 \xA5{amount}",
  "cost.tooltip": "\u6309 {model} \u7684\u5355\u4EF7\u4F30\u7B97\u6574\u4E2A\u4F1A\u8BDD\u7684\u8D39\u7528\uFF1B\u53C2\u8003\u4EF7\uFF0C\u5B9E\u9645\u8D26\u5355\u53EF\u80FD\u56E0\u5CF0\u8C37\u65F6\u6BB5/\u4F18\u60E0\u800C\u4E0D\u540C\u3002",
  "steps.label": "\u6B65\u6570",
  "period.peak": "\u5F53\u524D\uFF1A\u9AD8\u5CF0\u65F6\u6BB5",
  "period.idle": "\u5F53\u524D\uFF1A\u7A7A\u95F2\u65F6\u6BB5\uFF08\u534A\u4EF7\uFF09",
  "period.peakShort": "\u9AD8\u5CF0\u4EF7",
  "period.idleShort": "\u7A7A\u95F2\u534A\u4EF7",
  "period.tooltip.peak": "\u9AD8\u5CF0\u65F6\u6BB5\uFF08\u4EC5\u5DE5\u4F5C\u65E5\uFF0C\u5317\u4EAC\u65F6\u95F4 9:00\u201312:00\u300114:00\u201318:00\uFF09\uFF0C\u4EF7\u683C\u4E3A\u7A7A\u95F2\u65F6\u6BB5\u7684\u4E24\u500D\uFF1B\u53CC\u4F11\u65E5\u5168\u5929\u7A7A\u95F2\u3002",
  "period.tooltip.idle": "\u7A7A\u95F2\u65F6\u6BB5\uFF08\u6BCF\u5468\u53CC\u4F11\u65E5\u5168\u5929\uFF0C\u4EE5\u53CA\u5DE5\u4F5C\u65E5\u5317\u4EAC\u65F6\u95F4 0:00\u20139:00\u300112:00\u201314:00\u300118:00\u201324:00\uFF09\uFF0C\u4EF7\u683C\u4E3A\u9AD8\u5CF0\u65F6\u6BB5\u7684\u4E00\u534A\u3002"
};
var en = {
  "cost.label": "Session cost",
  "cost.value": "\u2248 \xA5{amount}",
  "cost.tooltip": "Estimated for the whole session at {model} unit prices; reference only, actual billing may differ by peak/valley period or discounts.",
  "steps.label": "Steps",
  "period.peak": "Currently: peak hours",
  "period.idle": "Currently: off-peak (half price)",
  "period.peakShort": "peak rate",
  "period.idleShort": "off-peak (half)",
  "period.tooltip.peak": "Peak hours (weekdays only, Beijing 9:00\u201312:00 and 14:00\u201318:00); prices are 2\xD7 the off-peak rate. Weekends are off-peak all day.",
  "period.tooltip.idle": "Off-peak hours (all day Saturday & Sunday, plus weekdays 0:00\u20139:00, 12:00\u201314:00, 18:00\u201324:00 Beijing); prices are half the peak rate."
};
var NS = "session-cost";

// src/client/styles.ts
var STYLE_ID = "dsh-session-cost-style";
var cssText = `
.dsh_sc_chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
  font-size: 12px;
  line-height: 18px;
}
.dsh_sc_item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
}
.dsh_sc_itemLabel {
  color: var(--dsw-alias-label-tertiary);
}
.dsh_sc_amount {
  color: var(--dsw-alias-label-primary);
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}
.dsh_sc_period {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 8px;
  border-radius: 999px;
  cursor: default;
  white-space: nowrap;
}
.dsh_sc_periodDot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex: none;
}
.dsh_sc_period--peak .dsh_sc_periodDot {
  background: var(--dsw-alias-state-error-primary, #e5484d);
}
.dsh_sc_period--idle .dsh_sc_periodDot {
  background: var(--dsw-alias-state-success-primary, #30a46c);
}
.dsh_sc_period--peak {
  color: var(--dsw-alias-state-error-primary, #e5484d);
}
.dsh_sc_period--idle {
  color: var(--dsw-alias-state-success-primary, #30a46c);
}
`;
function adoptStyles() {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = cssText;
  document.head.appendChild(style);
}

// src/client/pricing.ts
var PEAK_WINDOWS = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60]
];
var IDLE_PRICE_FACTOR = 0.5;
var USD_TO_CNY = 7.1;
var DEFAULT_MODEL = "deepseek-flash";
var COST_PRICES_USD = {
  "deepseek-flash": { input: 0.3, cacheHit: 6e-3, output: 1.2 },
  // Legacy ids, still accepted and billed at the Flash price:
  "deepseek-v4-flash": { input: 0.3, cacheHit: 6e-3, output: 1.2 },
  "deepseek-v4-flash-vision-exp": { input: 0.3, cacheHit: 6e-3, output: 1.2 },
  "deepseek-v4-pro": { input: 1.32, cacheHit: 0.044, output: 3.96 }
};
function toCny(price) {
  return {
    input: price.input * USD_TO_CNY,
    cacheHit: price.cacheHit * USD_TO_CNY,
    output: price.output * USD_TO_CNY
  };
}
function priceOf(modelId) {
  const id = modelId ?? DEFAULT_MODEL;
  return toCny(COST_PRICES_USD[id] ?? COST_PRICES_USD[DEFAULT_MODEL]);
}
function isPeakMinute(minutesOfDay) {
  return PEAK_WINDOWS.some(([start, end]) => minutesOfDay >= start && minutesOfDay < end);
}
function isPeakTime(minutesOfDay, weekday) {
  if (weekday === 0 || weekday === 6) return false;
  return isPeakMinute(minutesOfDay);
}
function estimateCost(uncachedInput, cacheRead, output, peak, price) {
  const factor = peak ? 1 : IDLE_PRICE_FACTOR;
  return factor * (uncachedInput / 1e6 * price.input + cacheRead / 1e6 * price.cacheHit + output / 1e6 * price.output);
}
function formatCny(amount) {
  if (!Number.isFinite(amount) || amount <= 0) return "0.00";
  if (amount < 0.01) return "<0.01";
  return amount.toFixed(2);
}

// src/client/index.ts
var import_jsx_runtime = require("react/jsx-runtime");
var inject = ["slots", "locale"];
var BEIJING_OFFSET_MIN = 8 * 60;
var PERIOD_TICK_MS = 3e4;
function beijingClock(now) {
  const shifted = new Date(now.getTime() + BEIJING_OFFSET_MIN * 6e4);
  return {
    minute: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay()
  };
}
function CostChip({ useProjection, t }) {
  const tokenUsage = useProjection("tokenUsage");
  const sessionStats = useProjection("sessionStats");
  const [clock, setClock] = (0, import_react.useState)(() => beijingClock(/* @__PURE__ */ new Date()));
  (0, import_react.useEffect)(() => {
    const id = window.setInterval(() => setClock(beijingClock(/* @__PURE__ */ new Date())), PERIOD_TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  const peak = isPeakTime(clock.minute, clock.weekday);
  const price = priceOf(DEFAULT_MODEL);
  const amount = (0, import_react.useMemo)(() => {
    if (tokenUsage === void 0) return null;
    return estimateCost(
      tokenUsage.uncachedInputTokens ?? 0,
      tokenUsage.cacheReadTokens ?? 0,
      tokenUsage.outputTokens ?? 0,
      peak,
      price
    );
  }, [tokenUsage, peak, price]);
  const steps = typeof sessionStats?.steps === "number" ? sessionStats.steps : null;
  const hasAnything = amount !== null && amount > 49e-4 || steps !== null && steps > 0;
  if (!hasAnything) return null;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsh_sc_chip", role: "group", "aria-label": t("cost.label"), children: [
    amount !== null && amount > 49e-4 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsh_sc_item", title: t("cost.tooltip", { model: DEFAULT_MODEL }), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh_sc_itemLabel", children: t("cost.label") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh_sc_amount", children: t("cost.value", { amount: formatCny(amount) }) })
    ] }),
    steps !== null && steps > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { className: "dsh_sc_item", title: t("steps.label"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh_sc_itemLabel", children: t("steps.label") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh_sc_amount", children: steps })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "span",
      {
        className: `dsh_sc_period ${peak ? "dsh_sc_period--peak" : "dsh_sc_period--idle"}`,
        title: peak ? t("period.tooltip.peak") : t("period.tooltip.idle"),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "dsh_sc_periodDot", "aria-hidden": "true" }),
          peak ? t("period.peak") : t("period.idle")
        ]
      }
    )
  ] });
}
function apply(ctx) {
  adoptStyles();
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-session-cost: dictionaries");
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
    name: "conversation.session.header.actions",
    id: "session-cost",
    order: 60,
    locale: NS
  }, CostChip));
}
return module.exports; } });
//# sourceMappingURL=client.js.map
