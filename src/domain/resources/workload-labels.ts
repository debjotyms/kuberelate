import type { KubernetesResource, WorkloadLabelTarget } from '@/domain/model/analysis'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function readStringMap(value: unknown): Readonly<Record<string, string>> | undefined {
  if (!isRecord(value) || Object.values(value).some((entry) => typeof entry !== 'string')) {
    return undefined
  }

  return Object.freeze({ ...value } as Record<string, string>)
}

function namespaced(resource: KubernetesResource): string | undefined {
  return resource.identity.scope.type === 'namespaced'
    ? resource.identity.scope.namespace
    : undefined
}

export function extractWorkloadLabels(
  resource: KubernetesResource,
): WorkloadLabelTarget | undefined {
  const namespace = namespaced(resource)

  if (!namespace) {
    return undefined
  }

  if (resource.identity.apiGroup === '' && resource.kind === 'Pod') {
    return {
      resourceId: resource.id,
      namespace,
      source: 'pod',
      sourcePath: 'metadata.labels',
      labels: resource.labels,
      range: resource.source.fieldRanges.get('metadata.labels'),
    }
  }

  if (resource.identity.apiGroup !== 'apps' || resource.kind !== 'Deployment') {
    return undefined
  }

  const raw = isRecord(resource.raw) ? resource.raw : {}
  const spec = isRecord(raw.spec) ? raw.spec : {}
  const template = isRecord(spec.template) ? spec.template : {}
  const metadata = isRecord(template.metadata) ? template.metadata : {}
  const labels = readStringMap(metadata.labels) ?? {}

  return {
    resourceId: resource.id,
    namespace,
    source: 'pod-template',
    sourcePath: 'spec.template.metadata.labels',
    labels,
    range: resource.source.fieldRanges.get('spec.template.metadata.labels'),
  }
}

export function extractServiceSelector(
  resource: KubernetesResource,
): Readonly<Record<string, string>> | undefined {
  if (
    resource.identity.apiGroup !== '' ||
    resource.kind !== 'Service' ||
    resource.identity.scope.type !== 'namespaced'
  ) {
    return undefined
  }

  const raw = isRecord(resource.raw) ? resource.raw : {}
  const spec = isRecord(raw.spec) ? raw.spec : {}

  if (spec.type === 'ExternalName') {
    return undefined
  }

  const selector = readStringMap(spec.selector)

  return selector && Object.keys(selector).length > 0 ? selector : undefined
}
