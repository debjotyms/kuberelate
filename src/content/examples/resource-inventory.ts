export interface ManifestExample {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly source: string
}

export const resourceInventoryExample: ManifestExample = {
  id: 'resource-inventory',
  name: 'Resource inventory',
  description: 'A Namespace, Deployment, Service, and generic custom resource.',
  source: `apiVersion: v1
kind: Namespace
metadata:
  name: demo
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: demo
  labels:
    app: web
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      containers:
        - name: web
          image: example.invalid/web:1.0
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: demo
spec:
  selector:
    app: web
  ports:
    - port: 80
      targetPort: 8080
---
apiVersion: learning.example.io/v1alpha1
kind: StudyGuide
metadata:
  name: service-basics
  namespace: demo
`,
}

export const manifestExamples = [resourceInventoryExample] as const
