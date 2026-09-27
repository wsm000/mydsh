/**
 * The file panel container: a session-header action button that opens a
 * popover hosting the browse / read / edit state machine. All host traffic
 * goes through the injected {@link FilePanelApi}; the component owns no
 * global state, so the whole flow is testable with a stub api.
 */
import { useEffect, useRef, useState } from 'react'
import type { DirEntry, ListResult, ReadResult, WriteResult } from '../contract.ts'
import { fmt } from './locales.ts'
import { joinRel, parentOf } from './model.ts'
import { Browser, type PanelT } from './Browser.tsx'
import { Editor, ReadView } from './Editor.tsx'

/** The remote face the panel needs (bound to one session by the client entry). */
export interface FilePanelApi {
  readonly list: (dir: string, signal?: AbortSignal) => Promise<ListResult>
  readonly read: (path: string, signal?: AbortSignal) => Promise<ReadResult>
  readonly write: (path: string, content: string, signal?: AbortSignal) => Promise<WriteResult>
}

/** Panel action injected props (the header slot provides sessionId and t). */
export interface FilePanelActionInjected {
  readonly sessionId: string
  readonly t: PanelT
  readonly api: FilePanelApi
  /** Whether the panel surface is enabled; false hides the trigger entirely. */
  readonly enabled: boolean
}

/** One view of the panel state machine. */
type View =
  | { readonly kind: 'browse' }
  | { readonly kind: 'read'; readonly path: string }
  | { readonly kind: 'edit'; readonly path: string; readonly isNew: boolean; readonly content: string }

/** Error text extraction from an unknown rejection (gateway error envelope). */
function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && error !== null) {
    const maybe = error as { message?: unknown; result?: { error?: { message?: unknown } } }
    const inner = maybe.result?.error?.message
    if (typeof inner === 'string') return inner
    if (typeof maybe.message === 'string') return maybe.message
  }
  return String(error)
}

/** Folder glyph for the header trigger (inline SVG, currentColor). */
function FolderGlyph(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M1.5 3.5h4.2l1.4 1.6h7.4v7.4a1.6 1.6 0 0 1-1.6 1.6H3.1a1.6 1.6 0 0 1-1.6-1.6V3.5Z" />
    </svg>
  )
}

/**
 * The session-header file panel action.
 * @param props - session identity, bound copy, and the remote api.
 */
export function FilePanelAction(props: FilePanelActionInjected): React.JSX.Element | null {
  const { t, api, enabled } = props
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>({ kind: 'browse' })
  // Browse state.
  const [dir, setDir] = useState('')
  const [entries, setEntries] = useState<readonly DirEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  // Read state.
  const [readState, setReadState] = useState<{ content: string; size: number; truncated: boolean; error: string | null }>({
    content: '',
    size: 0,
    truncated: false,
    error: null,
  })
  // Edit state.
  const [editState, setEditState] = useState<{ busy: boolean; error: string | null }>({ busy: false, error: null })
  const rootRef = useRef<HTMLDivElement>(null)

  const load = async (target: string): Promise<void> => {
    setDir(target)
    setLoading(true)
    setBrowseError(null)
    try {
      const result = await api.list(target)
      setEntries(result.entries)
      setTruncated(result.truncated)
    } catch (error: unknown) {
      setEntries([])
      setTruncated(false)
      setBrowseError(fmt(t('panel.error'), { message: messageOf(error) }))
    } finally {
      setLoading(false)
    }
  }

  // (Re)load the current directory whenever the popover opens.
  useEffect(() => {
    if (!open) return
    void load(dir)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Close on outside pointerdown and on Escape.
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent): void => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false)
    }
    const closeKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeKey)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeKey)
    }
  }, [open])

  const openFile = async (name: string): Promise<void> => {
    const target = joinRel(dir, name)
    setView({ kind: 'read', path: target })
    setReadState({ content: '', size: 0, truncated: false, error: null })
    try {
      const result = await api.read(target)
      setReadState({ content: result.content, size: result.size, truncated: result.truncated, error: null })
    } catch (error: unknown) {
      setReadState({ content: '', size: 0, truncated: false, error: fmt(t('load.error'), { message: messageOf(error) }) })
    }
  }

  const save = async (path: string, content: string): Promise<void> => {
    setEditState({ busy: true, error: null })
    try {
      await api.write(path, content)
      setEditState({ busy: false, error: null })
      setView({ kind: 'browse' })
      await load(dir)
    } catch (error: unknown) {
      setEditState({ busy: false, error: fmt(t('save.error'), { message: messageOf(error) }) })
    }
  }

  if (!enabled) return null
  if (!open) {
    return (
      <button
        type="button"
        className="dsh_filePanel_trigger"
        title={t('action.aria')}
        aria-label={t('action.aria')}
        onClick={() => { setOpen(true) }}
      >
        <FolderGlyph />
      </button>
    )
  }

  return (
    <div ref={rootRef} className="dsh_filePanel_popover" role="dialog" aria-label={t('panel.title')}>
      <div className="dsh_filePanel_header">
        <h3 className="dsh_filePanel_title">{t('panel.title')}</h3>
        <button
          type="button"
          className="dsh_filePanel_iconButton"
          aria-label={t('close')}
          onClick={() => { setOpen(false) }}
        >
          ✕
        </button>
      </div>
      {view.kind === 'browse' ? (
        <Browser
          dir={dir}
          entries={entries}
          loading={loading}
          error={browseError}
          truncated={truncated}
          onEnterDir={(name) => { void load(joinRel(dir, name)) }}
          onOpenFile={(name) => { void openFile(name) }}
          onJump={(target) => { void load(target) }}
          onUp={() => { void load(parentOf(dir)) }}
          onNewFile={() => { setView({ kind: 'edit', path: '', isNew: true, content: '' }) }}
          onRefresh={() => { void load(dir) }}
          t={t}
        />
      ) : null}
      {view.kind === 'read' ? (
        <ReadView
          path={view.path}
          content={readState.content}
          size={readState.size}
          truncated={readState.truncated}
          error={readState.error}
          onEdit={() => { setView({ kind: 'edit', path: view.path, isNew: false, content: readState.content }) }}
          onBack={() => { setView({ kind: 'browse' }) }}
          t={t}
        />
      ) : null}
      {view.kind === 'edit' ? (
        <Editor
          path={view.path}
          isNew={view.isNew}
          initial={view.content}
          busy={editState.busy}
          error={editState.error}
          onSave={(path, content) => { void save(path, content) }}
          onCancel={() => { setView({ kind: 'browse' }) }}
          t={t}
        />
      ) : null}
    </div>
  )
}
