import type { KubernetesResource } from '@/domain/model/analysis'
import { isRecord } from '@/domain/resources/workload-labels'

export interface SafeResourceInspectorProjection {
  readonly secretValuePolicy: 'not-applicable' | 'keys-only'
  readonly secretDataKeys: readonly string[]
}

function objectKeys(value: unknown): readonly string[] {
  return isRecord(value) ? Object.keys(value) : []
}

export function projectResourceForInspector(
  resource: KubernetesResource,
): SafeResourceInspectorProjection {
  if (resource.identity.apiGroup !== '' || resource.kind !== 'Secret') {
    return { secretValuePolicy: 'not-applicable', secretDataKeys: [] }
  }

  const raw = isRecord(resource.raw) ? resource.raw : {}
  const keys = new Set([...objectKeys(raw.data), ...objectKeys(raw.stringData)])

  return {
    secretValuePolicy: 'keys-only',
    secretDataKeys: [...keys].sort((left, right) => left.localeCompare(right)),
  }
}
