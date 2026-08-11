import type {
  IngressBackendPort,
  IngressRouteEvidence,
  KubernetesResource,
  ResourceIndex,
  ResourceRelationship,
  ServicePortEvidence,
} from '@/domain/model/analysis'
import {
  extractServicePorts,
  extractV1IngressBackends,
  formatIngressBackendPort,
  type ExtractedServicePort,
  type IngressServiceBackendReference,
} from '@/domain/resources/ingress'

interface BackendGroup {
  readonly serviceName: string
  readonly port: IngressBackendPort
  readonly references: IngressServiceBackendReference[]
}

type ServiceCandidateIndex = ReadonlyMap<string, readonly KubernetesResource[]>

function backendGroupKey(serviceName: string, port: IngressBackendPort): string {
  return JSON.stringify([serviceName, port.type, port.value])
}

function relationshipId(
  ingress: KubernetesResource,
  serviceName: string,
  port: IngressBackendPort,
): string {
  return `relationship:ingress-routes-to-service:${ingress.id}:${backendGroupKey(serviceName, port)}`
}

function groupBackends(
  references: readonly IngressServiceBackendReference[],
): readonly BackendGroup[] {
  const groups = new Map<string, BackendGroup>()

  for (const reference of references) {
    const key = backendGroupKey(reference.serviceName, reference.port)
    const current = groups.get(key)

    if (current) {
      current.references.push(reference)
    } else {
      groups.set(key, {
        serviceName: reference.serviceName,
        port: reference.port,
        references: [reference],
      })
    }
  }

  return [...groups.values()]
}

function routeEvidence(reference: IngressServiceBackendReference): IngressRouteEvidence {
  return {
    sourcePath: reference.sourcePath,
    serviceNamePath: reference.serviceNamePath,
    servicePortPath: reference.servicePortPath,
    description: reference.route.description,
    sourceRange: reference.sourceRange,
    serviceNameRange: reference.serviceNameRange,
    servicePortRange: reference.servicePortRange,
  }
}

function servicePortEvidence(port: ExtractedServicePort): ServicePortEvidence {
  return {
    sourcePath: port.sourcePath,
    name: port.name,
    port: port.port,
    range: port.sourceRange,
  }
}

function matchingPort(
  backendPort: IngressBackendPort,
  servicePorts: readonly ExtractedServicePort[],
): ExtractedServicePort | undefined {
  return servicePorts.find((port) =>
    backendPort.type === 'name' ? port.name === backendPort.value : port.port === backendPort.value,
  )
}

function routeCountDescription(references: readonly IngressServiceBackendReference[]): string {
  if (references.length === 1) {
    return references[0]!.route.description
  }

  return `${references.length} backend declarations`
}

function summaryFor(
  ingress: KubernetesResource,
  namespace: string,
  group: BackendGroup,
  serviceState: 'resolved' | 'missing' | 'ambiguous',
  portFound: boolean,
): string {
  const ingressName = `Ingress ${namespace}/${ingress.name}`
  const serviceName = `Service ${namespace}/${group.serviceName}`
  const port = formatIngressBackendPort(group.port)
  const route = routeCountDescription(group.references)

  if (serviceState === 'missing') {
    return `${ingressName} references missing ${serviceName} ${port} from ${route}.`
  }

  if (serviceState === 'ambiguous') {
    return `${ingressName} references ${serviceName} ${port} from ${route}, but multiple supplied Services have that identity.`
  }

  if (!portFound) {
    return `${ingressName} routes ${route} to ${serviceName}, but ${port} is not declared.`
  }

  return `${ingressName} routes ${route} to ${serviceName} ${port}.`
}

function serviceCandidateKey(namespace: string, name: string): string {
  return JSON.stringify([namespace, name])
}

function buildServiceCandidateIndex(
  resources: readonly KubernetesResource[],
  index: ResourceIndex,
): ServiceCandidateIndex {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]))
  const candidates = new Map<string, KubernetesResource[]>()

  for (const id of index.byKind.get('|Service') ?? []) {
    const resource = resourceById.get(id)

    if (!resource || resource.identity.scope.type !== 'namespaced') {
      continue
    }

    const key = serviceCandidateKey(resource.identity.scope.namespace, resource.name)
    const current = candidates.get(key)

    if (current) {
      current.push(resource)
    } else {
      candidates.set(key, [resource])
    }
  }

  return candidates
}

export function ingressRoutesToServiceRelationships(
  resources: readonly KubernetesResource[],
  index: ResourceIndex,
): readonly ResourceRelationship[] {
  const relationships: ResourceRelationship[] = []
  const serviceCandidates = buildServiceCandidateIndex(resources, index)

  for (const ingress of resources) {
    if (ingress.identity.scope.type !== 'namespaced') {
      continue
    }

    const backends = extractV1IngressBackends(ingress)

    for (const group of groupBackends(backends.services)) {
      const namespace = ingress.identity.scope.namespace
      const candidates =
        serviceCandidates.get(serviceCandidateKey(namespace, group.serviceName)) ?? []
      const routes = group.references.map(routeEvidence)
      const firstRoute = routes[0]!
      const id = relationshipId(ingress, group.serviceName, group.port)

      if (candidates.length === 0) {
        relationships.push({
          id,
          source: ingress.id,
          type: 'ingress-routes-to-service',
          certainty: 'explicit',
          resolution: {
            state: 'missing',
            expected: { description: `Service ${namespace}/${group.serviceName}` },
          },
          evidence: {
            sourcePath: firstRoute.sourcePath,
            summary: summaryFor(ingress, namespace, group, 'missing', false),
            backendServiceName: group.serviceName,
            backendPort: group.port,
            routes,
            portResolution: 'service-missing',
            servicePorts: [],
            sourceRange: firstRoute.sourceRange,
          },
        })
        continue
      }

      if (candidates.length > 1) {
        relationships.push({
          id,
          source: ingress.id,
          type: 'ingress-routes-to-service',
          certainty: 'explicit',
          resolution: {
            state: 'ambiguous',
            candidates: candidates.map((candidate) => candidate.id),
            expected: { description: `A unique Service ${namespace}/${group.serviceName}` },
          },
          evidence: {
            sourcePath: firstRoute.sourcePath,
            summary: summaryFor(ingress, namespace, group, 'ambiguous', false),
            backendServiceName: group.serviceName,
            backendPort: group.port,
            routes,
            portResolution: 'service-ambiguous',
            servicePorts: [],
            sourceRange: firstRoute.sourceRange,
          },
        })
        continue
      }

      const service = candidates[0]!
      const extractedPorts = extractServicePorts(service)
      const port = matchingPort(group.port, extractedPorts)
      const targetPortPath = port
        ? group.port.type === 'name'
          ? port.namePath
          : port.portPath
        : undefined
      const targetPortRange = port
        ? group.port.type === 'name'
          ? port.nameRange
          : port.portRange
        : undefined

      relationships.push({
        id,
        source: ingress.id,
        type: 'ingress-routes-to-service',
        certainty: 'explicit',
        resolution: { state: 'resolved', target: service.id },
        evidence: {
          sourcePath: firstRoute.sourcePath,
          summary: summaryFor(ingress, namespace, group, 'resolved', Boolean(port)),
          backendServiceName: group.serviceName,
          backendPort: group.port,
          routes,
          portResolution: port ? 'resolved' : 'missing',
          servicePorts: extractedPorts.map(servicePortEvidence),
          sourceRange: firstRoute.sourceRange,
          targetRange: service.source.fieldRanges.get('metadata.name') ?? service.source.range,
          targetPortPath,
          targetPortRange,
        },
      })
    }
  }

  return relationships
}
