export type ResourceId = string & { readonly __brand: 'ResourceId' }

export type ResourceKey = string & { readonly __brand: 'ResourceKey' }

export interface SourcePosition {
  readonly offset: number
  readonly line: number
  readonly column: number
}

export interface SourceRange {
  readonly start: SourcePosition
  readonly end: SourcePosition
}

export type ResourceScope =
  | { readonly type: 'namespaced'; readonly namespace: string }
  | { readonly type: 'cluster' }
  | { readonly type: 'unknown'; readonly declaredNamespace?: string }

export interface ResourceIdentity {
  readonly apiGroup: string
  readonly kind: string
  readonly name: string
  readonly scope: ResourceScope
}

export interface ResourceSource {
  readonly documentIndex: number
  readonly listItemIndex?: number
  readonly range?: SourceRange
  readonly fieldRanges: ReadonlyMap<string, SourceRange>
}

export type ResourceSupport = 'full' | 'partial' | 'generic'

export interface KubernetesResource {
  readonly id: ResourceId
  readonly key: ResourceKey
  readonly identity: ResourceIdentity
  readonly apiVersion: string
  readonly version: string
  readonly kind: string
  readonly name: string
  readonly labels: Readonly<Record<string, string>>
  readonly annotations: Readonly<Record<string, string>>
  readonly source: ResourceSource
  readonly support: ResourceSupport
  readonly raw: unknown
}

export type AnalysisDiagnosticSeverity = 'error' | 'warning' | 'info'

export type AnalysisDiagnosticCategory = 'parser' | 'identity' | 'limit'

export interface AnalysisDiagnostic {
  readonly id: string
  readonly code: string
  readonly severity: AnalysisDiagnosticSeverity
  readonly category: AnalysisDiagnosticCategory
  readonly title: string
  readonly message: string
  readonly documentIndex?: number
  readonly range?: SourceRange
  readonly resourceIds: readonly ResourceId[]
}

export interface ResourceIndex {
  readonly byKey: ReadonlyMap<ResourceKey, readonly ResourceId[]>
  readonly byKind: ReadonlyMap<string, readonly ResourceId[]>
  readonly byNamespace: ReadonlyMap<string, readonly ResourceId[]>
  readonly sourceOrder: readonly ResourceId[]
}

export interface AnalysisSummary {
  readonly resources: number
  readonly errors: number
  readonly warnings: number
  readonly documents: number
  readonly analyzedDocuments: number
}

export type AnalysisStatus = 'empty' | 'valid' | 'partial' | 'invalid' | 'limited'

export interface AnalysisResult {
  readonly revision: string
  readonly status: AnalysisStatus
  readonly resources: readonly KubernetesResource[]
  readonly diagnostics: readonly AnalysisDiagnostic[]
  readonly index: ResourceIndex
  readonly summary: AnalysisSummary
}

export interface AnalysisLimits {
  readonly maxSourceBytes: number
  readonly maxDocuments: number
  readonly maxResources: number
  readonly maxAliasCount: number
}

export const DEFAULT_ANALYSIS_LIMITS: AnalysisLimits = {
  maxSourceBytes: 2 * 1024 * 1024,
  maxDocuments: 250,
  maxResources: 500,
  maxAliasCount: 100,
}
