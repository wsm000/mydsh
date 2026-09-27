/**
 * `file-panel` locale namespace: the workspace file panel copy.
 * Chinese is the product copy; English mirrors it.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'action.aria': '打开工作区文件面板',
  'panel.title': '工作区文件',
  'panel.root': '工作区',
  'panel.up': '上一级',
  'panel.loading': '加载中…',
  'panel.empty': '（空目录）',
  'panel.error': '出错了：{message}',
  'panel.truncated': '目录条目过多，仅显示前 {count} 项',
  'action.refresh': '刷新',
  'action.newFile': '新建文件',
  'close': '关闭',
  'file.size': '{size}',
  'file.modified': '修改于 {time}',
  'read.title': '查看 {name}',
  'read.truncated': '文件超过 {limit}，已截断显示（{size}）',
  'read.binary': '二进制文件，无法预览',
  'read.edit': '编辑',
  'edit.title': '编辑 {name}',
  'new.title': '新建文件',
  'edit.name': '文件名（相对工作区，如 docs/note.md）',
  'edit.namePlaceholder': 'docs/note.md',
  'edit.content': '文件内容',
  'edit.save': '保存',
  'edit.cancel': '取消',
  'edit.saving': '保存中…',
  'edit.emptyName': '请先填写文件名',
  'save.error': '保存失败：{message}',
  'load.error': '读取失败：{message}',
} satisfies Record<string, string>

/** The `file-panel` namespace key union. */
export type FilePanelKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'action.aria': 'Open the workspace file panel',
  'panel.title': 'Workspace files',
  'panel.root': 'Workspace',
  'panel.up': 'Up',
  'panel.loading': 'Loading…',
  'panel.empty': '(empty directory)',
  'panel.error': 'Something went wrong: {message}',
  'panel.truncated': 'Too many entries; showing the first {count}',
  'action.refresh': 'Refresh',
  'action.newFile': 'New file',
  'close': 'Close',
  'file.size': '{size}',
  'file.modified': 'Modified {time}',
  'read.title': 'View {name}',
  'read.truncated': 'File exceeds {limit}; showing the prefix ({size})',
  'read.binary': 'Binary file, preview unavailable',
  'read.edit': 'Edit',
  'edit.title': 'Edit {name}',
  'new.title': 'New file',
  'edit.name': 'File name (workspace-relative, e.g. docs/note.md)',
  'edit.namePlaceholder': 'docs/note.md',
  'edit.content': 'Content',
  'edit.save': 'Save',
  'edit.cancel': 'Cancel',
  'edit.saving': 'Saving…',
  'edit.emptyName': 'Enter a file name first',
  'save.error': 'Save failed: {message}',
  'load.error': 'Read failed: {message}',
} satisfies Record<FilePanelKey, string>

/** Locale namespace id registered under ctx.locale. */
export const NS = 'file-panel'

/**
 * Fill one dictionary template's `{name}`-style placeholders.
 * @param template - dictionary text.
 * @param params - placeholder values; absent params replace nothing.
 * @returns the filled text.
 */
export function fmt(template: string, params?: Record<string, string>): string {
  if (params === undefined) return template
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole)
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The workspace file panel copy. */
    [NS]: FilePanelKey
  }
}
