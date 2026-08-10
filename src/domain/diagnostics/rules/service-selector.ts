import { shellArgument } from '@/domain/diagnostics/commands'
import { createDiagnostic } from '@/domain/diagnostics/diagnostic'
import type {
  AnalysisDiagnostic,
  KubernetesResource,
  ResourceRelationship,
} from '@/domain/model/analysis'
import { formatLabelMap } from '@/domain/selectors/equality-selector'

export function serviceSelectorDiagnostics(
  resources: readonly KubernetesResource[],
  relationships: readonly ResourceRelationship[],
): readonly AnalysisDiagnostic[] {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]))

  return relationships.flatMap((relationship) => {
    if (
      relationship.type !== 'service-selects-workload' ||
      relationship.resolution.state !== 'missing'
    ) {
      return []
    }

    const service = resourceById.get(relationship.source)

    if (!service || service.identity.scope.type !== 'namespaced') {
      return []
    }

    const namespace = service.identity.scope.namespace
    const selectorRange = relationship.evidence.sourceRange
    const comparisonEvidence = relationship.evidence.comparisons.flatMap((comparison) => {
      const target = resourceById.get(comparison.target)

      if (!target) {
        return []
      }

      const label =
        target.kind === 'Deployment'
          ? `Deployment ${namespace}/${target.name} Pod-template labels`
          : `Pod ${namespace}/${target.name} labels`

      return [
        {
          kind: 'labels' as const,
          label,
          value: formatLabelMap(comparison.labels),
          sourcePath: comparison.sourcePath,
          resourceId: comparison.target,
          range: comparison.range,
        },
      ]
    })
    const sourceRanges = [
      selectorRange,
      ...relationship.evidence.comparisons.map((comparison) => comparison.range),
    ].filter((range) => range !== undefined)
    const serviceName = shellArgument(service.name)
    const namespaceName = shellArgument(namespace)

    return [
      createDiagnostic({
        code: 'KG-SVC-001',
        severity: 'warning',
        category: 'selector',
        certainty: 'input-scoped',
        title: 'Service selector matches no supplied workload',
        message: `No supplied Pod or supported Pod template in namespace ${namespace} has every label required by this Service selector. A matching Pod may still exist in the live cluster.`,
        whyItMatters:
          'Services select Pods by labels. A Deployment connection is inferred from the labels on its Pod template; the Service does not select the Deployment object itself.',
        evidence: [
          {
            kind: 'selector',
            label: `Service ${namespace}/${service.name} selector`,
            value: formatLabelMap(relationship.evidence.selector),
            sourcePath: relationship.evidence.sourcePath,
            resourceId: service.id,
            range: selectorRange,
          },
          ...comparisonEvidence,
        ],
        verificationCommands: [
          `kubectl get service ${serviceName} -n ${namespaceName} -o yaml`,
          `kubectl get pods -n ${namespaceName} --show-labels`,
          `kubectl get endpointslice -n ${namespaceName} -l kubernetes.io/service-name=${serviceName}`,
          `kubectl describe service ${serviceName} -n ${namespaceName}`,
        ],
        possibleDirection:
          'Compare spec.selector with Pod or Deployment Pod-template labels and align the intended key/value pairs.',
        documentIndex: service.source.documentIndex,
        range: selectorRange ?? service.source.range,
        sourceRanges,
        resourceIds: [service.id],
        relationshipIds: [relationship.id],
      }),
    ]
  })
}
