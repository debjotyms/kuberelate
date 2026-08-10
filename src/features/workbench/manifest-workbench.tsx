'use client'

import { useEffect, useMemo, useState } from 'react'

import {
  brokenServiceSelectorExample,
  manifestExamples,
} from '@/content/examples/resource-inventory'
import type {
  AnalysisDiagnostic,
  AnalysisResult,
  KubernetesResource,
  ResourceId,
  ResourceScope,
  SafeEvidenceItem,
  SourceRange,
} from '@/domain/model/analysis'
import { analyzeManifest } from '@/domain/parser/analyze-manifest'
import { projectResourceForInspector } from '@/domain/resources/safe-inspector'
import { formatLabelMap } from '@/domain/selectors/equality-selector'
import { ManifestEditor, type EditorJumpRequest } from '@/features/editor/manifest-editor'
import { TopologyCanvasLoader } from '@/features/topology/topology-canvas-loader'
import {
  buildRelationshipList,
  buildTopologyGraph,
  type RelationshipListItem,
  type TopologyGraph,
} from '@/graph/adapter/relationship-graph'
import {
  selectInspectorFocusToken,
  selectSelectedDiagnosticId,
  selectSelectedRelationshipId,
  selectSelectedResourceId,
  selectTopologyView,
  useWorkbenchStore,
} from '@/store/workbench-store'

const analysisDelay = 250

const statusLabels: Readonly<Record<AnalysisResult['status'], string>> = {
  empty: 'Waiting for YAML',
  valid: 'Analysis complete',
  partial: 'Partial results',
  invalid: 'Input needs attention',
  limited: 'Safety limit reached',
}

type InspectorSelection =
  | { readonly type: 'resource'; readonly id: ResourceId }
  | { readonly type: 'relationship'; readonly id: string }
  | { readonly type: 'diagnostic'; readonly id: string }

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

function resourceIdentity(resource: KubernetesResource): string {
  const group = resource.identity.apiGroup || 'core'
  const scope = resource.identity.scope
  const location =
    scope.type === 'namespaced'
      ? scope.namespace
      : scope.type === 'cluster'
        ? 'cluster'
        : (scope.declaredNamespace ?? 'scope-unknown')

  return `${group}/${resource.kind}/${location}/${resource.name}`
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

function evidenceActionLabel(evidence: SafeEvidenceItem): string {
  return evidence.kind === 'selector' ? 'View selector' : 'Compare workload labels'
}

interface ResourceCardProps {
  readonly resource: KubernetesResource
  readonly jumpDisabled: boolean
  readonly onInspect: (resource: KubernetesResource) => void
  readonly onJump: (range: SourceRange) => void
}

function ResourceCard({ resource, jumpDisabled, onInspect, onJump }: ResourceCardProps) {
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
        <div className="action-row mt-3">
          <button className="text-action" onClick={() => onInspect(resource)} type="button">
            Inspect resource
          </button>
          {jumpRange ? (
            <button
              className="text-action"
              disabled={jumpDisabled}
              onClick={() => onJump(jumpRange)}
              type="button"
            >
              View in YAML
              <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </div>
      </article>
    </li>
  )
}

interface DiagnosticCardProps {
  readonly diagnostic: AnalysisDiagnostic
  readonly jumpDisabled: boolean
  readonly onFocusTopology: (diagnostic: AnalysisDiagnostic) => void
  readonly onInspect: (diagnostic: AnalysisDiagnostic) => void
  readonly onJump: (range: SourceRange) => void
}

function DiagnosticCard({
  diagnostic,
  jumpDisabled,
  onFocusTopology,
  onInspect,
  onJump,
}: DiagnosticCardProps) {
  const icon = diagnostic.severity === 'error' ? '×' : diagnostic.severity === 'warning' ? '!' : 'i'
  const comparisonEvidence = diagnostic.evidence.filter(
    (item) => item.kind === 'labels' && item.range,
  )

  return (
    <li>
      <article
        className={`issue-card issue-${diagnostic.severity}`}
        data-diagnostic-code={diagnostic.code}
      >
        <div className="flex gap-3">
          <span aria-hidden="true" className="issue-icon">
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-semibold">{diagnostic.title}</p>
              <span className="issue-severity">{diagnostic.severity}</span>
              {diagnostic.certainty !== 'definite' ? (
                <span className="certainty-badge">{diagnostic.certainty}</span>
              ) : null}
            </div>
            <p className="mt-2 text-sm leading-6 text-muted">{diagnostic.message}</p>
            <p className="mt-2 text-xs text-muted">
              <code>{diagnostic.code}</code> ·{' '}
              {locationDescription(diagnostic.range, diagnostic.documentIndex)}
            </p>

            {diagnostic.evidence.length > 0 ? (
              <details className="issue-details">
                <summary>Evidence and verification</summary>
                <dl className="evidence-list">
                  {diagnostic.evidence.map((item, index) => (
                    <div key={`${item.label}:${index}`}>
                      <dt>{item.label}</dt>
                      <dd>
                        <code>{item.value}</code>
                      </dd>
                    </div>
                  ))}
                </dl>
                {diagnostic.verificationCommands.length > 0 ? (
                  <ul aria-label="Verification commands" className="command-list">
                    {diagnostic.verificationCommands.map((command) => (
                      <li key={command}>
                        <code>{command}</code>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
            ) : null}

            <div className="action-row mt-3">
              {diagnostic.resourceIds.length > 0 ? (
                <button
                  className="text-action"
                  disabled={jumpDisabled}
                  onClick={() => onFocusTopology(diagnostic)}
                  type="button"
                >
                  View in topology
                </button>
              ) : null}
              <button className="text-action" onClick={() => onInspect(diagnostic)} type="button">
                Inspect issue
              </button>
              {diagnostic.range ? (
                <button
                  className="text-action"
                  disabled={jumpDisabled}
                  onClick={() => onJump(diagnostic.range!)}
                  type="button"
                >
                  {diagnostic.code === 'KG-SVC-001' ? 'View selector' : 'View in YAML'}
                  <span aria-hidden="true">→</span>
                </button>
              ) : null}
              {comparisonEvidence.map((evidence) => (
                <button
                  aria-label={`Compare workload labels: ${evidence.label}`}
                  className="text-action"
                  disabled={jumpDisabled}
                  key={`${evidence.label}:${evidence.range?.start.offset}`}
                  onClick={() => onJump(evidence.range!)}
                  type="button"
                >
                  Compare workload labels
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </article>
    </li>
  )
}

interface TopologyPanelProps {
  readonly graph: TopologyGraph
  readonly relationshipList: readonly RelationshipListItem[]
}

function TopologyPanel({ graph, relationshipList }: TopologyPanelProps) {
  const view = useWorkbenchStore(selectTopologyView)
  const selectedRelationshipId = useWorkbenchStore(selectSelectedRelationshipId)
  const setView = useWorkbenchStore((state) => state.setTopologyView)
  const inspectRelationship = useWorkbenchStore((state) => state.inspectRelationship)

  return (
    <section aria-labelledby="topology-title" className="result-group topology-panel">
      <div className="topology-heading">
        <div>
          <h4 id="topology-title">Topology</h4>
          <p>Service-to-workload relationships inferred from supplied labels.</p>
        </div>
        <div aria-label="Topology view" className="view-switcher" role="group">
          <button aria-pressed={view === 'map'} onClick={() => setView('map')} type="button">
            Map
          </button>
          <button aria-pressed={view === 'list'} onClick={() => setView('list')} type="button">
            Relationship list
          </button>
        </div>
      </div>

      {view === 'map' ? (
        <TopologyCanvasLoader graph={graph} />
      ) : (
        <div aria-label="Semantic relationship list" className="relationship-list">
          {relationshipList.length > 0 ? (
            <ol>
              {relationshipList.map((item) => (
                <li data-relationship-id={item.id} key={item.id}>
                  <button
                    aria-label={`${item.ariaLabel} Inspect relationship.`}
                    aria-pressed={selectedRelationshipId === item.id}
                    onClick={() => inspectRelationship(item.id)}
                    type="button"
                  >
                    <span
                      className={`relationship-state relationship-state-${item.state}`}
                      aria-hidden="true"
                    >
                      {item.state === 'resolved' ? '✓' : '!'}
                    </span>
                    <span>
                      <strong>
                        {item.state === 'resolved' ? 'Resolved match' : 'No supplied match'}
                      </strong>
                      <span>{item.summary}</span>
                      <small>
                        {item.verb} · {item.certainty} · {item.state}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="topology-empty">No supported relationships were found in this input.</p>
          )}
        </div>
      )}
    </section>
  )
}

interface InspectorProps {
  readonly analysis: AnalysisResult
  readonly selection?: InspectorSelection
  readonly onInspectRelationship: (id: string) => void
  readonly onJump: (range: SourceRange) => void
}

function Inspector({ analysis, selection, onInspectRelationship, onJump }: InspectorProps) {
  const resourceById = new Map(analysis.resources.map((resource) => [resource.id, resource]))

  if (!selection) {
    return (
      <section aria-labelledby="inspector-title" className="inspector-panel result-group">
        <div className="result-group-heading">
          <h4 id="inspector-title" tabIndex={-1}>
            Inspector
          </h4>
        </div>
        <p className="inspector-empty">
          Select a topology node, connection, resource, or issue to inspect its evidence.
        </p>
      </section>
    )
  }

  if (selection.type === 'resource') {
    const resource = resourceById.get(selection.id)

    if (!resource) {
      return null
    }

    const workload = analysis.index.workloadLabels.byResource.get(resource.id)
    const relatedRelationships = analysis.relationships.filter(
      (relationship) =>
        relationship.source === resource.id ||
        (relationship.resolution.state === 'resolved' &&
          relationship.resolution.target === resource.id),
    )
    const relatedDiagnostics = analysis.diagnostics.filter((diagnostic) =>
      diagnostic.resourceIds.includes(resource.id),
    )
    const safeProjection = projectResourceForInspector(resource)
    const jumpRange = resource.source.fieldRanges.get('metadata.name') ?? resource.source.range

    return (
      <section aria-labelledby="inspector-title" className="inspector-panel result-group">
        <div className="inspector-heading">
          <div>
            <p className="inspector-kicker">Resource</p>
            <h4 id="inspector-title" tabIndex={-1}>
              {resource.kind} {resource.name}
            </h4>
          </div>
          <span className="support-badge">{supportDescription(resource)}</span>
        </div>
        <dl className="inspector-facts">
          <div>
            <dt>Identity</dt>
            <dd>
              <code>{resourceIdentity(resource)}</code>
            </dd>
          </div>
          <div>
            <dt>Scope</dt>
            <dd>{scopeDescription(resource.identity.scope)}</dd>
          </div>
          {workload ? (
            <div>
              <dt>{workload.source === 'pod' ? 'Pod labels' : 'Pod-template labels'}</dt>
              <dd>
                <code>{formatLabelMap(workload.labels)}</code>
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Connections</dt>
            <dd>{plural(relatedRelationships.length, 'relationship')}</dd>
          </div>
          <div>
            <dt>Issues</dt>
            <dd>{plural(relatedDiagnostics.length, 'issue')}</dd>
          </div>
          {safeProjection.secretValuePolicy === 'keys-only' ? (
            <div>
              <dt>Secret data</dt>
              <dd>
                Values hidden by design.{' '}
                {safeProjection.secretDataKeys.length > 0 ? (
                  <>
                    Keys: <code>{safeProjection.secretDataKeys.join(', ')}</code>
                  </>
                ) : (
                  'No data keys declared.'
                )}
              </dd>
            </div>
          ) : null}
        </dl>
        {relatedRelationships.length > 0 ? (
          <ul aria-label="Related relationships" className="inspector-links">
            {relatedRelationships.map((relationship) => (
              <li key={relationship.id}>
                <button onClick={() => onInspectRelationship(relationship.id)} type="button">
                  {relationship.evidence.summary}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {jumpRange ? (
          <button className="text-action mt-3" onClick={() => onJump(jumpRange)} type="button">
            View resource in YAML <span aria-hidden="true">→</span>
          </button>
        ) : null}
      </section>
    )
  }

  if (selection.type === 'relationship') {
    const relationship = analysis.relationships.find((item) => item.id === selection.id)

    if (!relationship) {
      return null
    }

    const relatedDiagnostic = analysis.diagnostics.find((diagnostic) =>
      diagnostic.relationshipIds.includes(relationship.id),
    )
    const state = relationship.resolution.state

    return (
      <section aria-labelledby="inspector-title" className="inspector-panel result-group">
        <div className="inspector-heading">
          <div>
            <p className="inspector-kicker">Relationship</p>
            <h4 id="inspector-title" tabIndex={-1}>
              Service selects workload
            </h4>
          </div>
          <span className={`relationship-state-label relationship-state-${state}`}>
            {state === 'resolved' ? '✓ Resolved' : '! No supplied match'}
          </span>
        </div>
        <p className="inspector-summary">{relationship.evidence.summary}</p>
        <dl className="inspector-facts">
          <div>
            <dt>Certainty</dt>
            <dd>Inferred from labels in the supplied manifests</dd>
          </div>
          <div>
            <dt>Service selector</dt>
            <dd>
              <code>{formatLabelMap(relationship.evidence.selector)}</code>
            </dd>
          </div>
        </dl>
        <p className="inspector-explanation">
          Services select Pods by labels. A connection to a Deployment is inferred through that
          Deployment&apos;s Pod-template labels; the Service does not select the Deployment object.
        </p>
        <div className="action-row mt-3">
          {relationship.evidence.sourceRange ? (
            <button
              className="text-action"
              onClick={() => onJump(relationship.evidence.sourceRange!)}
              type="button"
            >
              View selector <span aria-hidden="true">→</span>
            </button>
          ) : null}
          {relationship.evidence.targetRange ? (
            <button
              className="text-action"
              onClick={() => onJump(relationship.evidence.targetRange!)}
              type="button"
            >
              View workload labels <span aria-hidden="true">→</span>
            </button>
          ) : null}
          {relationship.evidence.comparisons.map((comparison) => {
            const target = resourceById.get(comparison.target)

            return comparison.range ? (
              <button
                aria-label={`Compare workload labels: ${target?.kind ?? 'workload'} ${target?.name ?? ''}`}
                className="text-action"
                key={comparison.target}
                onClick={() => onJump(comparison.range!)}
                type="button"
              >
                Compare workload labels <span aria-hidden="true">→</span>
              </button>
            ) : null
          })}
        </div>
        {relatedDiagnostic?.verificationCommands.length ? (
          <div className="inspector-commands">
            <h5>Verify in a cluster</h5>
            <ul className="command-list">
              {relatedDiagnostic.verificationCommands.map((command) => (
                <li key={command}>
                  <code>{command}</code>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    )
  }

  const diagnostic = analysis.diagnostics.find((item) => item.id === selection.id)

  if (!diagnostic) {
    return null
  }

  return (
    <section aria-labelledby="inspector-title" className="inspector-panel result-group">
      <div className="inspector-heading">
        <div>
          <p className="inspector-kicker">Issue · {diagnostic.code}</p>
          <h4 id="inspector-title" tabIndex={-1}>
            {diagnostic.title}
          </h4>
        </div>
        <span className={`relationship-state-label issue-label-${diagnostic.severity}`}>
          {diagnostic.severity} · {diagnostic.certainty}
        </span>
      </div>
      <p className="inspector-summary">{diagnostic.message}</p>
      {diagnostic.whyItMatters ? (
        <p className="inspector-explanation">{diagnostic.whyItMatters}</p>
      ) : null}
      {diagnostic.evidence.length > 0 ? (
        <dl className="evidence-list inspector-evidence">
          {diagnostic.evidence.map((evidence, index) => (
            <div key={`${evidence.label}:${index}`}>
              <dt>{evidence.label}</dt>
              <dd>
                <code>{evidence.value}</code>
                {evidence.range ? (
                  <button
                    className="text-action"
                    onClick={() => onJump(evidence.range!)}
                    type="button"
                  >
                    {evidenceActionLabel(evidence)} <span aria-hidden="true">→</span>
                  </button>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {diagnostic.verificationCommands.length > 0 ? (
        <div className="inspector-commands">
          <h5>Verify in a cluster</h5>
          <ul className="command-list">
            {diagnostic.verificationCommands.map((command) => (
              <li key={command}>
                <code>{command}</code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {diagnostic.possibleDirection ? (
        <p className="possible-direction">
          <strong>Possible direction:</strong> {diagnostic.possibleDirection}
        </p>
      ) : null}
    </section>
  )
}

interface ManifestWorkbenchProps {
  readonly initialSource?: string
}

export function ManifestWorkbench({ initialSource = '' }: ManifestWorkbenchProps) {
  const [source, setSource] = useState(initialSource)
  const [analysis, setAnalysis] = useState(() => analyzeManifest(initialSource))
  const [analyzedSource, setAnalyzedSource] = useState(initialSource)
  const [selectedExampleId, setSelectedExampleId] = useState(brokenServiceSelectorExample.id)
  const [loadedExampleId, setLoadedExampleId] = useState<string>()
  const [jumpRequest, setJumpRequest] = useState<EditorJumpRequest>()
  const selectedResourceId = useWorkbenchStore(selectSelectedResourceId)
  const selectedRelationshipId = useWorkbenchStore(selectSelectedRelationshipId)
  const selectedDiagnosticId = useWorkbenchStore(selectSelectedDiagnosticId)
  const inspectorFocusToken = useWorkbenchStore(selectInspectorFocusToken)
  const inspectResource = useWorkbenchStore((state) => state.inspectResource)
  const inspectRelationship = useWorkbenchStore((state) => state.inspectRelationship)
  const inspectDiagnostic = useWorkbenchStore((state) => state.inspectDiagnostic)
  const focusDiagnosticInTopology = useWorkbenchStore((state) => state.focusDiagnosticInTopology)
  const clearSelection = useWorkbenchStore((state) => state.clearSelection)
  const selection: InspectorSelection | undefined = selectedResourceId
    ? { type: 'resource', id: selectedResourceId }
    : selectedRelationshipId
      ? { type: 'relationship', id: selectedRelationshipId }
      : selectedDiagnosticId
        ? { type: 'diagnostic', id: selectedDiagnosticId }
        : undefined

  const selectedExample = useMemo(
    () =>
      manifestExamples.find((example) => example.id === selectedExampleId) ??
      brokenServiceSelectorExample,
    [selectedExampleId],
  )
  const topology = useMemo(
    () => buildTopologyGraph(analysis.resources, analysis.relationships, analysis.diagnostics),
    [analysis],
  )
  const relationshipList = useMemo(() => buildRelationshipList(topology), [topology])
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAnalysis(analyzeManifest(source))
      setAnalyzedSource(source)
    }, analysisDelay)

    return () => window.clearTimeout(timer)
  }, [source])

  useEffect(() => {
    if (inspectorFocusToken === 0) {
      return
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById('inspector-title')?.focus()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [inspectorFocusToken])

  const isAnalyzing = source !== analyzedSource

  function loadExample(): void {
    setSource(selectedExample.source)
    setLoadedExampleId(selectedExample.id)
    clearSelection()
  }

  function resetExample(): void {
    const loadedExample = manifestExamples.find((example) => example.id === loadedExampleId)

    if (loadedExample) {
      setSource(loadedExample.source)
      clearSelection()
    }
  }

  function jumpToSource(range: SourceRange): void {
    setJumpRequest((current) => ({ range, token: (current?.token ?? 0) + 1 }))
  }

  function focusTopology(diagnostic: AnalysisDiagnostic): void {
    const resourceId = diagnostic.resourceIds[0]

    if (!resourceId) {
      return
    }

    focusDiagnosticInTopology(diagnostic.id, resourceId)
    window.requestAnimationFrame(() => {
      const resourceNode = [...document.querySelectorAll<HTMLElement>('[data-topology-node]')].find(
        (element) => element.dataset.topologyNode === resourceId,
      )
      resourceNode?.closest<HTMLElement>('.react-flow__node')?.focus()
    })
  }

  const statusText = isAnalyzing
    ? 'Analyzing…'
    : `${statusLabels[analysis.status]}. ${plural(analysis.summary.resources, 'resource')}, ${plural(analysis.summary.errors, 'error')}, ${plural(analysis.summary.warnings, 'warning')}, and ${plural(analysis.summary.relationships, 'relationship')}.`

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
            onClick={() => {
              setSource('')
              clearSelection()
            }}
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
            onChange={(value) => {
              setSource(value)
              clearSelection()
            }}
            value={source}
          />
        </section>

        <section aria-labelledby="analysis-results-title" className="results-panel">
          <div className="panel-heading results-heading">
            <div>
              <h3 className="text-lg font-semibold" id="analysis-results-title">
                Manifest analysis
              </h3>
              <p className="mt-1 text-sm text-muted">
                Static relationships from the supplied YAML.
              </p>
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
              <strong>{analysis.summary.relationships}</strong>
              <span>Relations</span>
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
                    : 'Resources, relationships, and precise source evidence will appear here.'}
                </p>
              </div>
            ) : null}

            {analysis.resources.length > 0 ? (
              <TopologyPanel graph={topology} relationshipList={relationshipList} />
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
                      onFocusTopology={focusTopology}
                      onInspect={(diagnostic) => inspectDiagnostic(diagnostic.id)}
                      onJump={jumpToSource}
                    />
                  ))}
                </ol>
              </section>
            ) : null}

            {analysis.resources.length > 0 ? (
              <Inspector
                analysis={analysis}
                onInspectRelationship={inspectRelationship}
                onJump={jumpToSource}
                selection={selection}
              />
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
                      onInspect={(item) => inspectResource(item.id)}
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
