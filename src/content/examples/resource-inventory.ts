export interface ManifestExample {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly source: string
}

export const brokenServiceSelectorExample: ManifestExample = {
  id: 'broken-service-selector',
  name: 'Broken Service selector',
  description: 'A Service selector differs from its Deployment Pod-template labels.',
  source: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: demo
spec:
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
          image: nginx:1.27
---
apiVersion: v1
kind: Service
metadata:
  name: web
  namespace: demo
spec:
  selector:
    app: website
  ports:
    - name: http
      port: 80
      targetPort: 80
`,
}

export const workingServiceSelectorExample: ManifestExample = {
  id: 'working-service-selector',
  name: 'Working Service selector',
  description: 'A Service selector is a subset of its Deployment Pod-template labels.',
  source: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: demo
spec:
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
        tier: frontend
    spec:
      containers:
        - name: web
          image: nginx:1.27
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
    - name: http
      port: 80
      targetPort: 80
`,
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

export const manifestExamples = [
  brokenServiceSelectorExample,
  workingServiceSelectorExample,
  resourceInventoryExample,
] as const
