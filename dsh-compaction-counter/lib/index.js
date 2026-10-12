// src/types.ts
function emptyCompactionStats() {
  return {
    count: 0,
    manual: 0,
    failed: 0,
    shadowedTokens: 0,
    prunes: 0,
    prunedTokens: 0,
    lastTime: null,
    lastProvider: null,
    lastModel: null,
    lastShadowedTokens: null
  };
}
function isCount(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}
function isTokens(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}
function isNullableTokens(value) {
  return value === null || isTokens(value);
}
function isNullableString(value) {
  return value === null || typeof value === "string";
}
var compactionStatsSchema = {
  parse(value) {
    if (typeof value !== "object" || value === null) {
      throw new Error("compactionStats: expected an object");
    }
    const stats = value;
    const valid = isCount(stats.count) && isCount(stats.manual) && isCount(stats.failed) && isCount(stats.prunes) && isTokens(stats.shadowedTokens) && isTokens(stats.prunedTokens) && isNullableTokens(stats.lastTime) && isNullableTokens(stats.lastShadowedTokens) && isNullableString(stats.lastProvider) && isNullableString(stats.lastModel);
    if (!valid) throw new Error("compactionStats: invalid field");
    return value;
  }
};

// src/index.ts
var name = "dsh-compaction-counter";
var inject = ["sessionProjections"];
function shadowPrice(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0;
}
function foldCompactionStats(state, event) {
  switch (event.type) {
    case "compaction/summary": {
      const shadowed = shadowPrice(event.data.shadowedTokenCount);
      return {
        ...state,
        count: state.count + 1,
        manual: state.manual + (event.data.sourceCommandId === void 0 ? 0 : 1),
        shadowedTokens: state.shadowedTokens + shadowed,
        lastTime: event.time,
        lastProvider: typeof event.data.provider === "string" ? event.data.provider : null,
        lastModel: typeof event.data.model === "string" ? event.data.model : null,
        lastShadowedTokens: shadowed
      };
    }
    case "compaction/end":
      return event.data.error === void 0 ? state : { ...state, failed: state.failed + 1 };
    case "compaction/prune":
      return {
        ...state,
        prunes: state.prunes + 1,
        prunedTokens: state.prunedTokens + shadowPrice(event.data.shadowedTokenCount)
      };
    default:
      return state;
  }
}
var compactionStatsProjectionDefinition = {
  key: "compactionStats",
  stateVersion: 1,
  stateSchema: compactionStatsSchema,
  init: () => emptyCompactionStats(),
  apply: foldCompactionStats,
  wire: {
    viewSchema: compactionStatsSchema,
    view: (state) => state
  }
};
function apply(ctx) {
  ctx.sessionProjections.register(compactionStatsProjectionDefinition);
}
export {
  apply,
  compactionStatsSchema,
  emptyCompactionStats,
  foldCompactionStats,
  inject,
  name
};
//# sourceMappingURL=index.js.map
