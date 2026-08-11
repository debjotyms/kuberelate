import type { IngressBackendPort, KubernetesResource, SourceRange } from '@/domain/model/analysis'

interface IngressRouteContext {
  readonly type: 'default' | 'rule-path'
  readonly description: string
}

export interface IngressServiceBackendReference {
  readonly type: 'service'
  readonly serviceName: string
  readonly port: IngressBackendPort
  readonly sourcePath: string
  readonly serviceNamePath: string
  readonly servicePortPath: string
  readonly route: IngressRouteContext
  readonly sourceRange?: SourceRange
  readonly serviceNameRange?: SourceRange
  readonly servicePortRange?: SourceRange
}

export interface IngressResourceBackendReference {
  readonly type: 'resource'
  readonly apiGroup?: string
  readonly kind?: string
  readonly name?: string
  readonly sourcePath: string
  readonly description: string
  readonly sourceRange?: SourceRange
}

export interface IngressBackends {
  readonly services: readonly IngressServiceBackendReference[]
  readonly resources: readonly IngressResourceBackendReference[]
}

export interface ExtractedServicePort {
  readonly index: number
  readonly sourcePath: string
  readonly namePath: string
  readonly portPath: string
  readonly name?: string
  readonly port?: number
  readonly sourceRange?: SourceRange
  readonly nameRange?: SourceRange
  readonly portRange?: SourceRange
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  return value.trim() ? value : undefined
}

function servicePort(
  value: unknown,
): { port: IngressBackendPort; field: 'name' | 'number' } | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const name = nonEmptyString(value.name)

  if (name) {
    return { port: { type: 'name', value: name }, field: 'name' }
  }

  if (typeof value.number === 'number' && Number.isInteger(value.number)) {
    return { port: { type: 'number', value: value.number }, field: 'number' }
  }

  return undefined
}

function ruleDescription(rule: Record<string, unknown>, path: Record<string, unknown>): string {
  const host = nonEmptyString(rule.host) ?? 'all hosts'
  const routePath = nonEmptyString(path.path) ?? '/'
  return `host ${host}, path ${routePath}`
}

function extractBackend(
  resource: KubernetesResource,
  backend: unknown,
  sourcePath: string,
  route: IngressRouteContext,
): IngressServiceBackendReference | IngressResourceBackendReference | undefined {
  if (!isRecord(backend)) {
    return undefined
  }

  const service = isRecord(backend.service) ? backend.service : undefined
  const serviceName = nonEmptyString(service?.name)
  const referencedPort = servicePort(service?.port)

  if (serviceName && referencedPort) {
    const serviceNamePath = `${sourcePath}.service.name`
    const servicePortPath = `${sourcePath}.service.port.${referencedPort.field}`

    return {
      type: 'service',
      serviceName,
      port: referencedPort.port,
      sourcePath,
      serviceNamePath,
      servicePortPath,
      route,
      sourceRange: resource.source.fieldRanges.get(sourcePath),
      serviceNameRange: resource.source.fieldRanges.get(serviceNamePath),
      servicePortRange: resource.source.fieldRanges.get(servicePortPath),
    }
  }

  const referencedResource = isRecord(backend.resource) ? backend.resource : undefined

  if (!referencedResource) {
    return undefined
  }

  const apiGroup = nonEmptyString(referencedResource.apiGroup)
  const kind = nonEmptyString(referencedResource.kind)
  const name = nonEmptyString(referencedResource.name)
  const identity = [apiGroup, kind, name].filter(Boolean).join('/') || 'unidentified resource'
  const resourcePath = `${sourcePath}.resource`

  return {
    type: 'resource',
    apiGroup,
    kind,
    name,
    sourcePath: resourcePath,
    description: `${route.description} uses ${identity}`,
    sourceRange:
      resource.source.fieldRanges.get(resourcePath) ?? resource.source.fieldRanges.get(sourcePath),
  }
}

export function extractV1IngressBackends(resource: KubernetesResource): IngressBackends {
  if (
    resource.identity.apiGroup !== 'networking.k8s.io' ||
    resource.version !== 'v1' ||
    resource.kind !== 'Ingress' ||
    resource.identity.scope.type !== 'namespaced' ||
    !isRecord(resource.raw)
  ) {
    return { services: [], resources: [] }
  }

  const spec = isRecord(resource.raw.spec) ? resource.raw.spec : undefined

  if (!spec) {
    return { services: [], resources: [] }
  }

  const references: (IngressServiceBackendReference | IngressResourceBackendReference)[] = []
  const defaultBackend = extractBackend(resource, spec.defaultBackend, 'spec.defaultBackend', {
    type: 'default',
    description: 'default backend',
  })

  if (defaultBackend) {
    references.push(defaultBackend)
  }

  if (Array.isArray(spec.rules)) {
    spec.rules.forEach((ruleValue, ruleIndex) => {
      if (!isRecord(ruleValue)) {
        return
      }

      const http = isRecord(ruleValue.http) ? ruleValue.http : undefined

      if (!http || !Array.isArray(http.paths)) {
        return
      }

      http.paths.forEach((pathValue, pathIndex) => {
        if (!isRecord(pathValue)) {
          return
        }

        const sourcePath = `spec.rules[${ruleIndex}].http.paths[${pathIndex}].backend`
        const backend = extractBackend(resource, pathValue.backend, sourcePath, {
          type: 'rule-path',
          description: ruleDescription(ruleValue, pathValue),
        })

        if (backend) {
          references.push(backend)
        }
      })
    })
  }

  return {
    services: references.filter(
      (reference): reference is IngressServiceBackendReference => reference.type === 'service',
    ),
    resources: references.filter(
      (reference): reference is IngressResourceBackendReference => reference.type === 'resource',
    ),
  }
}

export function extractServicePorts(resource: KubernetesResource): readonly ExtractedServicePort[] {
  if (resource.identity.apiGroup !== '' || resource.kind !== 'Service' || !isRecord(resource.raw)) {
    return []
  }

  const spec = isRecord(resource.raw.spec) ? resource.raw.spec : undefined

  if (!spec || !Array.isArray(spec.ports)) {
    return []
  }

  return spec.ports.flatMap((value, index) => {
    if (!isRecord(value)) {
      return []
    }

    const sourcePath = `spec.ports[${index}]`
    const namePath = `${sourcePath}.name`
    const portPath = `${sourcePath}.port`
    const name = nonEmptyString(value.name)
    const port =
      typeof value.port === 'number' && Number.isInteger(value.port) ? value.port : undefined

    return [
      {
        index,
        sourcePath,
        namePath,
        portPath,
        name,
        port,
        sourceRange: resource.source.fieldRanges.get(sourcePath),
        nameRange: resource.source.fieldRanges.get(namePath),
        portRange: resource.source.fieldRanges.get(portPath),
      },
    ]
  })
}

export function formatIngressBackendPort(port: IngressBackendPort): string {
  return port.type === 'name' ? `named port ${port.value}` : `port ${port.value}`
}
