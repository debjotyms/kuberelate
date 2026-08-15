'use client'

import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { lintGutter, setDiagnostics, type Diagnostic as EditorDiagnostic } from '@codemirror/lint'
import { searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import {
  drawSelection,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { yaml } from '@codemirror/lang-yaml'
import { tags } from '@lezer/highlight'
import { useEffect, useRef } from 'react'

import type { AnalysisDiagnostic, SourceRange } from '@/domain/model/analysis'

export interface EditorJumpRequest {
  readonly range: SourceRange
  readonly token: number
}

interface ManifestEditorProps {
  readonly value: string
  readonly diagnostics: readonly AnalysisDiagnostic[]
  readonly jumpRequest?: EditorJumpRequest
  readonly onChange: (value: string) => void
}

const editorTheme = EditorView.theme({
  '&': {
    minHeight: '28rem',
    backgroundColor: 'var(--kg-code)',
    color: 'var(--kg-code-ink)',
    fontSize: '0.875rem',
  },
  '&.cm-focused': {
    outline: '2px solid color-mix(in srgb, var(--kg-brand) 65%, transparent)',
    outlineOffset: '-2px',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in srgb, var(--kg-brand) 8%, transparent)',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--kg-brand) 14%, transparent)',
    color: '#ffffff',
    fontWeight: '700',
  },
  '.cm-content': {
    caretColor: 'var(--kg-brand-strong)',
    fontFamily: 'var(--kg-font-mono)',
    lineHeight: '1.6',
    padding: '0.75rem 0',
  },
  '.cm-line': {
    padding: '0 0.85rem',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--kg-brand-strong)',
    borderLeftWidth: '2px',
  },
  '.cm-gutters': {
    backgroundColor: 'color-mix(in srgb, var(--kg-code) 95%, black)',
    borderRight: '1px solid color-mix(in srgb, var(--kg-line) 20%, transparent)',
    color: '#9bb4c6',
    paddingLeft: '0.25rem',
  },
  '.cm-gutterElement': {
    padding: '0 0.6rem 0 0.4rem',
  },
  '.cm-lintRange-error': {
    backgroundImage:
      'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%276%27 height=%273%27%3E%3Cpath d=%27m0 3 3-3 3 3%27 fill=%27none%27 stroke=%27%23ff8293%27/%3E%3C/svg%3E")',
  },
  '.cm-panels': {
    backgroundColor: 'var(--kg-surface)',
    color: 'var(--kg-ink)',
  },
  '.cm-scroller': {
    maxHeight: '42rem',
    overflow: 'auto',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'color-mix(in srgb, var(--kg-brand) 30%, transparent) !important',
  },
})

const manifestHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.propertyName, tags.attributeName, tags.typeName],
    color: '#7dd3fc',
    fontWeight: '600',
  },
  { tag: [tags.string, tags.special(tags.string)], color: '#a7f3d0' },
  { tag: [tags.atom, tags.bool, tags.null, tags.number], color: '#fde047' },
  { tag: tags.comment, color: '#64748b', fontStyle: 'italic' },
  { tag: tags.invalid, color: '#f87171' },
])

function toEditorDiagnostics(
  diagnostics: readonly AnalysisDiagnostic[],
  documentLength: number,
): EditorDiagnostic[] {
  return diagnostics.flatMap((item) => {
    if (!item.range) {
      return []
    }

    const from = Math.min(item.range.start.offset, documentLength)
    const to = Math.max(from, Math.min(item.range.end.offset, documentLength))

    return [
      {
        from,
        to,
        severity: item.severity,
        source: item.code,
        message: item.message,
      },
    ]
  })
}

export function ManifestEditor({ value, diagnostics, jumpRequest, onChange }: ManifestEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView>(null)
  const onChangeRef = useRef(onChange)

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!hostRef.current) {
      return
    }

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        dropCursor(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(manifestHighlightStyle),
        yaml(),
        lintGutter(),
        keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          'aria-label': 'Kubernetes YAML manifest editor',
          'aria-describedby': 'manifest-editor-help',
          spellcheck: 'false',
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString())
          }
        }),
        highlightActiveLine(),
        editorTheme,
      ],
    })
    const view = new EditorView({ state, parent: hostRef.current })
    const focusEditorFromScroller = (): void => view.focus()
    view.scrollDOM.tabIndex = 0
    view.scrollDOM.setAttribute('aria-label', 'Scrollable YAML editor')
    view.scrollDOM.addEventListener('focus', focusEditorFromScroller)
    viewRef.current = view

    return () => {
      view.scrollDOM.removeEventListener('focus', focusEditorFromScroller)
      view.destroy()
      viewRef.current = null
    }
    // The editor is created once; later value changes are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current

    if (!view || view.state.doc.toString() === value) {
      return
    }

    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    })
  }, [value])

  useEffect(() => {
    const view = viewRef.current

    if (!view) {
      return
    }

    view.dispatch(
      setDiagnostics(view.state, toEditorDiagnostics(diagnostics, view.state.doc.length)),
    )
  }, [diagnostics])

  useEffect(() => {
    const view = viewRef.current

    if (!view || !jumpRequest) {
      return
    }

    const from = Math.min(jumpRequest.range.start.offset, view.state.doc.length)
    const to = Math.max(from, Math.min(jumpRequest.range.end.offset, view.state.doc.length))

    view.dispatch({
      selection: { anchor: from, head: to },
      effects: EditorView.scrollIntoView(from, { y: 'center' }),
    })
    view.focus()
  }, [jumpRequest])

  return <div className="manifest-editor" ref={hostRef} />
}
