'use client'

import { useEffect, useMemo, useState } from 'react'

import { manifestExamples, resourceInventoryExample } from '@/content/examples/resource-inventory'
import { analyzeManifest } from '@/domain/parser/analyze-manifest'
import type {
  AnalysisDiagnostic,
  AnalysisResult,
  KubernetesResource,
  ResourceScope,
  SourceRange,
} from '@/domain/model/analysis'
import { ManifestEditor, type EditorJumpRequest } from '@/features/editor/manifest-editor'

const analysisDelay = 250

const statusLabels: Readonly<Record<AnalysisResult['status'], string>> = {
  empty: 'Waiting for YAML',
  valid: 'Analysis complete',
  partial: 'Partial results',
  invalid: 'Input needs attention',
  limited: 'Safety limit reached',
}

function plural(count: number, singular: string): string {
  return `${count} ${singular}${count === 1 ? '' : 's'}`
}

function scopeDescription(scope: ResourceScope): string {
  if (scope.type === 'namespaced') {
    return `Namespace: ${scope.namespace}`
  }

  if (scope.type === 'cluster') {
    return 'Cluster-scoped'
  }

  return scope.declaredNamespace
    ? `Scope unknown · Declared namespace: ${scope.declaredNamespace}`
    : 'Scope unknown'
}

function supportDescription(resource: KubernetesResource): string {
  if (resource.support === 'full') {
    return 'Full support'
  }

  return resource.support === 'partial' ? 'Identity support' : 'Generic kind'
}

function locationDescription(range: SourceRange | undefined, documentIndex?: number): string {
  const document = documentIndex === undefined ? '' : `Document ${documentIndex + 1}`

  if (!range) {
    return document || 'Input-wide issue'
  }

  return [document, `line ${range.start.line}, column ${range.start.column}`]
    .filter(Boolean)
    .join(' · ')
}

interface ResourceCardProps {
  readonly resource: KubernetesResource
  readonly jumpDisabled: boolean
  readonly onJump: (range: SourceRange) => void
}

function ResourceCard({ resource, jumpDisabled, onJump }: ResourceCardProps) {
  const jumpRange = resource.source.fieldRanges.get('metadata.name') ?? resource.source.range

  return (
    <li>
      <article className="resource-list-card" data-resource-kind={resource.kind}>
        <div className="flex min-w-0 items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="resource-list-kind">{resource.kind}</p>
            <h4 className="truncate text-base font-semibold">{resource.name}</h4>
          </div>
          <span className={`support-badge support-${resource.support}`}>
            {supportDescription(resource)}
          </span>
        </div>
        <p className="mt-3 text-sm text-muted">{scopeDescription(resource.identity.scope)}</p>
        <p className="mt-1 text-xs text-muted">
          Document {resource.source.documentIndex + 1}
          {resource.source.listItemIndex === undefined
            ? ''
            : ` · List item ${resource.source.listItemIndex + 1}`}
          {resource.source.range ? ` · Line ${resource.source.range.start.line}` : ''}
        </p>
        {jumpRange ? (
          <button
            className="text-action mt-4"
            disabled={jumpDisabled}
            onClick={() => onJump(jumpRange)}
            type="button"
          >
            View in YAML
            <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </article>
    </li>
  )
}

interface DiagnosticCardProps {
  readonly diagnostic: AnalysisDiagnostic
  readonly jumpDisabled: boolean
  readonly onJump: (range: SourceRange) => void
}

function DiagnosticCard({ diagnostic, jumpDisabled, onJump }: DiagnosticCardProps) {
  const icon = diagnostic.severity === 'error' ? '×' : diagnostic.severity === 'warning' ? '!' : 'i'

  return (
    <li>
      <article className={`issue-card issue-${diagnostic.severity}`}>
        <div className="flex gap-3">
          <span aria-hidden="true" className="issue-icon">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{diagnostic.title}</p>
              <span className="issue-severity">{diagnostic.severity}</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{diagnostic.message}</p>
            <p className="mt-2 text-xs text-muted">
              <code>{diagnostic.code}</code> ·{' '}
              {locationDescription(diagnostic.range, diagnostic.documentIndex)}
            </p>
            {diagnostic.range ? (
              <button
                className="text-action mt-3"
                disabled={jumpDisabled}
                onClick={() => onJump(diagnostic.range!)}
                type="button"
              >
                View in YAML
                <span aria-hidden="true">→</span>
              </button>
            ) : null}
          </div>
        </div>
      </article>
    </li>
  )
}

interface ManifestWorkbenchProps {
  readonly initialSource?: string
}

export function ManifestWorkbench({ initialSource = '' }: ManifestWorkbenchProps) {
  const [source, setSource] = useState(initialSource)
  const [analysis, setAnalysis] = useState(() => analyzeManifest(initialSource))
  const [analyzedSource, setAnalyzedSource] = useState(initialSource)
  const [selectedExampleId, setSelectedExampleId] = useState(resourceInventoryExample.id)
  const [loadedExampleId, setLoadedExampleId] = useState<string>()
  const [jumpRequest, setJumpRequest] = useState<EditorJumpRequest>()

  const selectedExample = useMemo(
    () =>
      manifestExamples.find((example) => example.id === selectedExampleId) ??
      resourceInventoryExample,
    [selectedExampleId],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAnalysis(analyzeManifest(source))
      setAnalyzedSource(source)
    }, analysisDelay)

    return () => window.clearTimeout(timer)
  }, [source])

  const isAnalyzing = source !== analyzedSource

  function loadExample(): void {
    setSource(selectedExample.source)
    setLoadedExampleId(selectedExample.id)
  }

  function resetExample(): void {
    const loadedExample = manifestExamples.find((example) => example.id === loadedExampleId)

    if (loadedExample) {
      setSource(loadedExample.source)
    }
  }

  function jumpToSource(range: SourceRange): void {
    setJumpRequest((current) => ({ range, token: (current?.token ?? 0) + 1 }))
  }

  const statusText = isAnalyzing
    ? 'Analyzing…'
    : `${statusLabels[analysis.status]}. ${plural(analysis.summary.resources, 'resource')}, ${plural(analysis.summary.errors, 'error')}, and ${plural(analysis.summary.warnings, 'warning')}.`

  return (
    <div
      aria-busy={isAnalyzing}
      className="manifest-workbench"
      data-analysis-status={isAnalyzing ? 'working' : analysis.status}
    >
      <div className="workbench-toolbar">
        <div className="min-w-0">
          <label className="toolbar-label" htmlFor="manifest-example">
            Example
          </label>
          <select
            className="example-select"
            id="manifest-example"
            onChange={(event) => setSelectedExampleId(event.target.value)}
            value={selectedExampleId}
          >
            {manifestExamples.map((example) => (
              <option key={example.id} value={example.id}>
                {example.name}
              </option>
            ))}
          </select>
          <p className="mt-1 max-w-xl text-xs text-muted">{selectedExample.description}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="toolbar-button toolbar-button-primary"
            onClick={loadExample}
            type="button"
          >
            Load example
          </button>
          <button
            className="toolbar-button"
            disabled={!loadedExampleId}
            onClick={resetExample}
            type="button"
          >
            Reset
          </button>
          <button
            className="toolbar-button"
            disabled={!source}
            onClick={() => setSource('')}
            type="button"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="workbench-grid">
        <section aria-labelledby="manifest-editor-label" className="editor-panel">
          <div className="panel-heading">
            <div>
              <h3 className="text-lg font-semibold" id="manifest-editor-label">
                Kubernetes YAML
              </h3>
              <p className="mt-1 text-sm text-muted">Processed only in this browser.</p>
            </div>
            <span className="privacy-chip">Memory only</span>
          </div>
          <p className="editor-help" id="manifest-editor-help">
            Paste one or more documents. Use Ctrl/⌘+F to search and Ctrl/⌘+Z to undo. Tab moves
            focus out of the editor.
          </p>
          <ManifestEditor
            diagnostics={analysis.diagnostics}
            jumpRequest={jumpRequest}
            onChange={setSource}
            value={source}
          />
        </section>

        <section aria-labelledby="analysis-results-title" className="results-panel">
          <div className="panel-heading results-heading">
            <div>
              <h3 className="text-lg font-semibold" id="analysis-results-title">
                Resource inventory
              </h3>
              <p className="mt-1 text-sm text-muted">Static facts from the supplied YAML.</p>
            </div>
            <span
              className={`analysis-state analysis-state-${isAnalyzing ? 'working' : analysis.status}`}
            >
              {isAnalyzing ? 'Analyzing…' : statusLabels[analysis.status]}
            </span>
          </div>

          <div aria-label="Analysis summary" className="summary-grid" role="group">
            <div>
              <strong>{analysis.summary.resources}</strong>
              <span>Resources</span>
            </div>
            <div>
              <strong>{analysis.summary.errors}</strong>
              <span>Errors</span>
            </div>
            <div>
              <strong>{analysis.summary.warnings}</strong>
              <span>Warnings</span>
            </div>
            <div>
              <strong>{analysis.summary.documents}</strong>
              <span>Documents</span>
            </div>
          </div>

          <p aria-live="polite" className="sr-only" role="status">
            {statusText}
          </p>

          <div className="results-scroll">
            {analysis.resources.length === 0 && analysis.diagnostics.length === 0 ? (
              <div className="empty-result">
                <span aria-hidden="true">{source.trim() ? '◇' : '↓'}</span>
                <h4>{source.trim() ? 'No resources found' : 'Paste YAML or load the example'}</h4>
                <p>
                  {source.trim()
                    ? 'A Kubernetes resource needs apiVersion, kind, and metadata.name.'
                    : 'Normalized resources and precise source locations will appear here.'}
                </p>
              </div>
            ) : null}

            {analysis.diagnostics.length > 0 ? (
              <section aria-labelledby="issues-title" className="result-group">
                <div className="result-group-heading">
                  <h4 id="issues-title">Issues</h4>
                  <span>{analysis.diagnostics.length}</span>
                </div>
                <ol className="grid gap-3">
                  {analysis.diagnostics.map((item) => (
                    <DiagnosticCard
                      diagnostic={item}
                      jumpDisabled={isAnalyzing}
                      key={item.id}
                      onJump={jumpToSource}
                    />
                  ))}
                </ol>
              </section>
            ) : null}

            {analysis.resources.length > 0 ? (
              <section aria-labelledby="resources-title" className="result-group">
                <div className="result-group-heading">
                  <h4 id="resources-title">Resources</h4>
                  <span>{analysis.resources.length}</span>
                </div>
                <ol className="grid gap-3">
                  {analysis.resources.map((resource) => (
                    <ResourceCard
                      jumpDisabled={isAnalyzing}
                      key={resource.id}
                      onJump={jumpToSource}
                      resource={resource}
                    />
                  ))}
                </ol>
              </section>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  )
}
