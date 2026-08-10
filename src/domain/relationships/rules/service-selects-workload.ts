import { namespacedLabelIndexKey } from '@/domain/indexes/resource-index'
import type {
  KubernetesResource,
  ResourceId,
  ResourceIndex,
  ResourceRelationship,
  WorkloadLabelTarget,
} from '@/domain/model/analysis'
import { extractServiceSelector } from '@/domain/resources/workload-labels'
import { formatLabelMap, matchEqualitySelector } from '@/domain/selectors/equality-selector'

function relationshipId(source: ResourceId, target: ResourceId | 'missing'): string {
  return `relationship:service-selects-workload:${source}:${target}`
}

function matchingTargets(
  namespace: string,
  selector: Readonly<Record<string, string>>,
  index: ResourceIndex,
): readonly WorkloadLabelTarget[] {
  const namespaceTargets = index.workloadLabels.byNamespace.get(namespace) ?? []
  const labelSets = Object.entries(selector).map(
    ([key, value]) =>
      new Set(
        index.workloadLabels.byNamespacedLabel.get(
          namespacedLabelIndexKey(namespace, key, value),
        ) ?? [],
      ),
  )

  return namespaceTargets.flatMap((id) => {
    if (!labelSets.every((ids) => ids.has(id))) {
      return []
    }

    const target = index.workloadLabels.byResource.get(id)
    return target ? [target] : []
  })
}

function resolvedSummary(
  service: KubernetesResource,
  targetResource: KubernetesResource,
  target: WorkloadLabelTarget,
  selector: Readonly<Record<string, string>>,
): string {
  const targetDescription =
    target.source === 'pod'
      ? `Pod ${target.namespace}/${targetResource.name}`
      : `Pods represented by Deployment ${target.namespace}/${targetResource.name}`

  return `Service ${target.namespace}/${service.name} selects ${targetDescription} using ${formatLabelMap(selector)}.`
}

export function serviceSelectsWorkloadRelationships(
  resources: readonly KubernetesResource[],
  index: ResourceIndex,
): readonly ResourceRelationship[] {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]))
  const relationships: ResourceRelationship[] = []

  for (const service of resources) {
    const selector = extractServiceSelector(service)

    if (!selector || service.identity.scope.type !== 'namespaced') {
      continue
    }

    const namespace = service.identity.scope.namespace
    const targets = matchingTargets(namespace, selector, index)
    const sourceRange = service.source.fieldRanges.get('spec.selector')

    if (targets.length > 0) {
      for (const target of targets) {
        const targetResource = resourceById.get(target.resourceId)

        if (!targetResource) {
          continue
        }

        relationships.push({
          id: relationshipId(service.id, target.resourceId),
          source: service.id,
          type: 'service-selects-workload',
          certainty: 'inferred',
          resolution: { state: 'resolved', target: target.resourceId },
          evidence: {
            sourcePath: 'spec.selector',
            summary: resolvedSummary(service, targetResource, target, selector),
            selector,
            sourceRange,
            targetRange: target.range,
            targetLabelSource: target.source,
            comparisons: [],
          },
        })
      }
      continue
    }

    const comparisons = (index.workloadLabels.byNamespace.get(namespace) ?? []).flatMap((id) => {
      const target = index.workloadLabels.byResource.get(id)

      return target
        ? [
            {
              target: id,
              labels: target.labels,
              result: matchEqualitySelector(selector, target.labels),
              sourcePath: target.sourcePath,
              range: target.range,
            },
          ]
        : []
    })

    relationships.push({
      id: relationshipId(service.id, 'missing'),
      source: service.id,
      type: 'service-selects-workload',
      certainty: 'inferred',
      resolution: {
        state: 'missing',
        expected: {
          description: `No supplied matching Pod or Deployment Pod template in namespace ${namespace}`,
        },
      },
      evidence: {
        sourcePath: 'spec.selector',
        summary: `Service ${namespace}/${service.name} selects no supplied Pod or supported Pod template using ${formatLabelMap(selector)}.`,
        selector,
        sourceRange,
        comparisons,
      },
    })
  }

  return relationships
}
