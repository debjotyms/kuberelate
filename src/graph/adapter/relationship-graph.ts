import type {
  AnalysisDiagnostic,
  AnalysisDiagnosticSeverity,
  KubernetesResource,
  ResourceId,
  ResourceRelationship,
} from '@/domain/model/analysis'

export type TopologyNodeStatus = 'ok' | AnalysisDiagnosticSeverity | 'missing'

export type TopologyNode =
  | {
      readonly id: ResourceId
      readonly type: 'resource'
      readonly resourceId: ResourceId
      readonly kind: string
      readonly name: string
      readonly scope: string
      readonly status: TopologyNodeStatus
    }
  | {
      readonly id: string
      readonly type: 'missing'
      readonly name: 'No matching workload'
      readonly description: string
      readonly status: 'missing'
    }

export interface TopologyEdge {
  readonly id: string
  readonly relationshipId: string
  readonly source: string
  readonly target: string
  readonly verb: 'selects'
  readonly certainty: 'inferred'
  readonly resolution: 'resolved' | 'missing'
  readonly label: string
}

export interface TopologyGraph {
  readonly nodes: readonly TopologyNode[]
  readonly edges: readonly TopologyEdge[]
}

export interface RelationshipListItem {
  readonly id: string
  readonly source: ResourceId
  readonly target?: ResourceId
  readonly state: 'resolved' | 'missing'
  readonly certainty: 'inferred'
  readonly summary: string
}

const severityRank: Readonly<Record<AnalysisDiagnosticSeverity, number>> = {
  error: 3,
  warning: 2,
  info: 1,
}

function scopeLabel(resource: KubernetesResource): string {
  const scope = resource.identity.scope

  if (scope.type === 'namespaced') {
    return scope.namespace
  }

  return scope.type === 'cluster' ? 'cluster-scoped' : (scope.declaredNamespace ?? 'scope unknown')
}

function statusByResource(
  diagnostics: readonly AnalysisDiagnostic[],
): ReadonlyMap<ResourceId, AnalysisDiagnosticSeverity> {
  const statuses = new Map<ResourceId, AnalysisDiagnosticSeverity>()

  for (const diagnostic of diagnostics) {
    for (const resourceId of diagnostic.resourceIds) {
      const current = statuses.get(resourceId)

      if (!current || severityRank[diagnostic.severity] > severityRank[current]) {
        statuses.set(resourceId, diagnostic.severity)
      }
    }
  }

  return statuses
}

function missingNodeId(relationship: ResourceRelationship): string {
  return `missing:${relationship.id}`
}

export function buildTopologyGraph(
  resources: readonly KubernetesResource[],
  relationships: readonly ResourceRelationship[],
  diagnostics: readonly AnalysisDiagnostic[],
): TopologyGraph {
  const statuses = statusByResource(diagnostics)
  const nodes: TopologyNode[] = resources.map((resource) => ({
    id: resource.id,
    type: 'resource',
    resourceId: resource.id,
    kind: resource.kind,
    name: resource.name,
    scope: scopeLabel(resource),
    status: statuses.get(resource.id) ?? 'ok',
  }))
  const edges: TopologyEdge[] = []

  for (const relationship of relationships) {
    const target =
      relationship.resolution.state === 'resolved'
        ? relationship.resolution.target
        : missingNodeId(relationship)

    if (relationship.resolution.state === 'missing') {
      nodes.push({
        id: target,
        type: 'missing',
        name: 'No matching workload',
        description: relationship.resolution.expected.description,
        status: 'missing',
      })
    }

    edges.push({
      id: relationship.id,
      relationshipId: relationship.id,
      source: relationship.source,
      target,
      verb: 'selects',
      certainty: 'inferred',
      resolution: relationship.resolution.state,
      label:
        relationship.resolution.state === 'resolved'
          ? 'selects · inferred'
          : 'selects · no supplied match',
    })
  }

  return { nodes, edges }
}

export function buildRelationshipList(
  relationships: readonly ResourceRelationship[],
): readonly RelationshipListItem[] {
  return relationships.map((relationship) => ({
    id: relationship.id,
    source: relationship.source,
    target:
      relationship.resolution.state === 'resolved' ? relationship.resolution.target : undefined,
    state: relationship.resolution.state,
    certainty: 'inferred',
    summary: relationship.evidence.summary,
  }))
}
