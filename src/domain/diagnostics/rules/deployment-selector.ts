import { shellArgument } from '@/domain/diagnostics/commands'
import { createDiagnostic } from '@/domain/diagnostics/diagnostic'
import type { AnalysisDiagnostic, KubernetesResource } from '@/domain/model/analysis'
import { extractWorkloadLabels, isRecord } from '@/domain/resources/workload-labels'
import { formatLabelMap } from '@/domain/selectors/equality-selector'
import {
  formatLabelSelector,
  matchesLabelSelector,
  parseLabelSelector,
} from '@/domain/selectors/label-selector'

export function deploymentSelectorDiagnostics(
  resources: readonly KubernetesResource[],
): readonly AnalysisDiagnostic[] {
  return resources.flatMap((deployment) => {
    if (deployment.identity.apiGroup !== 'apps' || deployment.kind !== 'Deployment') {
      return []
    }

    const raw = isRecord(deployment.raw) ? deployment.raw : {}
    const spec = isRecord(raw.spec) ? raw.spec : {}
    const selector = parseLabelSelector(spec.selector)
    const target = extractWorkloadLabels(deployment)

    if (!selector || !target || matchesLabelSelector(selector, target.labels)) {
      return []
    }

    const namespace = target.namespace
    const selectorRange = deployment.source.fieldRanges.get('spec.selector')
    const labelsRange = deployment.source.fieldRanges.get('spec.template.metadata.labels')
    const sourceRanges = [selectorRange, labelsRange].filter((range) => range !== undefined)

    return [
      createDiagnostic({
        code: 'KG-DEP-001',
        severity: 'error',
        category: 'selector',
        certainty: 'definite',
        title: 'Deployment selector does not match Pod template labels',
        message:
          'The Deployment selector does not match the labels declared on its own Pod template.',
        whyItMatters:
          'A Deployment must be able to identify the Pods created from its template. Kubernetes rejects a Deployment whose selector and template labels disagree.',
        evidence: [
          {
            kind: 'selector',
            label: `Deployment ${namespace}/${deployment.name} selector labels`,
            value: formatLabelSelector(selector),
            sourcePath: 'spec.selector',
            resourceId: deployment.id,
            range: selectorRange,
          },
          {
            kind: 'labels',
            label: `Deployment ${namespace}/${deployment.name} Pod-template labels`,
            value: formatLabelMap(target.labels),
            sourcePath: target.sourcePath,
            resourceId: deployment.id,
            range: labelsRange,
          },
        ],
        verificationCommands: [
          `kubectl get deployment ${shellArgument(deployment.name)} -n ${shellArgument(namespace)} -o yaml`,
        ],
        possibleDirection:
          'Make spec.selector match the intended spec.template.metadata.labels without changing immutable live selectors blindly.',
        documentIndex: deployment.source.documentIndex,
        range: selectorRange ?? deployment.source.range,
        sourceRanges,
        resourceIds: [deployment.id],
      }),
    ]
  })
}
