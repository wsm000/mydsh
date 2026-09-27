/**
 * dsh-model-provider-filter
 * 
 * 恢复三级模型筛选：Provider -> Model -> Effort
 * 替换 DSH 默认的二级模型选择器（Model -> Effort）
 */

// 命名空间
const NS = "model-provider-filter";

// 国际化文案
const zh = {
  "provider.label": "供应商",
  "model.label": "模型",
  "effort.label": "推理强度",
  "provider.select": "选择供应商",
  "model.select": "选择模型",
  "effort.select": "选择推理强度",
  "trigger.aria": "选择模型",
  "trigger.ariaEffort": "选择模型和推理强度",
  "trigger.loading": "加载中...",
  "trigger.fallback": "选择模型",
  "error.action": "操作失败：{message}",
  "effort.providerDefault": "默认",
  "back": "返回"
};

const en = {
  "provider.label": "Provider",
  "model.label": "Model",
  "effort.label": "Effort",
  "provider.select": "Select provider",
  "model.select": "Select model",
  "effort.select": "Select effort",
  "trigger.aria": "Select model",
  "trigger.ariaEffort": "Select model and effort",
  "trigger.loading": "Loading...",
  "trigger.fallback": "Select model",
  "error.action": "Action failed: {message}",
  "effort.providerDefault": "Default",
  "back": "Back"
};

// 样式
const STYLE_ID = "dsh-model-provider-filter-style";
const cssText = `
.dsh_mpf_root { position: relative; display: inline-block; }
.dsh_mpf_trigger {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 12px; border: 1px solid var(--dsh-border, #d1d5db);
  border-radius: 6px; background: var(--dsh-bg, #ffffff);
  cursor: pointer; font-size: 13px; line-height: 1.4;
  color: var(--dsh-text, #111827); transition: all 0.15s ease;
}
.dsh_mpf_trigger:hover {
  background: var(--dsh-bg-hover, #f3f4f6);
  border-color: var(--dsh-border-hover, #9ca3af);
}
.dsh_mpf_trigger:disabled { opacity: 0.5; cursor: not-allowed; }
.dsh_mpf_triggerLabel { font-weight: 500; }
.dsh_mpf_triggerEffort { color: var(--dsh-text-secondary, #6b7280); font-size: 12px; }
.dsh_mpf_menu {
  position: fixed; z-index: 1000; min-width: 240px; max-width: 320px;
  max-height: 400px; overflow-y: auto;
  background: var(--dsh-bg, #ffffff);
  border: 1px solid var(--dsh-border, #d1d5db); border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06);
  padding: 4px;
}
.dsh_mpf_menuHeader {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; border-bottom: 1px solid var(--dsh-border, #e5e7eb);
  margin-bottom: 4px;
}
.dsh_mpf_menuBack {
  display: inline-flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; border: none; background: none;
  cursor: pointer; border-radius: 4px;
  color: var(--dsh-text-secondary, #6b7280);
}
.dsh_mpf_menuBack:hover {
  background: var(--dsh-bg-hover, #f3f4f6);
  color: var(--dsh-text, #111827);
}
.dsh_mpf_menuTitle { font-weight: 600; font-size: 13px; color: var(--dsh-text, #111827); }
.dsh_mpf_menuList { display: flex; flex-direction: column; gap: 2px; }
.dsh_mpf_menuItem {
  display: flex; align-items: center; justify-content: space-between;
  padding: 8px 12px; border: none; background: none;
  cursor: pointer; border-radius: 4px; font-size: 13px;
  color: var(--dsh-text, #111827); text-align: left; width: 100%;
}
.dsh_mpf_menuItem:hover { background: var(--dsh-bg-hover, #f3f4f6); }
.dsh_mpf_menuItemActive { background: var(--dsh-bg-active, #e5e7eb); font-weight: 500; }
.dsh_mpf_menuItemChevron { color: var(--dsh-text-secondary, #9ca3af); font-size: 12px; }
.dsh_mpf_menuItemLabel {
  flex: 1; min-width: 0; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.dsh_mpf_toast {
  position: fixed; bottom: 20px; left: 50%;
  transform: translateX(-50%); padding: 8px 16px;
  background: var(--dsh-error-bg, #fee2e2);
  color: var(--dsh-error-text, #991b1b);
  border-radius: 6px; font-size: 13px; z-index: 1001;
}
@media (prefers-color-scheme: dark) {
  .dsh_mpf_trigger, .dsh_mpf_menu {
    --dsh-bg: #1f2937; --dsh-bg-hover: #374151;
    --dsh-border: #4b5563; --dsh-border-hover: #6b7280;
    --dsh-text: #f9fafb; --dsh-text-secondary: #9ca3af;
  }
}
`;

// 注入样式
function adoptStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = cssText;
  document.head.appendChild(style);
}

/**
 * 三级模型选择器组件
 */
function ModelProviderFilter({ locked, available, directory, load, select, t }) {
  const React = window.__ModuleLoader__.require("react");
  const { useState, useEffect, useMemo, useRef, useCallback } = React;
  
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState("provider");
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [menuPos, setMenuPos] = useState(null);
  const [toast, setToast] = useState(null);
  
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const toastSeq = useRef(0);
  
  const state = React.useSyncExternalStore(
    (fn) => directory.subscribe(fn),
    () => directory.getSnapshot()
  );
  
  const providers = useMemo(() => {
    return state.groups.map(group => ({
      id: group.id,
      name: group.name || group.id,
      models: group.models
    }));
  }, [state.groups]);

  const currentProviderModels = useMemo(() => {
    if (!selectedProvider) return [];
    const provider = providers.find(p => p.id === selectedProvider);
    return provider ? provider.models : [];
  }, [providers, selectedProvider]);

  const currentModelEfforts = useMemo(() => {
    if (!selectedModel) return [];
    const model = currentProviderModels.find(m => m.id === selectedModel);
    if (!model || !model.reasoning) return [];
    const efforts = [...model.reasoning.efforts];
    if (model.reasoning.defaultEffort !== undefined) {
      efforts.unshift({ id: undefined, name: t("effort.providerDefault") });
    }
    return efforts;
  }, [currentProviderModels, selectedModel, t]);

  const currentSelection = useMemo(() => {
    if (!state.current) return null;
    const provider = providers.find(p => p.id === state.current.provider);
    const model = provider?.models.find(m => m.id === state.current.model);
    return {
      provider: provider?.name || state.current.provider,
      model: model?.name || state.current.model,
      effort: state.current.reasoningEffort
    };
  }, [state.current, providers]);

  const modelLabel = currentSelection?.model || t("trigger.fallback");
  const effortLabel = currentSelection?.effort || "";
  const triggerLabel = effortLabel ? `${modelLabel} · ${effortLabel}` : modelLabel;

  const show = useCallback(() => {
    setLevel("provider");
    setSelectedProvider(null);
    setSelectedModel(null);
    setOpen(true);
    load();
  }, [load]);

  const close = useCallback((restoreFocus = false) => {
    setOpen(false);
    setLevel("provider");
    setSelectedProvider(null);
    setSelectedModel(null);
    if (restoreFocus) {
      setTimeout(() => triggerRef.current?.focus(), 0);
    }
  }, []);

  const chooseProvider = useCallback((providerId) => {
    setSelectedProvider(providerId);
    setLevel("model");
  }, []);

  const doSelect = useCallback((selection) => {
    select(selection).then((accepted) => {
      if (accepted) {
        close(true);
      } else {
        const message = directory.getSnapshot().error;
        if (message) {
          toastSeq.current += 1;
          setToast({ seq: toastSeq.current, text: t("error.action", { message }) });
        }
      }
    });
  }, [select, close, directory, t]);

  const chooseModel = useCallback((modelId) => {
    const model = currentProviderModels.find(m => m.id === modelId);
    if (model?.reasoning) {
      setSelectedModel(modelId);
      setLevel("effort");
    } else {
      doSelect({ provider: selectedProvider, model: modelId });
    }
  }, [currentProviderModels, selectedProvider, doSelect]);

  const chooseEffort = useCallback((effortId) => {
    doSelect({ provider: selectedProvider, model: selectedModel, reasoningEffort: effortId });
  }, [selectedProvider, selectedModel, doSelect]);

  const goBack = useCallback(() => {
    if (level === "effort") setLevel("model");
    else if (level === "model") {
      setLevel("provider");
      setSelectedProvider(null);
    }
  }, [level]);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const closeOutside = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      if (menuRef.current?.contains(event.target)) return;
      close();
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open, close]);

  // 菜单定位
  useEffect(() => {
    if (!open) { setMenuPos(null); return; }
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const MARGIN = 12;
      const lw = menuRef.current?.offsetWidth ?? 0;
      const lh = menuRef.current?.offsetHeight ?? 0;
      let x = rect.right - lw;
      let y = rect.top - 8 - lh;
      if (lw > 0) x = Math.min(Math.max(x, MARGIN), window.innerWidth - lw - MARGIN);
      if (lh > 0) y = Math.min(Math.max(y, MARGIN), window.innerHeight - lh - MARGIN);
      setMenuPos({ left: x, top: y });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, level]);

  // Toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!available) return null;

  const { createElement: h, Fragment } = React;

  // 渲染菜单内容
  const renderMenuContent = () => {
    if (level === "provider") {
      return h(Fragment, null,
        h("div", { className: "dsh_mpf_menuHeader" },
          h("span", { className: "dsh_mpf_menuTitle" }, t("provider.select"))
        ),
        h("div", { className: "dsh_mpf_menuList" },
          providers.map(provider =>
            h("button", {
              key: provider.id,
              className: "dsh_mpf_menuItem",
              onClick: () => chooseProvider(provider.id)
            },
              h("span", { className: "dsh_mpf_menuItemLabel" }, provider.name),
              h("span", { className: "dsh_mpf_menuItemChevron" }, "›")
            )
          )
        )
      );
    }

    if (level === "model") {
      return h(Fragment, null,
        h("div", { className: "dsh_mpf_menuHeader" },
          h("button", { className: "dsh_mpf_menuBack", onClick: goBack, "aria-label": t("back") }, "‹"),
          h("span", { className: "dsh_mpf_menuTitle" }, t("model.select"))
        ),
        h("div", { className: "dsh_mpf_menuList" },
          currentProviderModels.map(model =>
            h("button", {
              key: model.id,
              className: "dsh_mpf_menuItem",
              onClick: () => chooseModel(model.id)
            },
              h("span", { className: "dsh_mpf_menuItemLabel" }, model.name || model.id),
              model.reasoning && h("span", { className: "dsh_mpf_menuItemChevron" }, "›")
            )
          )
        )
      );
    }

    if (level === "effort") {
      return h(Fragment, null,
        h("div", { className: "dsh_mpf_menuHeader" },
          h("button", { className: "dsh_mpf_menuBack", onClick: goBack, "aria-label": t("back") }, "‹"),
          h("span", { className: "dsh_mpf_menuTitle" }, t("effort.select"))
        ),
        h("div", { className: "dsh_mpf_menuList" },
          currentModelEfforts.map(effort =>
            h("button", {
              key: effort.id ?? "default",
              className: "dsh_mpf_menuItem",
              onClick: () => chooseEffort(effort.id)
            },
              h("span", { className: "dsh_mpf_menuItemLabel" }, effort.name)
            )
          )
        )
      );
    }
    return null;
  };

  return h("div", { ref: rootRef, className: "dsh_mpf_root" },
    h("button", {
      ref: triggerRef,
      type: "button",
      className: "dsh_mpf_trigger",
      "aria-label": triggerLabel,
      "aria-haspopup": "menu",
      "aria-expanded": open,
      disabled: locked,
      onClick: () => open ? close(true) : show()
    },
      h("span", { className: "dsh_mpf_triggerLabel" }, modelLabel),
      effortLabel && h("span", { className: "dsh_mpf_triggerEffort" }, effortLabel)
    ),
    open && menuPos && h("div", {
      ref: menuRef,
      className: "dsh_mpf_menu",
      style: { left: menuPos.left, top: menuPos.top },
      role: "menu"
    }, renderMenuContent()),
    toast && h("div", { key: toast.seq, className: "dsh_mpf_toast", role: "alert" }, toast.text)
  );
}

/**
 * 插件入口
 */
function apply(ctx) {
  adoptStyles();
  
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "model-provider-filter: dictionaries");
  const t = ctx.locale.bind(NS);
  
  ctx.inject(["slots", "modelDirectories"], (scope) => {
    const models = scope.modelDirectories;
    const sessions = scope.sessions;
    
    scope.slots.inject("conversation.input.model", () => scope.slots.register({
      name: "conversation.input.model",
      locale: NS,
      inject: (sessionId) => {
        const directory = models.directoryFor(sessionId);
        const available = sessions.subagentAddress(sessionId) === undefined;
        return {
          available,
          directory: directory.store,
          load: () => {
            if (available) directory.load().catch(() => {});
          },
          select: (selection) => available 
            ? directory.select(selection).then(() => true, () => false) 
            : Promise.resolve(false)
        };
      }
    }, ModelProviderFilter));
  });
}

module.exports = { name: "dsh-model-provider-filter", inject: ["slots", "locale", "modelDirectories", "sessions"], apply };