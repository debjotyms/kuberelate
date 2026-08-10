import * as z from 'zod/mini'
import {
  isMap,
  isNode,
  isSeq,
  LineCounter,
  parseAllDocuments,
  visit,
  type Document,
  type Node,
  type YAMLError,
} from 'yaml'

import { buildResourceIndex, emptyResourceIndex } from '@/domain/indexes/resource-index'
import { createDiagnostic } from '@/domain/diagnostics/diagnostic'
import { deploymentSelectorDiagnostics } from '@/domain/diagnostics/rules/deployment-selector'
import { serviceSelectorDiagnostics } from '@/domain/diagnostics/rules/service-selector'
import {
  DEFAULT_ANALYSIS_LIMITS,
  type AnalysisDiagnostic,
  type AnalysisDiagnosticSeverity,
  type AnalysisLimits,
  type AnalysisResult,
  type AnalysisStatus,
  type KubernetesResource,
  type ResourceId,
  type ResourceIdentity,
  type ResourceKey,
  type ResourceScope,
  type SourceRange,
} from '@/domain/model/analysis'
import { getResourceDefinition } from '@/domain/resources/registry'
import { serviceSelectsWorkloadRelationships } from '@/domain/relationships/rules/service-selects-workload'

import { findNodeAtPath, toSourceRange } from './source'

const envelopeSchema = z.object({
  apiVersion: z.string(),
  kind: z.string(),
  metadata: z.object({
    name: z.string(),
    namespace: z.optional(z.string()),
  }),
})

const severityOrder: Readonly<Record<AnalysisDiagnosticSeverity, number>> = {
  error: 0,
  warning: 1,
  info: 2,
}

interface MutableAnalysis {
  readonly resources: KubernetesResource[]
  readonly diagnostics: AnalysisDiagnostic[]
  candidateCount: number
  resourceLimitReached: boolean
}

interface ResourceCandidate {
  readonly raw: unknown
  readonly node?: Node
  readonly documentIndex: number
  readonly listItemIndex?: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanParserMessage(error: YAMLError): string {
  return firstMessageLine(error.message)
}

function firstMessageLine(message: string): string {
  return message.split('\n', 1)[0] ?? message
}

const diagnostic = createDiagnostic

function hashSource(source: string): string {
  let hash = 0x811c9dc5

  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(36)
}

function parseApiVersion(apiVersion: string): { apiGroup: string; version: string } | undefined {
  const parts = apiVersion.split('/')

  if (parts.length === 1 && parts[0]) {
    return { apiGroup: '', version: parts[0] }
  }

  if (parts.length === 2 && parts[0] && parts[1]) {
    return { apiGroup: parts[0], version: parts[1] }
  }

  return undefined
}

function readStringMap(value: unknown): Readonly<Record<string, string>> {
  if (!isRecord(value)) {
    return {}
  }

  const entries = Object.entries(value).filter(
    (entry): entry is [string, string] => typeof entry[1] === 'string',
  )

  return Object.freeze(Object.fromEntries(entries))
}

function scopeFor(
  apiGroup: string,
  kind: string,
  declaredNamespace: string | undefined,
): { scope: ResourceScope; support: KubernetesResource['support'] } {
  const definition = getResourceDefinition(apiGroup, kind)

  if (!definition) {
    return {
      scope: declaredNamespace ? { type: 'unknown', declaredNamespace } : { type: 'unknown' },
      support: 'generic',
    }
  }

  if (definition.scope === 'cluster') {
    return { scope: { type: 'cluster' }, support: definition.support }
  }

  return {
    scope: { type: 'namespaced', namespace: declaredNamespace ?? 'default' },
    support: definition.support,
  }
}

function canonicalKey(identity: ResourceIdentity): ResourceKey {
  const scope =
    identity.scope.type === 'namespaced'
      ? `namespace:${identity.scope.namespace}`
      : identity.scope.type === 'cluster'
        ? 'cluster'
        : `unknown:${identity.scope.declaredNamespace ?? ''}`

  return JSON.stringify([identity.apiGroup, identity.kind, scope, identity.name]) as ResourceKey
}

function occurrenceId(
  key: ResourceKey,
  documentIndex: number,
  listItemIndex: number | undefined,
): ResourceId {
  return `resource:${documentIndex}:${listItemIndex ?? 'root'}:${key}` as ResourceId
}

function fieldRanges(
  node: Node | undefined,
  lineCounter: LineCounter,
): ReadonlyMap<string, SourceRange> {
  const ranges = new Map<string, SourceRange>()
  const paths: readonly [string, readonly (string | number)[]][] = [
    ['apiVersion', ['apiVersion']],
    ['kind', ['kind']],
    ['metadata.name', ['metadata', 'name']],
    ['metadata.namespace', ['metadata', 'namespace']],
    ['metadata.labels', ['metadata', 'labels']],
    ['spec.type', ['spec', 'type']],
    ['spec.selector', ['spec', 'selector']],
    ['spec.selector.matchLabels', ['spec', 'selector', 'matchLabels']],
    ['spec.selector.matchExpressions', ['spec', 'selector', 'matchExpressions']],
    ['spec.template.metadata.labels', ['spec', 'template', 'metadata', 'labels']],
  ]

  for (const [name, path] of paths) {
    const range = toSourceRange(findNodeAtPath(node ?? null, path)?.range, lineCounter)

    if (range) {
      ranges.set(name, range)
    }
  }

  return ranges
}

function normalizeCandidate(
  candidate: ResourceCandidate,
  lineCounter: LineCounter,
  state: MutableAnalysis,
): KubernetesResource | undefined {
  const sourceRange = toSourceRange(candidate.node?.range, lineCounter)
  const parsed = envelopeSchema.safeParse(candidate.raw)

  if (!parsed.success) {
    state.diagnostics.push(
      diagnostic({
        code: 'KG-RESOURCE-001',
        severity: 'error',
        category: 'identity',
        title: 'Invalid Kubernetes resource identity',
        message:
          'Each resource must provide string values for apiVersion, kind, and metadata.name.',
        documentIndex: candidate.documentIndex,
        range: sourceRange,
      }),
    )
    return undefined
  }

  const { apiVersion, kind, metadata } = parsed.data

  if (!apiVersion.trim() || !kind.trim() || !metadata.name.trim()) {
    state.diagnostics.push(
      diagnostic({
        code: 'KG-RESOURCE-001',
        severity: 'error',
        category: 'identity',
        title: 'Empty Kubernetes resource identity',
        message: 'apiVersion, kind, and metadata.name cannot be empty.',
        documentIndex: candidate.documentIndex,
        range: sourceRange,
      }),
    )
    return undefined
  }

  const api = parseApiVersion(apiVersion)

  if (!api) {
    state.diagnostics.push(
      diagnostic({
        code: 'KG-RESOURCE-001',
        severity: 'error',
        category: 'identity',
        title: 'Invalid apiVersion',
        message: 'apiVersion must be either a core version such as v1 or group/version.',
        documentIndex: candidate.documentIndex,
        range: fieldRanges(candidate.node, lineCounter).get('apiVersion') ?? sourceRange,
      }),
    )
    return undefined
  }

  const declaredNamespace = metadata.namespace?.trim() || undefined
  const resolved = scopeFor(api.apiGroup, kind, declaredNamespace)
  const identity: ResourceIdentity = {
    apiGroup: api.apiGroup,
    kind,
    name: metadata.name,
    scope: resolved.scope,
  }
  const key = canonicalKey(identity)
  const id = occurrenceId(key, candidate.documentIndex, candidate.listItemIndex)

  if (resolved.scope.type === 'cluster' && declaredNamespace) {
    state.diagnostics.push(
      diagnostic({
        code: 'KG-RESOURCE-002',
        severity: 'warning',
        category: 'identity',
        title: 'Cluster-scoped resource declares a namespace',
        message: `${kind} is cluster-scoped, so metadata.namespace is not part of its identity.`,
        documentIndex: candidate.documentIndex,
        range: fieldRanges(candidate.node, lineCounter).get('metadata.namespace') ?? sourceRange,
        resourceIds: [id],
      }),
    )
  }

  const rawRecord = isRecord(candidate.raw) ? candidate.raw : {}
  const rawMetadata = isRecord(rawRecord.metadata) ? rawRecord.metadata : {}

  return {
    id,
    key,
    identity,
    apiVersion,
    version: api.version,
    kind,
    name: metadata.name,
    labels: readStringMap(rawMetadata.labels),
    annotations: readStringMap(rawMetadata.annotations),
    source: {
      documentIndex: candidate.documentIndex,
      listItemIndex: candidate.listItemIndex,
      range: sourceRange,
      fieldRanges: fieldRanges(candidate.node, lineCounter),
    },
    support: resolved.support,
    raw: candidate.raw,
  }
}

function addCandidate(
  candidate: ResourceCandidate,
  lineCounter: LineCounter,
  state: MutableAnalysis,
  limits: AnalysisLimits,
): void {
  if (state.candidateCount >= limits.maxResources) {
    if (!state.resourceLimitReached) {
      state.resourceLimitReached = true
      state.diagnostics.push(
        diagnostic({
          code: 'KG-LIMIT-003',
          severity: 'error',
          category: 'limit',
          title: 'Resource limit reached',
          message: `Only the first ${limits.maxResources} resource entries were analyzed. Reduce the input and try again.`,
          documentIndex: candidate.documentIndex,
          range: toSourceRange(candidate.node?.range, lineCounter),
        }),
      )
    }
    return
  }

  state.candidateCount += 1

  const resource = normalizeCandidate(candidate, lineCounter, state)

  if (resource) {
    state.resources.push(resource)
  }
}

function addDocumentMessages(
  document: Document<Node, true>,
  documentIndex: number,
  lineCounter: LineCounter,
  state: MutableAnalysis,
): void {
  for (const error of document.errors) {
    state.diagnostics.push(
      diagnostic({
        code: `KG-YAML-${error.code}`,
        severity: 'error',
        category: 'parser',
        title: 'YAML parse error',
        message: cleanParserMessage(error),
        documentIndex,
        range: toSourceRange([error.pos[0], error.pos[1], error.pos[1]], lineCounter),
      }),
    )
  }

  for (const warning of document.warnings) {
    state.diagnostics.push(
      diagnostic({
        code: `KG-YAML-${warning.code}`,
        severity: 'warning',
        category: 'parser',
        title: 'YAML parser warning',
        message: cleanParserMessage(warning),
        documentIndex,
        range: toSourceRange([warning.pos[0], warning.pos[1], warning.pos[1]], lineCounter),
      }),
    )
  }
}

function findTemplateRange(
  root: Node,
  source: string,
  lineCounter: LineCounter,
): SourceRange | undefined {
  let result: SourceRange | undefined

  visit(root, (_key, node) => {
    if (!isMap(node) || !node.range) {
      return
    }

    const value = source.slice(node.range[0], node.range[1]).trimStart()

    if (value.startsWith('{{') || value.startsWith('{{-')) {
      result = toSourceRange(node.range, lineCounter)
      return visit.BREAK
    }
  })

  return result
}

function processDocument(
  document: Document<Node, true>,
  documentIndex: number,
  source: string,
  lineCounter: LineCounter,
  state: MutableAnalysis,
  limits: AnalysisLimits,
): void {
  addDocumentMessages(document, documentIndex, lineCounter, state)

  if (document.contents) {
    const templateRange = findTemplateRange(document.contents, source, lineCounter)

    if (templateRange) {
      state.diagnostics.push(
        diagnostic({
          code: 'KG-YAML-TEMPLATE',
          severity: 'error',
          category: 'parser',
          title: 'Template expression is not supported',
          message:
            'Render Helm or another template source to plain Kubernetes YAML before analyzing it.',
          documentIndex,
          range: templateRange,
        }),
      )
      return
    }
  }

  if (document.errors.length > 0 || document.contents === null) {
    return
  }

  let raw: unknown

  try {
    raw = document.toJS({ maxAliasCount: limits.maxAliasCount }) as unknown
  } catch (error) {
    state.diagnostics.push(
      diagnostic({
        code: 'KG-YAML-ALIAS_LIMIT',
        severity: 'error',
        category: 'parser',
        title: 'YAML alias expansion limit reached',
        message:
          error instanceof Error
            ? firstMessageLine(error.message)
            : 'The document could not be converted safely.',
        documentIndex,
        range: toSourceRange(document.contents.range, lineCounter),
      }),
    )
    return
  }

  if (raw === null || raw === undefined) {
    return
  }

  if (isRecord(raw) && raw.kind === 'List') {
    if (!Array.isArray(raw.items)) {
      state.diagnostics.push(
        diagnostic({
          code: 'KG-RESOURCE-004',
          severity: 'error',
          category: 'identity',
          title: 'Invalid Kubernetes List',
          message: 'A resource with kind: List must contain an items array.',
          documentIndex,
          range: toSourceRange(document.contents.range, lineCounter),
        }),
      )
      return
    }

    const itemsNode = findNodeAtPath(document.contents, ['items'])
    const itemNodes = itemsNode && isSeq(itemsNode) ? itemsNode.items : []

    for (const [listItemIndex, item] of raw.items.entries()) {
      const itemNode = itemNodes[listItemIndex]
      addCandidate(
        {
          raw: item,
          node: isNode(itemNode) ? itemNode : undefined,
          documentIndex,
          listItemIndex,
        },
        lineCounter,
        state,
        limits,
      )

      if (state.resourceLimitReached) {
        break
      }
    }
    return
  }

  addCandidate({ raw, node: document.contents, documentIndex }, lineCounter, state, limits)
}

function duplicateDiagnostics(
  resources: readonly KubernetesResource[],
  index: ReturnType<typeof buildResourceIndex>,
): AnalysisDiagnostic[] {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]))
  const diagnostics: AnalysisDiagnostic[] = []

  for (const ids of index.byKey.values()) {
    if (ids.length < 2) {
      continue
    }

    const first = resourceById.get(ids[0])
    const locations = ids
      .map((id) => resourceById.get(id))
      .filter((resource): resource is KubernetesResource => resource !== undefined)
      .map((resource) => `document ${resource.source.documentIndex + 1}`)
      .join(', ')

    diagnostics.push(
      diagnostic({
        code: 'KG-RESOURCE-003',
        severity: 'error',
        category: 'identity',
        title: 'Duplicate resource identity',
        message: `The same canonical resource identity appears in ${locations}.`,
        documentIndex: first?.source.documentIndex,
        range: first?.source.range,
        resourceIds: ids,
      }),
    )
  }

  return diagnostics
}

function sortDiagnostics(diagnostics: readonly AnalysisDiagnostic[]): AnalysisDiagnostic[] {
  return [...diagnostics].sort((left, right) => {
    return (
      severityOrder[left.severity] - severityOrder[right.severity] ||
      (left.documentIndex ?? Number.MAX_SAFE_INTEGER) -
        (right.documentIndex ?? Number.MAX_SAFE_INTEGER) ||
      (left.range?.start.offset ?? Number.MAX_SAFE_INTEGER) -
        (right.range?.start.offset ?? Number.MAX_SAFE_INTEGER) ||
      left.code.localeCompare(right.code)
    )
  })
}

function statusFor(
  source: string,
  resources: readonly KubernetesResource[],
  diagnostics: readonly AnalysisDiagnostic[],
): AnalysisStatus {
  if (!source.trim() && diagnostics.length === 0) {
    return 'empty'
  }

  if (diagnostics.some((item) => item.category === 'limit')) {
    return 'limited'
  }

  const hasErrors = diagnostics.some((item) => item.severity === 'error')

  if (hasErrors) {
    return resources.length > 0 ? 'partial' : 'invalid'
  }

  return resources.length > 0 ? 'valid' : 'empty'
}

function resultFrom(
  source: string,
  resources: readonly KubernetesResource[],
  diagnostics: readonly AnalysisDiagnostic[],
  documents: number,
  analyzedDocuments: number,
): AnalysisResult {
  const index = buildResourceIndex(resources)
  const relationships = serviceSelectsWorkloadRelationships(resources, index)
  const sortedDiagnostics = sortDiagnostics([
    ...diagnostics,
    ...duplicateDiagnostics(resources, index),
    ...deploymentSelectorDiagnostics(resources),
    ...serviceSelectorDiagnostics(resources, relationships),
  ])

  return {
    revision: hashSource(source),
    status: statusFor(source, resources, sortedDiagnostics),
    resources,
    relationships,
    diagnostics: sortedDiagnostics,
    index,
    summary: {
      resources: resources.length,
      errors: sortedDiagnostics.filter((item) => item.severity === 'error').length,
      warnings: sortedDiagnostics.filter((item) => item.severity === 'warning').length,
      relationships: relationships.length,
      documents,
      analyzedDocuments,
    },
  }
}

export function analyzeManifest(
  source: string,
  options: Partial<AnalysisLimits> = {},
): AnalysisResult {
  const limits = { ...DEFAULT_ANALYSIS_LIMITS, ...options }
  const sourceBytes = new TextEncoder().encode(source).byteLength

  if (sourceBytes > limits.maxSourceBytes) {
    const message = diagnostic({
      code: 'KG-LIMIT-001',
      severity: 'error',
      category: 'limit',
      title: 'Manifest input is too large',
      message: `The input is ${sourceBytes.toLocaleString()} bytes; the limit is ${limits.maxSourceBytes.toLocaleString()} bytes. The editor content was kept unchanged.`,
    })

    return {
      revision: hashSource(source),
      status: 'limited',
      resources: [],
      relationships: [],
      diagnostics: [message],
      index: emptyResourceIndex(),
      summary: {
        resources: 0,
        errors: 1,
        warnings: 0,
        relationships: 0,
        documents: 0,
        analyzedDocuments: 0,
      },
    }
  }

  const lineCounter = new LineCounter()
  let documentList: Document<Node, true>[]

  try {
    const documents = parseAllDocuments(source, {
      lineCounter,
      logLevel: 'silent',
      prettyErrors: true,
      strict: true,
      uniqueKeys: true,
    })
    documentList = [...documents]
  } catch {
    return resultFrom(
      source,
      [],
      [
        diagnostic({
          code: 'KG-YAML-INTERNAL',
          severity: 'error',
          category: 'parser',
          title: 'YAML parser could not continue',
          message: 'An unexpected parser error occurred.',
        }),
      ],
      0,
      0,
    )
  }

  const state: MutableAnalysis = {
    resources: [],
    diagnostics: [],
    candidateCount: 0,
    resourceLimitReached: false,
  }

  const analyzedDocuments = Math.min(documentList.length, limits.maxDocuments)

  if (documentList.length > limits.maxDocuments) {
    const firstOmitted = documentList[limits.maxDocuments]
    state.diagnostics.push(
      diagnostic({
        code: 'KG-LIMIT-002',
        severity: 'error',
        category: 'limit',
        title: 'Document limit reached',
        message: `Only the first ${limits.maxDocuments} YAML documents were analyzed. Reduce the input and try again.`,
        documentIndex: limits.maxDocuments,
        range: toSourceRange(firstOmitted?.range, lineCounter),
      }),
    )
  }

  for (const [documentIndex, document] of documentList.slice(0, limits.maxDocuments).entries()) {
    processDocument(document, documentIndex, source, lineCounter, state, limits)

    if (state.resourceLimitReached) {
      break
    }
  }

  return resultFrom(
    source,
    state.resources,
    state.diagnostics,
    documentList.length,
    analyzedDocuments,
  )
}
