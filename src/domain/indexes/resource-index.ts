import type {
  KubernetesResource,
  ResourceId,
  ResourceIndex,
  ResourceKey,
} from '@/domain/model/analysis'

function append<K>(map: Map<K, ResourceId[]>, key: K, id: ResourceId): void {
  const current = map.get(key)

  if (current) {
    current.push(id)
    return
  }

  map.set(key, [id])
}

function namespaceIndexKey(resource: KubernetesResource): string {
  const { scope } = resource.identity

  if (scope.type === 'namespaced') {
    return scope.namespace
  }

  if (scope.type === 'cluster') {
    return '@cluster'
  }

  return scope.declaredNamespace ?? '@unknown'
}

export function buildResourceIndex(resources: readonly KubernetesResource[]): ResourceIndex {
  const byKey = new Map<ResourceKey, ResourceId[]>()
  const byKind = new Map<string, ResourceId[]>()
  const byNamespace = new Map<string, ResourceId[]>()
  const sourceOrder: ResourceId[] = []

  for (const resource of resources) {
    append(byKey, resource.key, resource.id)
    append(byKind, `${resource.identity.apiGroup}|${resource.kind}`, resource.id)
    append(byNamespace, namespaceIndexKey(resource), resource.id)
    sourceOrder.push(resource.id)
  }

  return { byKey, byKind, byNamespace, sourceOrder }
}

export function emptyResourceIndex(): ResourceIndex {
  return {
    byKey: new Map(),
    byKind: new Map(),
    byNamespace: new Map(),
    sourceOrder: [],
  }
}
