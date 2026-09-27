/**
 * The directory browser view of the file panel: breadcrumb navigation, the
 * bounded entry list (dirs first, then name), and the toolbar (new file,
 * refresh). Presentational: all state lives in the panel container; every
 * row click maps to a callback prop.
 */
import type { DirEntry } from '../contract.ts'
import { formatSize, formatTime, segmentsOf } from './model.ts'
import type { FilePanelKey } from './locales.ts'

/** A translation function bound to the panel namespace. */
export type PanelT = (key: FilePanelKey, params?: Record<string, string>) => string

/** Browser view injected props (the panel container provides them). */
export interface BrowserInjected {
  /** Canonical relative directory being shown ('' = workspace root). */
  readonly dir: string
  readonly entries: readonly DirEntry[]
  readonly loading: boolean
  /** Localized error text (null when fine). */
  readonly error: string | null
  /** True when the listing was truncated by the entry cap. */
  readonly truncated: boolean
  readonly onEnterDir: (name: string) => void
  readonly onOpenFile: (name: string) => void
  /** Jump to an ancestor directory (breadcrumb navigation). */
  readonly onJump: (dir: string) => void
  readonly onUp: () => void
  readonly onNewFile: () => void
  readonly onRefresh: () => void
  readonly t: PanelT
}

/** Folder glyph (inline SVG, currentColor). */
function FolderIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M1.5 3.5h4.2l1.4 1.6h7.4v7.4a1.6 1.6 0 0 1-1.6 1.6H3.1a1.6 1.6 0 0 1-1.6-1.6V3.5Z" />
    </svg>
  )
}

/** File glyph (inline SVG, currentColor). */
function FileIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
      <path d="M3.5 1.5h6l3 3v10h-9v-13Z" />
      <path d="M9.5 1.5v3h3" />
    </svg>
  )
}

/** The directory listing body: rows or a state note. */
function Listing({ entries, truncated, t, onEnterDir, onOpenFile }: {
  readonly entries: readonly DirEntry[]
  readonly truncated: boolean
  readonly t: PanelT
  readonly onEnterDir: (name: string) => void
  readonly onOpenFile: (name: string) => void
}): React.JSX.Element {
  if (entries.length === 0) {
    return <div className="dsh_filePanel_note">{t('panel.empty')}</div>
  }
  return (
    <>
      {entries.map((entry) => (
        <button
          key={entry.name}
          type="button"
          className="dsh_filePanel_row"
          onClick={() => { entry.kind === 'dir' ? onEnterDir(entry.name) : onOpenFile(entry.name) }}
        >
          <span className="dsh_filePanel_rowIcon">{entry.kind === 'dir' ? <FolderIcon /> : <FileIcon />}</span>
          <span className="dsh_filePanel_rowName">{entry.name}</span>
          <span className="dsh_filePanel_rowMeta">
            {entry.kind === 'file' ? `${formatSize(entry.size)} · ${formatTime(entry.mtime)}` : formatTime(entry.mtime)}
          </span>
        </button>
      ))}
      {truncated ? (
        <div className="dsh_filePanel_note">{t('panel.truncated', { count: String(entries.length) })}</div>
      ) : null}
    </>
  )
}

/**
 * The browser view.
 * @param props - injected callbacks and state.
 */
export function Browser(props: BrowserInjected): React.JSX.Element {
  const { dir, entries, loading, error, truncated, t, onEnterDir, onOpenFile, onJump, onUp, onNewFile, onRefresh } = props
  const segments = segmentsOf(dir)
  return (
    <>
      <div className="dsh_filePanel_crumbs">
        <button type="button" className="dsh_filePanel_crumb" onClick={onUp} title={t('panel.up')}>
          ←
        </button>
        <button
          type="button"
          className="dsh_filePanel_crumb"
          onClick={() => { onJump('') }}
          disabled={dir === ''}
        >
          {t('panel.root')}
        </button>
        {segments.map((segment, index) => {
          const target = segments.slice(0, index + 1).join('/')
          const isLast = index === segments.length - 1
          return (
            <span key={target} style={{ display: 'inline-flex', alignItems: 'center', flex: 'none' }}>
              <span className="dsh_filePanel_crumbSep">/</span>
              <button
                type="button"
                className="dsh_filePanel_crumb"
                onClick={() => { if (!isLast) onJump(target) }}
                disabled={isLast}
              >
                {segment}
              </button>
            </span>
          )
        })}
      </div>
      <div className="dsh_filePanel_body">
        {loading ? <div className="dsh_filePanel_note">{t('panel.loading')}</div> : null}
        {!loading && error !== null ? <div className="dsh_filePanel_error">{error}</div> : null}
        {!loading && error === null ? (
          <Listing entries={entries} truncated={truncated} t={t} onEnterDir={onEnterDir} onOpenFile={onOpenFile} />
        ) : null}
      </div>
      <div className="dsh_filePanel_actions" style={{ padding: '8px 12px', borderTop: '1px solid var(--dsw-alias-border-l1)' }}>
        <button type="button" className="dsh_filePanel_button" onClick={onNewFile}>
          {t('action.newFile')}
        </button>
        <button type="button" className="dsh_filePanel_button" onClick={onRefresh}>
          {t('action.refresh')}
        </button>
      </div>
    </>
  )
}
