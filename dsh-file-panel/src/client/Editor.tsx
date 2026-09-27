/**
 * The read / edit / new-file views of the file panel. `ReadView` renders a
 * bounded text prefix with truncation and binary notices; `Editor` hosts the
 * edit form (file-name field only in new-file mode, content textarea always)
 * and reports save attempts upward. Presentational: all state is local form
 * state; persistence happens through the injected save callback.
 */
import { useState } from 'react'
import type { PanelT } from './Browser.tsx'

/** Read view injected props. */
export interface ReadViewInjected {
  /** Canonical relative file path. */
  readonly path: string
  readonly content: string
  /** Full on-disk byte length. */
  readonly size: number
  readonly truncated: boolean
  readonly error: string | null
  readonly onEdit: () => void
  readonly onBack: () => void
  readonly t: PanelT
}

/**
 * The read-only preview view.
 * @param props - injected content and callbacks.
 */
export function ReadView(props: ReadViewInjected): React.JSX.Element {
  const { path, content, size, truncated, error, onEdit, onBack, t } = props
  return (
    <div className="dsh_filePanel_editor">
      <div className="dsh_filePanel_field">
        <div className="dsh_filePanel_label">{t('read.title', { name: path })}</div>
        {error !== null ? <div className="dsh_filePanel_error">{error}</div> : (
          <>
            {truncated ? (
              <div className="dsh_filePanel_note">{t('read.truncated', { limit: String(size), size: String(size) })}</div>
            ) : null}
            <pre className="dsh_filePanel_readContent">{content}</pre>
          </>
        )}
      </div>
      <div className="dsh_filePanel_actions">
        <button type="button" className="dsh_filePanel_button" onClick={onBack}>
          {t('edit.cancel')}
        </button>
        <button type="button" className="dsh_filePanel_button dsh_filePanel_buttonPrimary" onClick={onEdit}>
          {t('read.edit')}
        </button>
      </div>
    </div>
  )
}

/** Editor view injected props. */
export interface EditorInjected {
  /** Canonical relative path being edited ('' in new-file mode). */
  readonly path: string
  readonly isNew: boolean
  /** The current draft content ('' for new files). */
  readonly initial: string
  readonly busy: boolean
  /** Localized error text (null when fine). */
  readonly error: string | null
  readonly onSave: (path: string, content: string) => void
  readonly onCancel: () => void
  readonly t: PanelT
}

/**
 * The edit / new-file form.
 * @param props - injected draft, save wiring, and copy.
 */
export function Editor(props: EditorInjected): React.JSX.Element {
  const { path, isNew, initial, busy, error, onSave, onCancel, t } = props
  const [name, setName] = useState(isNew ? '' : path)
  const [content, setContent] = useState(initial)
  const [invalid, setInvalid] = useState(false)
  const save = (): void => {
    const target = isNew ? name.trim() : path
    if (target === '') {
      setInvalid(true)
      return
    }
    setInvalid(false)
    onSave(target, content)
  }
  return (
    <div className="dsh_filePanel_editor">
      {isNew ? (
        <div className="dsh_filePanel_field">
          <label className="dsh_filePanel_label" htmlFor="dsh_filePanel_name">{t('edit.name')}</label>
          <input
            id="dsh_filePanel_name"
            className="dsh_filePanel_input"
            value={name}
            placeholder={t('edit.namePlaceholder')}
            onChange={(event) => { setName(event.target.value) }}
            autoFocus
          />
          {invalid ? <div className="dsh_filePanel_error">{t('edit.emptyName')}</div> : null}
        </div>
      ) : (
        <div className="dsh_filePanel_field">
          <div className="dsh_filePanel_label">{t('edit.title', { name: path })}</div>
        </div>
      )}
      <div className="dsh_filePanel_field">
        <label className="dsh_filePanel_label" htmlFor="dsh_filePanel_content">{t('edit.content')}</label>
        <textarea
          id="dsh_filePanel_content"
          className="dsh_filePanel_textarea"
          value={content}
          onChange={(event) => { setContent(event.target.value) }}
          spellCheck={false}
        />
      </div>
      {error !== null ? <div className="dsh_filePanel_error">{error}</div> : null}
      <div className="dsh_filePanel_actions">
        <button type="button" className="dsh_filePanel_button" onClick={onCancel} disabled={busy}>
          {t('edit.cancel')}
        </button>
        <button
          type="button"
          className="dsh_filePanel_button dsh_filePanel_buttonPrimary"
          onClick={save}
          disabled={busy}
        >
          {busy ? t('edit.saving') : t('edit.save')}
        </button>
      </div>
    </div>
  )
}
