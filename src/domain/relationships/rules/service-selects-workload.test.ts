import { describe, expect, it } from 'vitest'

import {
  brokenServiceSelectorExample,
  workingServiceSelectorExample,
} from '@/content/examples/resource-inventory'
import { analyzeManifest } from '@/domain/parser/analyze-manifest'

function service(selector = 'app: web', namespace = 'demo', extraSpec = ''): string {
  return `apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: ${namespace}
spec:
${extraSpec}  selector:
    ${selector}
`
}

function pod(name: string, labels: string, namespace = 'demo'): string {
  return `apiVersion: v1
kind: Pod
metadata:
  name: ${name}
  namespace: ${namespace}
  labels:
${labels}
spec:
  containers:
    - name: app
      image: example.invalid/app:1
`
}

function deployment(templateLabels: string, selector = 'app: web', namespace = 'demo'): string {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: ${namespace}
spec:
  selector:
    matchLabels:
      ${selector}
  template:
    metadata:
      labels:
${templateLabels}
    spec:
      containers:
        - name: web
          image: example.invalid/web:1
`
}

describe('Service selector vertical slice', () => {
  it('emits source-aware unresolved data and KG-SVC-001 for the exact broken fixture', () => {
    const first = analyzeManifest(brokenServiceSelectorExample.source)
    const second = analyzeManifest(brokenServiceSelectorExample.source)
    const serviceResource = first.resources.find((resource) => resource.kind === 'Service')!
    const deploymentResource = first.resources.find((resource) => resource.kind === 'Deployment')!
    const relationship = first.relationships[0]!
    const diagnostic = first.diagnostics.find((item) => item.code === 'KG-SVC-001')!

    expect(first.summary).toMatchObject({
      resources: 2,
      relationships: 1,
      errors: 0,
      warnings: 1,
    })
    expect(serviceResource.identity.scope).toEqual({ type: 'namespaced', namespace: 'demo' })
    expect(deploymentResource.identity.scope).toEqual({ type: 'namespaced', namespace: 'demo' })
    expect(serviceResource.source.fieldRanges.get('spec.selector')).toMatchObject({
      start: { line: 26, column: 5 },
    })
    expect(
      deploymentResource.source.fieldRanges.get('spec.template.metadata.labels'),
    ).toMatchObject({ start: { line: 13, column: 9 } })
    expect(relationship).toMatchObject({
      source: serviceResource.id,
      certainty: 'inferred',
      resolution: { state: 'missing' },
      evidence: {
        selector: { app: 'website' },
        comparisons: [
          {
            target: deploymentResource.id,
            labels: { app: 'web' },
            result: {
              matches: false,
              comparisons: [
                {
                  key: 'app',
                  expected: 'website',
                  actual: 'web',
                  state: 'different-value',
                },
              ],
            },
          },
        ],
      },
    })
    expect(relationship.id).toBe(second.relationships[0]?.id)
    expect(first.relationships.some((item) => item.resolution.state === 'resolved')).toBe(false)
    expect(diagnostic).toMatchObject({
      code: 'KG-SVC-001',
      severity: 'warning',
      category: 'selector',
      certainty: 'input-scoped',
      title: 'Service selector matches no supplied workload',
      resourceIds: [serviceResource.id],
      relationshipIds: [relationship.id],
      range: { start: { line: 26, column: 5 } },
      evidence: [
        expect.objectContaining({ kind: 'selector', value: 'app=website' }),
        expect.objectContaining({ kind: 'labels', value: 'app=web' }),
      ],
      verificationCommands: [
        'kubectl get service web -n demo -o yaml',
        'kubectl get pods -n demo --show-labels',
        'kubectl get endpointslice -n demo -l kubernetes.io/service-name=web',
        'kubectl describe service web -n demo',
      ],
    })
    expect(diagnostic.sourceRanges.map((range) => range.start.line)).toEqual([26, 13])
    expect(diagnostic.message).toContain('supplied')
    expect(diagnostic.message).toContain('live cluster')
  })

  it('resolves subset matches against Pod labels and Deployment Pod-template labels', () => {
    const podResult = analyzeManifest(
      `${service()}---\n${pod('direct', '    app: web\n    tier: frontend')}`,
    )
    const deploymentResult = analyzeManifest(workingServiceSelectorExample.source)

    expect(podResult.relationships).toHaveLength(1)
    expect(podResult.relationships[0]).toMatchObject({
      resolution: { state: 'resolved', target: podResult.resources[1]?.id },
      evidence: { targetLabelSource: 'pod' },
    })
    expect(deploymentResult.relationships[0]).toMatchObject({
      resolution: { state: 'resolved' },
      evidence: { targetLabelSource: 'pod-template' },
    })
    expect(deploymentResult.diagnostics).toHaveLength(0)
  })

  it('allows one Service to match multiple supplied workloads', () => {
    const result = analyzeManifest(
      `${service()}---\n${pod('direct', '    app: web')}---\n${deployment('        app: web')}`,
    )

    expect(result.relationships).toHaveLength(2)
    expect(result.relationships.every((item) => item.resolution.state === 'resolved')).toBe(true)
    expect(new Set(result.relationships.map((item) => item.id)).size).toBe(2)
    expect(result.diagnostics.some((item) => item.code === 'KG-SVC-001')).toBe(false)
  })

  it('does not treat same labels in another namespace as a candidate or target', () => {
    const result = analyzeManifest(`${service()}---\n${pod('other', '    app: web', 'other')}`)

    expect(result.relationships[0]).toMatchObject({
      resolution: { state: 'missing' },
      evidence: { comparisons: [] },
    })
    expect(result.diagnostics.find((item) => item.code === 'KG-SVC-001')?.evidence).toHaveLength(1)
  })

  it('skips selectorless and ExternalName Services', () => {
    const selectorless = service().replace('  selector:\n    app: web\n', '')
    const externalName = `apiVersion: v1
kind: Service
metadata:
  name: outside
spec:
  type: ExternalName
  externalName: example.invalid
  selector:
    app: web
`
    const result = analyzeManifest(`${selectorless}---\n${externalName}`)

    expect(result.relationships).toHaveLength(0)
    expect(result.diagnostics.some((item) => item.code === 'KG-SVC-001')).toBe(false)
  })

  it('indexes namespaced Pod and Deployment label tokens with source evidence', () => {
    const result = analyzeManifest(
      `${pod('direct', '    app: web\n    tier: frontend')}---\n${deployment('        app: web')}`,
    )
    const podResource = result.resources[0]!
    const deploymentResource = result.resources[1]!
    const index = result.index.workloadLabels

    expect(index.byNamespace.get('demo')).toEqual([podResource.id, deploymentResource.id])
    expect(index.byNamespacedLabel.size).toBe(2)
    expect(index.byResource.get(podResource.id)).toMatchObject({
      source: 'pod',
      sourcePath: 'metadata.labels',
      labels: { app: 'web', tier: 'frontend' },
    })
    expect(index.byResource.get(deploymentResource.id)).toMatchObject({
      source: 'pod-template',
      sourcePath: 'spec.template.metadata.labels',
      labels: { app: 'web' },
    })
  })

  it('diagnoses a Deployment selector/template disagreement separately', () => {
    const result = analyzeManifest(deployment('        app: api', 'app: web'))
    const diagnostic = result.diagnostics.find((item) => item.code === 'KG-DEP-001')!

    expect(diagnostic).toMatchObject({
      severity: 'error',
      category: 'selector',
      certainty: 'definite',
      evidence: [
        expect.objectContaining({ kind: 'selector', value: 'app=web' }),
        expect.objectContaining({ kind: 'labels', value: 'app=api' }),
      ],
    })
    expect(result.status).toBe('partial')
  })

  it('supports Deployment matchExpressions and keeps malformed selector shapes conservative', () => {
    const expressionDeployment = deployment('        app: web').replace(
      '    matchLabels:\n      app: web',
      '    matchExpressions:\n      - key: app\n        operator: In\n        values: [web]',
    )
    const malformedSelector = deployment('        app: web').replace(
      '    matchLabels:\n      app: web',
      '    matchLabels:\n      app: 42',
    )

    expect(analyzeManifest(expressionDeployment).diagnostics).toHaveLength(0)
    expect(analyzeManifest(malformedSelector).diagnostics).toHaveLength(0)
  })

  it('continues relationship analysis around a malformed neighboring document', () => {
    const source = `${service()}---
apiVersion: v1
kind: ConfigMap
metadata: [
---
${pod('direct', '    app: web')}`
    const result = analyzeManifest(source)

    expect(result.status).toBe('partial')
    expect(result.relationships).toHaveLength(1)
    expect(result.relationships[0]?.resolution.state).toBe('resolved')
    expect(result.diagnostics.some((item) => item.category === 'parser')).toBe(true)
  })
})
