const USAGE = "用法：/mode list | /mode show | /mode off | /mode <预设 id 或名称>";

/**
 * Parse only the grammar owned by /mode. Other input is a preset selector so
 * display names containing spaces remain usable.
 */
export function parseModeCommand(rawInput) {
  const input = rawInput.trim();
  const control = input.toLocaleLowerCase();
  if (input.length === 0 || control === "show") return { kind: "show" };
  if (control === "list") return { kind: "list" };
  if (control === "off") return { kind: "off" };
  return { kind: "select", query: input };
}

/** The latest durable preset selection, falling back to the session header. */
export function selectedPresetId(session) {
  for (let index = session.events.length - 1; index >= 0; index -= 1) {
    const event = session.events[index];
    if (event?.type === "agent-preset/selected" && typeof event.data?.agentPreset === "string") {
      return event.data.agentPreset;
    }
  }
  return typeof session.header?.agentPreset === "string" ? session.header.agentPreset : undefined;
}

function normalized(value) {
  return value.trim().toLocaleLowerCase();
}

function displayName(preset) {
  return typeof preset.name === "string" && preset.name.trim().length > 0 ? preset.name.trim() : preset.id;
}

function presetText(preset, markers = "") {
  return `${markers}${displayName(preset)} [${preset.id}]`;
}

/** Resolve an id first, then a unique display name. */
export function resolveModeTarget(presets, query) {
  const key = normalized(query);
  const byId = presets.find((preset) => normalized(preset.id) === key);
  if (byId !== undefined) return { preset: byId };
  const byName = presets.filter((preset) => normalized(displayName(preset)) === key);
  if (byName.length === 1) return { preset: byName[0] };
  if (byName.length > 1) return { ambiguous: byName };
  return {};
}

export function formatModeList(presets, currentId, defaultId) {
  if (presets.length === 0) return "没有可用模式。";
  const lines = ["可用模式："];
  for (const preset of presets) {
    const markers = [
      preset.id === currentId ? "当前" : "",
      preset.id === defaultId ? "默认" : ""
    ].filter(Boolean);
    const suffix = markers.length === 0 ? "" : ` (${markers.join(" / ")})`;
    const broken = preset.broken === undefined ? "" : ` [不可用：${preset.broken}]`;
    lines.push(`- ${presetText(preset)}${suffix}${broken}`);
  }
  lines.push("使用 /mode <id 或名称> 切换，/mode off 回到默认模式。");
  return lines.join("\n");
}

function formatCurrent(preset, currentId, defaultId) {
  const current = preset === undefined ? currentId ?? "未设置" : presetText(preset);
  const defaultText = defaultId ?? "未设置";
  return `当前模式：${current}\n默认模式：${defaultText}\n使用 /mode list 查看可用模式。`;
}

function commandError(text) {
  return { kind: "error", text };
}

function abortError() {
  return new Error("mode switch cancelled");
}

async function waitForIdle(agent, signal) {
  while (agent.status === "running") {
    if (signal.aborted) throw abortError();
    let rejectOnAbort;
    const aborted = new Promise((_, reject) => {
      rejectOnAbort = () => reject(abortError());
      signal.addEventListener("abort", rejectOnAbort, { once: true });
    });
    try {
      await Promise.race([agent.whenIdle(), aborted]);
    } finally {
      signal.removeEventListener("abort", rejectOnAbort);
    }
  }
}

/**
 * Switch after the current activity reaches an idle boundary. This keeps a
 * running model request on its original tool catalog while still making the
 * command effective without creating a new conversation.
 */
async function recomposeWhenIdle(ctx, invocation, targetId) {
  const { agent, signal } = invocation;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    await waitForIdle(agent, signal);
    try {
      return await agent.runMaintenance(async (maintenanceSignal) => {
        if (signal.aborted || maintenanceSignal.aborted) throw abortError();
        const preset = await ctx.agentPresets.recompose(agent.ctx, targetId);
        agent.session.append("agent-preset/selected", { agentPreset: preset.id });
        return preset;
      });
    } catch (error) {
      if (signal.aborted) throw abortError();
      if (agent.status === "running") continue;
      throw error;
    }
  }
  throw new Error("the agent stayed busy while changing mode");
}

async function executeParsed(ctx, invocation, parsed) {
  const { agent } = invocation;
  const currentId = selectedPresetId(agent.session);
  const defaultId = ctx.agentPresets.defaultId;
  if (parsed.kind === "list") {
    return {
      kind: "success",
      text: formatModeList(await ctx.agentPresets.list(), currentId, defaultId)
    };
  }

  const presets = await ctx.agentPresets.list();
  if (parsed.kind === "show") {
    return {
      kind: "success",
      text: formatCurrent(presets.find((preset) => preset.id === currentId), currentId, defaultId)
    };
  }

  const targetId = parsed.kind === "off" ? defaultId : resolveModeTarget(presets, parsed.query).preset?.id;
  if (targetId === undefined) {
    if (parsed.kind === "off") return commandError(`没有配置默认模式。${USAGE}`);
    const resolved = resolveModeTarget(presets, parsed.query);
    if (resolved.ambiguous !== undefined) {
      return commandError(`模式名称不唯一：${resolved.ambiguous.map((preset) => preset.id).join(", ")}。请使用 id。`);
    }
    return commandError(`找不到模式 “${parsed.query}”。${USAGE}`);
  }

  const target = presets.find((preset) => preset.id === targetId);
  if (target?.broken !== undefined) return commandError(`模式 ${presetText(target)} 不可用：${target.broken}`);
  if (targetId === currentId) {
    return {
      kind: "success",
      text: `当前已经是 ${presetText(target ?? { id: targetId })}。`
    };
  }

  try {
    const preset = await recomposeWhenIdle(ctx, invocation, targetId);
    return {
      kind: "success",
      text: `已切换到 ${presetText(preset)}。当前会话立即生效，后续恢复也会保留。`
    };
  } catch (error) {
    if (invocation.signal.aborted || String(error?.message).includes("cancelled")) {
      return commandError("模式切换已取消。");
    }
    return commandError(`模式切换失败：${String(error?.message ?? error)}`);
  }
}

const pendingBySession = new Map();

function enqueue(sessionId, operation) {
  const previous = pendingBySession.get(sessionId) ?? Promise.resolve();
  const current = previous.then(operation, operation);
  const settled = current.then(() => undefined, () => undefined);
  pendingBySession.set(sessionId, settled);
  settled.then(() => {
    if (pendingBySession.get(sessionId) === settled) pendingBySession.delete(sessionId);
  });
  return current;
}

export function executeModeCommand(ctx, invocation) {
  const parsed = parseModeCommand(invocation.rawInput);
  return enqueue(invocation.agent.id, () => executeParsed(ctx, invocation, parsed));
}

export const name = "command-mode";
export const inject = ["commands", "agentPresets"];

export function apply(ctx) {
  ctx.commands.register({
    name: "mode",
    description: "list, inspect, and switch the current agent preset",
    input: { hint: "[list|show|off|<preset id or name>]" },
    handler: (invocation) => executeModeCommand(ctx, invocation)
  });
}
