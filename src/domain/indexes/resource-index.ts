import type {
  KubernetesResource,
  ResourceId,
  ResourceIndex,
  ResourceKey,
  WorkloadLabelIndex,
  WorkloadLabelTarget,
} from '@/domain/model/analysis'
import { extractWorkloadLabels } from '@/domain/resources/workload-labels'

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

export function namespacedLabelIndexKey(namespace: string, key: string, value: string): string {
  return JSON.stringify([namespace, key, value])
}

function buildWorkloadLabelIndex(resources: readonly KubernetesResource[]): WorkloadLabelIndex {
  const byResource = new Map<ResourceId, WorkloadLabelTarget>()
  const byNamespace = new Map<string, ResourceId[]>()
  const byNamespacedLabel = new Map<string, ResourceId[]>()

  for (const resource of resources) {
    const target = extractWorkloadLabels(resource)

    if (!target) {
      continue
    }

    byResource.set(resource.id, target)
    append(byNamespace, target.namespace, resource.id)

    for (const [key, value] of Object.entries(target.labels)) {
      append(byNamespacedLabel, namespacedLabelIndexKey(target.namespace, key, value), resource.id)
    }
  }

  return { byResource, byNamespace, byNamespacedLabel }
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

  return {
    byKey,
    byKind,
    byNamespace,
    workloadLabels: buildWorkloadLabelIndex(resources),
    sourceOrder,
  }
}

export function emptyResourceIndex(): ResourceIndex {
  return {
    byKey: new Map(),
    byKind: new Map(),
    byNamespace: new Map(),
    workloadLabels: {
      byResource: new Map(),
      byNamespace: new Map(),
      byNamespacedLabel: new Map(),
    },
    sourceOrder: [],
  }
}
