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

export type AnalysisDiagnosticCategory = 'parser' | 'identity' | 'limit' | 'selector'

export type StaticCertainty = 'definite' | 'input-scoped' | 'informational'

export type SafeEvidenceKind = 'selector' | 'labels' | 'namespace' | 'resource'

export interface SafeEvidenceItem {
  readonly kind: SafeEvidenceKind
  readonly label: string
  readonly value: string
  readonly sourcePath?: string
  readonly resourceId?: ResourceId
  readonly range?: SourceRange
}

export interface AnalysisDiagnostic {
  readonly id: string
  readonly code: string
  readonly severity: AnalysisDiagnosticSeverity
  readonly category: AnalysisDiagnosticCategory
  readonly certainty: StaticCertainty
  readonly title: string
  readonly message: string
  readonly whyItMatters?: string
  readonly evidence: readonly SafeEvidenceItem[]
  readonly verificationCommands: readonly string[]
  readonly possibleDirection?: string
  readonly documentIndex?: number
  readonly range?: SourceRange
  readonly sourceRanges: readonly SourceRange[]
  readonly resourceIds: readonly ResourceId[]
  readonly relationshipIds: readonly string[]
}

export type LabelMatchState = 'match' | 'missing-key' | 'different-value'

export interface LabelMatchComparison {
  readonly key: string
  readonly expected: string
  readonly actual?: string
  readonly state: LabelMatchState
}

export interface EqualitySelectorMatchResult {
  readonly matches: boolean
  readonly comparisons: readonly LabelMatchComparison[]
}

export type WorkloadLabelSource = 'pod' | 'pod-template'

export interface WorkloadLabelTarget {
  readonly resourceId: ResourceId
  readonly namespace: string
  readonly source: WorkloadLabelSource
  readonly sourcePath: 'metadata.labels' | 'spec.template.metadata.labels'
  readonly labels: Readonly<Record<string, string>>
  readonly range?: SourceRange
}

export interface WorkloadLabelIndex {
  readonly byResource: ReadonlyMap<ResourceId, WorkloadLabelTarget>
  readonly byNamespace: ReadonlyMap<string, readonly ResourceId[]>
  readonly byNamespacedLabel: ReadonlyMap<string, readonly ResourceId[]>
}

export interface ResourceIndex {
  readonly byKey: ReadonlyMap<ResourceKey, readonly ResourceId[]>
  readonly byKind: ReadonlyMap<string, readonly ResourceId[]>
  readonly byNamespace: ReadonlyMap<string, readonly ResourceId[]>
  readonly workloadLabels: WorkloadLabelIndex
  readonly sourceOrder: readonly ResourceId[]
}

export type RelationshipType = 'service-selects-workload'

export type RelationshipCertainty = 'explicit' | 'inferred'

export type RelationshipResolution =
  | { readonly state: 'resolved'; readonly target: ResourceId }
  | { readonly state: 'missing'; readonly expected: { readonly description: string } }

export interface RelationshipComparison {
  readonly target: ResourceId
  readonly labels: Readonly<Record<string, string>>
  readonly result: EqualitySelectorMatchResult
  readonly sourcePath: WorkloadLabelTarget['sourcePath']
  readonly range?: SourceRange
}

export interface RelationshipEvidence {
  readonly sourcePath: 'spec.selector'
  readonly summary: string
  readonly selector: Readonly<Record<string, string>>
  readonly sourceRange?: SourceRange
  readonly targetRange?: SourceRange
  readonly targetLabelSource?: WorkloadLabelSource
  readonly comparisons: readonly RelationshipComparison[]
}

export interface ResourceRelationship {
  readonly id: string
  readonly source: ResourceId
  readonly type: RelationshipType
  readonly certainty: RelationshipCertainty
  readonly resolution: RelationshipResolution
  readonly evidence: RelationshipEvidence
}

export interface AnalysisSummary {
  readonly resources: number
  readonly errors: number
  readonly warnings: number
  readonly relationships: number
  readonly documents: number
  readonly analyzedDocuments: number
}

export type AnalysisStatus = 'empty' | 'valid' | 'partial' | 'invalid' | 'limited'

export interface AnalysisResult {
  readonly revision: string
  readonly status: AnalysisStatus
  readonly resources: readonly KubernetesResource[]
  readonly relationships: readonly ResourceRelationship[]
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
