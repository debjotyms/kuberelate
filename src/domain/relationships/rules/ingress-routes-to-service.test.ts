import { describe, expect, it } from 'vitest'

import {
  missingIngressPortExample,
  missingIngressServiceExample,
  validIngressBackendExample,
} from '@/content/examples/resource-inventory'
import { analyzeManifest } from '@/domain/parser/analyze-manifest'

function service(namespace = 'demo', name = 'api'): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
  ports:
    - name: http
      port: 80
      targetPort: 8080
`
}

function ingress(backends: string, namespace = 'demo', name = 'api'): string {
  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  namespace: ${namespace}
spec:
${backends}
`
}

describe('Ingress routes to Service relationships', () => {
  it('deduplicates default and rule-path references while preserving every source path', () => {
    const first = analyzeManifest(validIngressBackendExample.source)
    const second = analyzeManifest(validIngressBackendExample.source)
    const serviceResource = first.resources.find((resource) => resource.kind === 'Service')!
    const relationship = first.relationships.find(
      (item) => item.type === 'ingress-routes-to-service',
    )!

    expect(first.relationships).toHaveLength(1)
    expect(first.diagnostics).toHaveLength(0)
    expect(relationship).toMatchObject({
      certainty: 'explicit',
      resolution: { state: 'resolved', target: serviceResource.id },
      evidence: {
        backendServiceName: 'storefront',
        backendPort: { type: 'name', value: 'http' },
        portResolution: 'resolved',
        targetPortPath: 'spec.ports[0].name',
        routes: [
          { sourcePath: 'spec.defaultBackend', description: 'default backend' },
          {
            sourcePath: 'spec.rules[0].http.paths[0].backend',
            description: 'host shop.example.test, path /',
          },
        ],
      },
    })
    expect(relationship.evidence.routes.every((route) => route.sourceRange)).toBe(true)
    expect(second.relationships[0]?.id).toBe(relationship.id)
  })

  it('matches named and numeric backends against Service name and port fields', () => {
    const source = `${service()}---
${ingress(`  rules:
    - http:
        paths:
          - path: /named
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  name: http
          - path: /numeric
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80`)}`
    const result = analyzeManifest(source)
    const ingressRelationships = result.relationships.filter(
      (relationship) => relationship.type === 'ingress-routes-to-service',
    )

    expect(ingressRelationships).toHaveLength(2)
    expect(ingressRelationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence: expect.objectContaining({
            backendPort: { type: 'name', value: 'http' },
            portResolution: 'resolved',
            targetPortPath: 'spec.ports[0].name',
          }),
        }),
        expect.objectContaining({
          evidence: expect.objectContaining({
            backendPort: { type: 'number', value: 80 },
            portResolution: 'resolved',
            targetPortPath: 'spec.ports[0].port',
          }),
        }),
      ]),
    )
    expect(result.diagnostics).toHaveLength(0)
  })

  it('reports a missing Service only within the Ingress namespace', () => {
    const result = analyzeManifest(`${missingIngressServiceExample.source}---
${service('other', 'api')}`)
    const relationship = result.relationships.find(
      (item) => item.type === 'ingress-routes-to-service',
    )!
    const diagnostic = result.diagnostics.find((item) => item.code === 'KG-ING-001')!

    expect(relationship).toMatchObject({
      resolution: { state: 'missing', expected: { description: 'Service demo/api' } },
      evidence: { portResolution: 'service-missing' },
    })
    expect(diagnostic).toMatchObject({
      severity: 'error',
      category: 'reference',
      certainty: 'input-scoped',
      title: 'Ingress backend Service is not supplied',
      resourceIds: [result.resources[0]?.id],
      relationshipIds: [relationship.id],
      evidence: [
        expect.objectContaining({
          kind: 'backend',
          value: 'Service demo/api, port 80',
          sourcePath: 'spec.rules[0].http.paths[0].backend.service.name',
        }),
      ],
      verificationCommands: [
        'kubectl get ingress api -n demo -o yaml',
        'kubectl get service api -n demo -o yaml',
        'kubectl describe ingress api -n demo',
      ],
    })
    expect(diagnostic.range?.start.line).toBe(15)
    expect(result.status).toBe('partial')
  })

  it('reports a missing named port on a supplied Service with both source sides', () => {
    const result = analyzeManifest(missingIngressPortExample.source)
    const relationship = result.relationships.find(
      (item) => item.type === 'ingress-routes-to-service',
    )!
    const diagnostic = result.diagnostics.find((item) => item.code === 'KG-ING-002')!
    const serviceResource = result.resources.find((resource) => resource.kind === 'Service')!

    expect(relationship).toMatchObject({
      resolution: { state: 'resolved', target: serviceResource.id },
      evidence: {
        backendPort: { type: 'name', value: 'admin' },
        portResolution: 'missing',
        servicePorts: [{ name: 'http', port: 80, sourcePath: 'spec.ports[0]' }],
      },
    })
    expect(diagnostic).toMatchObject({
      severity: 'error',
      certainty: 'definite',
      resourceIds: [result.resources[1]?.id, serviceResource.id],
      relationshipIds: [relationship.id],
      evidence: [
        expect.objectContaining({ kind: 'backend', value: 'Service demo/api, named port admin' }),
        expect.objectContaining({ kind: 'port', value: 'http:80' }),
      ],
    })
    expect(diagnostic.sourceRanges.map((range) => range.start.line)).toEqual(
      expect.arrayContaining([19, 21, 18, 8]),
    )
  })

  it('does not confuse Service targetPort with its externally referenced port number', () => {
    const source = `${service()}---
${ingress(`  defaultBackend:
    service:
      name: api
      port:
        number: 8080`)}`
    const result = analyzeManifest(source)

    expect(
      result.relationships.find((item) => item.type === 'ingress-routes-to-service'),
    ).toMatchObject({ evidence: { portResolution: 'missing' } })
    expect(result.diagnostics.find((item) => item.code === 'KG-ING-002')?.message).toContain(
      'port 8080',
    )
  })

  it('does not choose arbitrarily between duplicate Service identities', () => {
    const source = `${service()}---
${service()}---
${ingress(`  defaultBackend:
    service:
      name: api
      port:
        name: http`)}`
    const result = analyzeManifest(source)
    const relationship = result.relationships.find(
      (item) => item.type === 'ingress-routes-to-service',
    )!

    expect(relationship.resolution).toMatchObject({
      state: 'ambiguous',
      candidates: [result.resources[0]?.id, result.resources[1]?.id],
    })
    expect(result.diagnostics.map((item) => item.code)).toEqual(
      expect.arrayContaining(['KG-RESOURCE-003', 'KG-ING-003']),
    )
    expect(relationship.evidence.portResolution).toBe('service-ambiguous')
  })

  it('keeps resource backends visible as unsupported information, never missing Services', () => {
    const source = ingress(`  defaultBackend:
    resource:
      apiGroup: storage.example.io
      kind: Bucket
      name: assets`)
    const result = analyzeManifest(source)

    expect(result.relationships).toHaveLength(0)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'KG-ING-004',
        severity: 'info',
        certainty: 'informational',
        title: 'Ingress resource backend is not analyzed',
        message: expect.stringContaining('did not classify this as a missing Service'),
      }),
    ])
    expect(result.diagnostics.some((item) => item.code === 'KG-ING-001')).toBe(false)
    expect(result.status).toBe('valid')
  })

  it('limits extraction to networking.k8s.io/v1 Ingress objects', () => {
    const legacy = ingress(`  defaultBackend:
    service:
      name: api
      port:
        number: 80`).replace('networking.k8s.io/v1', 'networking.k8s.io/v1beta1')
    const result = analyzeManifest(`${service()}---
${legacy}`)

    expect(result.relationships).toHaveLength(0)
    expect(result.diagnostics).toHaveLength(0)
  })
})
