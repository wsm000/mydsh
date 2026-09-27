import test from "node:test";
import assert from "node:assert/strict";
import {
  executeModeCommand,
  formatModeList,
  parseModeCommand,
  resolveModeTarget,
  selectedPresetId
} from "../src/index.js";

const presets = [
  { id: "minimal", name: "极简模式" },
  { id: "standard", name: "标准模式" }
];

function invocation(rawInput, options = {}) {
  const events = options.events ?? [];
  const session = {
    events,
    header: { agentPreset: options.headerPreset ?? "minimal" },
    append(type, data) { events.push({ type, data }); }
  };
  const agent = {
    id: "session-1",
    status: options.status ?? "idle",
    ctx: {},
    session,
    whenIdle: async () => {},
    runMaintenance: async (task) => task(new AbortController().signal)
  };
  return {
    agent,
    signal: options.signal ?? new AbortController().signal,
    rawInput
  };
}

test("parses the four mode forms", () => {
  assert.deepEqual(parseModeCommand(""), { kind: "show" });
  assert.deepEqual(parseModeCommand("list"), { kind: "list" });
  assert.deepEqual(parseModeCommand(" show "), { kind: "show" });
  assert.deepEqual(parseModeCommand("off"), { kind: "off" });
  assert.deepEqual(parseModeCommand("标准模式"), { kind: "select", query: "标准模式" });
});

test("resolves ids before display names and rejects ambiguous names", () => {
  assert.equal(resolveModeTarget(presets, "STANDARD").preset.id, "standard");
  assert.equal(resolveModeTarget(presets, "极简模式").preset.id, "minimal");
  assert.deepEqual(resolveModeTarget([{ id: "a", name: "same" }, { id: "b", name: "same" }], "same").ambiguous.map((p) => p.id), ["a", "b"]);
});

test("restores the newest persisted selection from multiple switches", () => {
  const restoredSession = {
    header: { agentPreset: "minimal" },
    events: [
      { type: "agent-preset/selected", data: { agentPreset: "standard" } },
      { type: "unrelated", data: {} },
      { type: "agent-preset/selected", data: { agentPreset: "minimal" } }
    ]
  };
  assert.equal(selectedPresetId(restoredSession), "minimal");
});

test("lists and switches a session, including /mode off", async () => {
  const calls = [];
  const ctx = {
    agentPresets: {
      defaultId: "minimal",
      async list() { return presets; },
      async recompose(_ctx, id) { calls.push(id); return presets.find((preset) => preset.id === id); }
    }
  };
  const list = await executeModeCommand(ctx, invocation("list"));
  assert.match(list.text, /standard/);
  const switchedInvocation = invocation("standard");
  const switched = await executeModeCommand(ctx, switchedInvocation);
  assert.equal(switched.kind, "success");
  assert.deepEqual(calls, ["standard"]);
  assert.equal(switchedInvocation.agent.session.events.at(-1).data.agentPreset, "standard");
  const offInvocation = invocation("off", { events: switchedInvocation.agent.session.events });
  offInvocation.agent.session.header.agentPreset = "standard";
  const off = await executeModeCommand(ctx, offInvocation);
  assert.equal(off.kind, "success");
  assert.deepEqual(calls, ["standard", "minimal"]);
});

test("formats current and default markers", () => {
  const text = formatModeList(presets, "standard", "minimal");
  assert.match(text, /极简模式 \[minimal\].*默认/);
  assert.match(text, /标准模式 \[standard\].*当前/);
});

test("removes the abort listener after a busy agent becomes idle", async () => {
  const controller = new AbortController();
  let added = 0;
  let removed = 0;
  const signal = {
    get aborted() { return controller.signal.aborted; },
    addEventListener(...args) {
      added += 1;
      return controller.signal.addEventListener(...args);
    },
    removeEventListener(...args) {
      removed += 1;
      return controller.signal.removeEventListener(...args);
    }
  };
  const ctx = {
    agentPresets: {
      defaultId: "minimal",
      async list() { return presets; },
      async recompose(_ctx, id) { return presets.find((preset) => preset.id === id); }
    }
  };
  const request = invocation("standard", { status: "running", signal });
  request.agent.whenIdle = async () => { request.agent.status = "idle"; };

  const result = await executeModeCommand(ctx, request);

  assert.equal(result.kind, "success");
  assert.equal(added, 1);
  assert.equal(removed, 1);
});
