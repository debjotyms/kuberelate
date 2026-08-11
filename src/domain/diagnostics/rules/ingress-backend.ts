import { shellArgument } from '@/domain/diagnostics/commands'
import { createDiagnostic } from '@/domain/diagnostics/diagnostic'
import type {
  AnalysisDiagnostic,
  IngressRouteEvidence,
  KubernetesResource,
  ResourceRelationship,
  SafeEvidenceItem,
  SourceRange,
} from '@/domain/model/analysis'
import { extractV1IngressBackends, formatIngressBackendPort } from '@/domain/resources/ingress'

function presentServicePorts(
  ports: Extract<
    ResourceRelationship,
    { type: 'ingress-routes-to-service' }
  >['evidence']['servicePorts'],
): string {
  if (ports.length === 0) {
    return 'No Service ports declared'
  }

  return ports
    .map((port) => {
      if (port.name && port.port !== undefined) {
        return `${port.name}:${port.port}`
      }

      return port.name ?? (port.port === undefined ? 'unrecognized port' : String(port.port))
    })
    .join(', ')
}

function routeEvidence(
  ingress: KubernetesResource,
  namespace: string,
  serviceName: string,
  port: string,
  routes: readonly IngressRouteEvidence[],
): readonly SafeEvidenceItem[] {
  return routes.map((route) => ({
    kind: 'backend',
    label: `Ingress ${namespace}/${ingress.name} ${route.description}`,
    value: `Service ${namespace}/${serviceName}, ${port}`,
    sourcePath: route.serviceNamePath,
    resourceId: ingress.id,
    range: route.serviceNameRange ?? route.sourceRange,
  }))
}

function ingressCommands(
  ingress: KubernetesResource,
  namespace: string,
  serviceName?: string,
): readonly string[] {
  const ingressName = shellArgument(ingress.name)
  const namespaceName = shellArgument(namespace)
  const commands = [
    `kubectl get ingress ${ingressName} -n ${namespaceName} -o yaml`,
    `kubectl describe ingress ${ingressName} -n ${namespaceName}`,
  ]

  if (serviceName) {
    commands.splice(
      1,
      0,
      `kubectl get service ${shellArgument(serviceName)} -n ${namespaceName} -o yaml`,
    )
  }

  return commands
}

function definedRanges(ranges: readonly (SourceRange | undefined)[]): readonly SourceRange[] {
  return ranges.filter((range): range is SourceRange => range !== undefined)
}

function relationshipDiagnostics(
  resources: readonly KubernetesResource[],
  relationships: readonly ResourceRelationship[],
): readonly AnalysisDiagnostic[] {
  const resourceById = new Map(resources.map((resource) => [resource.id, resource]))

  return relationships.flatMap((relationship) => {
    if (relationship.type !== 'ingress-routes-to-service') {
      return []
    }

    const ingress = resourceById.get(relationship.source)

    if (!ingress || ingress.identity.scope.type !== 'namespaced') {
      return []
    }

    const namespace = ingress.identity.scope.namespace
    const portDescription = formatIngressBackendPort(relationship.evidence.backendPort)
    const routes = relationship.evidence.routes
    const backendEvidence = routeEvidence(
      ingress,
      namespace,
      relationship.evidence.backendServiceName,
      portDescription,
      routes,
    )
    const backendRanges = definedRanges(
      routes.flatMap((route) => [
        route.serviceNameRange,
        route.servicePortRange,
        route.sourceRange,
      ]),
    )
    const firstRange =
      routes[0]?.serviceNameRange ?? routes[0]?.sourceRange ?? relationship.evidence.sourceRange

    if (relationship.resolution.state === 'missing') {
      return [
        createDiagnostic({
          code: 'KG-ING-001',
          severity: 'error',
          category: 'reference',
          certainty: 'input-scoped',
          title: 'Ingress backend Service is not supplied',
          message: `No supplied Service named ${relationship.evidence.backendServiceName} was found in namespace ${namespace}. It may still exist in the live cluster.`,
          whyItMatters:
            'A networking.k8s.io/v1 Ingress Service backend is namespaced with the Ingress. Without that Service, the declared route has no supplied traffic target to validate.',
          evidence: backendEvidence,
          verificationCommands: ingressCommands(
            ingress,
            namespace,
            relationship.evidence.backendServiceName,
          ),
          possibleDirection:
            'Add the intended Service to this manifest set or align the backend Service name and namespace.',
          documentIndex: ingress.source.documentIndex,
          range: firstRange ?? ingress.source.range,
          sourceRanges: backendRanges,
          resourceIds: [ingress.id],
          relationshipIds: [relationship.id],
        }),
      ]
    }

    if (relationship.resolution.state === 'ambiguous') {
      const candidates = relationship.resolution.candidates.flatMap((id) => {
        const service = resourceById.get(id)

        return service
          ? [
              {
                kind: 'resource' as const,
                label: `Supplied Service candidate in document ${service.source.documentIndex + 1}`,
                value: `Service ${namespace}/${service.name}`,
                sourcePath: 'metadata.name',
                resourceId: service.id,
                range: service.source.fieldRanges.get('metadata.name') ?? service.source.range,
              },
            ]
          : []
      })

      return [
        createDiagnostic({
          code: 'KG-ING-003',
          severity: 'error',
          category: 'reference',
          title: 'Ingress backend Service is ambiguous',
          message: `Multiple supplied Services have identity ${namespace}/${relationship.evidence.backendServiceName}, so KubeRelate did not choose one as the backend target.`,
          whyItMatters:
            'Kubernetes resource identity must be unique. Choosing one duplicate would hide an invalid manifest set and could produce incorrect port analysis.',
          evidence: [...backendEvidence, ...candidates],
          verificationCommands: ingressCommands(
            ingress,
            namespace,
            relationship.evidence.backendServiceName,
          ),
          possibleDirection:
            'Remove or rename duplicate Services so the backend resolves uniquely.',
          documentIndex: ingress.source.documentIndex,
          range: firstRange ?? ingress.source.range,
          sourceRanges: definedRanges([
            ...backendRanges,
            ...candidates.map((candidate) => candidate.range),
          ]),
          resourceIds: [ingress.id, ...relationship.resolution.candidates],
          relationshipIds: [relationship.id],
        }),
      ]
    }

    if (relationship.evidence.portResolution !== 'missing') {
      return []
    }

    const service = resourceById.get(relationship.resolution.target)

    if (!service) {
      return []
    }

    const servicePortEvidence: SafeEvidenceItem = {
      kind: 'port',
      label: `Service ${namespace}/${service.name} declared ports`,
      value: presentServicePorts(relationship.evidence.servicePorts),
      sourcePath: 'spec.ports',
      resourceId: service.id,
      range: service.source.fieldRanges.get('spec.ports') ?? service.source.range,
    }

    return [
      createDiagnostic({
        code: 'KG-ING-002',
        severity: 'error',
        category: 'reference',
        title: 'Ingress backend Service port is missing',
        message: `Service ${namespace}/${service.name} does not declare ${portDescription} referenced by Ingress ${namespace}/${ingress.name}.`,
        whyItMatters:
          'Ingress Service backends select a Service port by its declared spec.ports name or number. A targetPort value does not satisfy this reference.',
        evidence: [...backendEvidence, servicePortEvidence],
        verificationCommands: ingressCommands(ingress, namespace, service.name),
        possibleDirection:
          'Point the Ingress backend at an existing Service spec.ports name or port number, or add the intended Service port.',
        documentIndex: ingress.source.documentIndex,
        range: routes[0]?.servicePortRange ?? firstRange ?? ingress.source.range,
        sourceRanges: definedRanges([
          ...backendRanges,
          ...relationship.evidence.servicePorts.map((port) => port.range),
        ]),
        resourceIds: [ingress.id, service.id],
        relationshipIds: [relationship.id],
      }),
    ]
  })
}

function unsupportedResourceBackendDiagnostics(
  resources: readonly KubernetesResource[],
): readonly AnalysisDiagnostic[] {
  return resources.flatMap((ingress) => {
    if (ingress.identity.scope.type !== 'namespaced') {
      return []
    }

    const namespace = ingress.identity.scope.namespace

    return extractV1IngressBackends(ingress).resources.map((backend) => {
      const identity = [backend.apiGroup, backend.kind, backend.name].filter(Boolean).join('/')

      return createDiagnostic({
        code: 'KG-ING-004',
        severity: 'info',
        category: 'reference',
        certainty: 'informational',
        title: 'Ingress resource backend is not analyzed',
        message: `Ingress ${namespace}/${ingress.name} uses resource backend ${identity || 'with incomplete identity'}. KubeRelate currently analyzes Service backends only and did not classify this as a missing Service.`,
        whyItMatters:
          'The Ingress v1 API permits a typed local resource backend. Its behavior depends on the referenced kind and controller support, so KubeRelate leaves it generic instead of guessing.',
        evidence: [
          {
            kind: 'backend',
            label: backend.description,
            value: identity || 'Incomplete resource backend identity',
            sourcePath: backend.sourcePath,
            resourceId: ingress.id,
            range: backend.sourceRange,
          },
        ],
        verificationCommands: ingressCommands(ingress, namespace),
        possibleDirection:
          'Verify that the Ingress controller supports this resource backend and inspect the referenced resource in the cluster.',
        documentIndex: ingress.source.documentIndex,
        range: backend.sourceRange ?? ingress.source.range,
        resourceIds: [ingress.id],
      })
    })
  })
}

export function ingressBackendDiagnostics(
  resources: readonly KubernetesResource[],
  relationships: readonly ResourceRelationship[],
): readonly AnalysisDiagnostic[] {
  return [
    ...relationshipDiagnostics(resources, relationships),
    ...unsupportedResourceBackendDiagnostics(resources),
  ]
}
