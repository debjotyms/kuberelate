import type {
  AnalysisDiagnostic,
  AnalysisDiagnosticSeverity,
  KubernetesResource,
  RelationshipCertainty,
  ResourceId,
  ResourceRelationship,
} from '@/domain/model/analysis'

export type TopologyNodeStatus = 'ok' | AnalysisDiagnosticSeverity | 'missing'

export interface ResourceTopologyNode {
  readonly id: ResourceId
  readonly type: 'resource'
  readonly resourceId: ResourceId
  readonly kind: string
  readonly name: string
  readonly scope: string
  readonly namespaceNodeId: string
  readonly status: TopologyNodeStatus
  readonly diagnosticIds: readonly string[]
  readonly connectionCount: number
  readonly ariaLabel: string
}

export interface UnresolvedTopologyNode {
  readonly id: string
  readonly type: 'unresolved'
  readonly relationshipId: string
  readonly name: 'No matching workload'
  readonly description: string
  readonly status: 'missing'
  readonly ariaLabel: string
}

export interface NamespaceTopologyNode {
  readonly id: string
  readonly type: 'namespace'
  readonly namespace: string
  readonly scopeType: 'namespaced' | 'cluster' | 'unknown'
  readonly memberCount: number
  readonly ariaLabel: string
}

export type TopologyNode = ResourceTopologyNode | UnresolvedTopologyNode | NamespaceTopologyNode

export interface TopologyEdge {
  readonly id: string
  readonly relationshipId: string
  readonly source: ResourceId
  readonly target: string
  readonly verb: string
  readonly certainty: RelationshipCertainty
  readonly resolution: 'resolved' | 'missing'
  readonly label: string
  readonly summary: string
  readonly ariaLabel: string
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
  readonly certainty: RelationshipCertainty
  readonly verb: string
  readonly summary: string
  readonly ariaLabel: string
}

interface NamespacePresentation {
  readonly id: string
  readonly label: string
  readonly scopeType: NamespaceTopologyNode['scopeType']
}

const severityRank: Readonly<Record<AnalysisDiagnosticSeverity, number>> = {
  error: 3,
  warning: 2,
  info: 1,
}

function namespacePresentation(resource: KubernetesResource): NamespacePresentation {
  const scope = resource.identity.scope

  if (scope.type === 'namespaced') {
    return {
      id: `namespace:${JSON.stringify(scope.namespace)}`,
      label: scope.namespace,
      scopeType: 'namespaced',
    }
  }

  if (scope.type === 'cluster') {
    return { id: 'scope:cluster', label: 'Cluster scoped', scopeType: 'cluster' }
  }

  const label = scope.declaredNamespace
    ? `Scope unknown · ${scope.declaredNamespace}`
    : 'Scope unknown'

  return {
    id: `scope:unknown:${JSON.stringify(scope.declaredNamespace ?? '')}`,
    label,
    scopeType: 'unknown',
  }
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

function diagnosticsByResource(
  diagnostics: readonly AnalysisDiagnostic[],
): ReadonlyMap<ResourceId, readonly string[]> {
  const result = new Map<ResourceId, string[]>()

  for (const diagnostic of diagnostics) {
    for (const resourceId of diagnostic.resourceIds) {
      const current = result.get(resourceId)

      if (current) {
        current.push(diagnostic.id)
      } else {
        result.set(resourceId, [diagnostic.id])
      }
    }
  }

  return result
}

function missingNodeId(relationship: ResourceRelationship): string {
  return `unresolved:${relationship.id}`
}

function relationshipVerb(relationship: ResourceRelationship): string {
  switch (relationship.type) {
    case 'service-selects-workload':
      return 'selects'
  }
}

function statusLabel(status: TopologyNodeStatus): string {
  switch (status) {
    case 'error':
      return 'Error'
    case 'warning':
      return 'Warning'
    case 'info':
      return 'Information'
    case 'missing':
      return 'Unresolved'
    case 'ok':
      return 'No detected issues'
  }
}

export function buildTopologyGraph(
  resources: readonly KubernetesResource[],
  relationships: readonly ResourceRelationship[],
  diagnostics: readonly AnalysisDiagnostic[],
): TopologyGraph {
  const statuses = statusByResource(diagnostics)
  const diagnosticIds = diagnosticsByResource(diagnostics)
  const connectionCounts = new Map<ResourceId, number>()

  for (const relationship of relationships) {
    connectionCounts.set(relationship.source, (connectionCounts.get(relationship.source) ?? 0) + 1)

    if (relationship.resolution.state === 'resolved') {
      const target = relationship.resolution.target
      connectionCounts.set(target, (connectionCounts.get(target) ?? 0) + 1)
    }
  }

  const namespaceMembers = new Map<string, NamespacePresentation & { count: number }>()
  const resourceNodes: ResourceTopologyNode[] = resources.map((resource) => {
    const namespace = namespacePresentation(resource)
    const currentNamespace = namespaceMembers.get(namespace.id)
    namespaceMembers.set(namespace.id, {
      ...namespace,
      count: (currentNamespace?.count ?? 0) + 1,
    })

    const status = statuses.get(resource.id) ?? 'ok'
    const connectionCount = connectionCounts.get(resource.id) ?? 0

    return {
      id: resource.id,
      type: 'resource',
      resourceId: resource.id,
      kind: resource.kind,
      name: resource.name,
      scope: namespace.label,
      namespaceNodeId: namespace.id,
      status,
      diagnosticIds: diagnosticIds.get(resource.id) ?? [],
      connectionCount,
      ariaLabel: `${resource.kind} ${namespace.label}/${resource.name}. ${statusLabel(status)}. ${connectionCount} ${connectionCount === 1 ? 'connection' : 'connections'}.`,
    }
  })
  const namespaceNodes: NamespaceTopologyNode[] = [...namespaceMembers.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((namespace) => ({
      id: namespace.id,
      type: 'namespace',
      namespace: namespace.label,
      scopeType: namespace.scopeType,
      memberCount: namespace.count,
      ariaLabel: `${namespace.label}. ${namespace.count} ${namespace.count === 1 ? 'resource' : 'resources'}.`,
    }))
  const unresolvedNodes: UnresolvedTopologyNode[] = []
  const edges: TopologyEdge[] = []

  for (const relationship of relationships) {
    const target =
      relationship.resolution.state === 'resolved'
        ? relationship.resolution.target
        : missingNodeId(relationship)
    const verb = relationshipVerb(relationship)

    if (relationship.resolution.state === 'missing') {
      unresolvedNodes.push({
        id: target,
        type: 'unresolved',
        relationshipId: relationship.id,
        name: 'No matching workload',
        description: relationship.resolution.expected.description,
        status: 'missing',
        ariaLabel: `Unresolved target. ${relationship.resolution.expected.description}.`,
      })
    }

    edges.push({
      id: relationship.id,
      relationshipId: relationship.id,
      source: relationship.source,
      target,
      verb,
      certainty: relationship.certainty,
      resolution: relationship.resolution.state,
      label:
        relationship.resolution.state === 'resolved'
          ? `${verb} · ${relationship.certainty}`
          : `${verb} · no supplied match`,
      summary: relationship.evidence.summary,
      ariaLabel: `${relationship.evidence.summary} ${relationship.certainty} relationship, ${relationship.resolution.state}.`,
    })
  }

  return { nodes: [...namespaceNodes, ...resourceNodes, ...unresolvedNodes], edges }
}

export function buildRelationshipList(graph: TopologyGraph): readonly RelationshipListItem[] {
  return graph.edges.map((edge) => ({
    id: edge.relationshipId,
    source: edge.source,
    target: edge.resolution === 'resolved' ? (edge.target as ResourceId) : undefined,
    state: edge.resolution,
    certainty: edge.certainty,
    verb: edge.verb,
    summary: edge.summary,
    ariaLabel: edge.ariaLabel,
  }))
}
