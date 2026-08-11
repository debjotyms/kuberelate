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

export const validIngressBackendExample: ManifestExample = {
  id: 'valid-ingress-backend',
  name: 'Valid Ingress backend',
  description: 'Default and path routes share one namespace-correct Service backend.',
  source: `apiVersion: v1
kind: Service
metadata:
  name: storefront
  namespace: demo
spec:
  ports:
    - name: http
      port: 80
      targetPort: 8080
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: storefront
  namespace: demo
spec:
  defaultBackend:
    service:
      name: storefront
      port:
        name: http
  rules:
    - host: shop.example.test
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: storefront
                port:
                  name: http
`,
}

export const missingIngressServiceExample: ManifestExample = {
  id: 'missing-ingress-service',
  name: 'Missing Ingress Service',
  description: 'An Ingress path references a Service absent from the supplied manifests.',
  source: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  namespace: demo
spec:
  rules:
    - host: api.example.test
      http:
        paths:
          - path: /v1
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80
`,
}

export const missingIngressPortExample: ManifestExample = {
  id: 'missing-ingress-port',
  name: 'Missing Ingress port',
  description: 'The Service exists, but it does not declare the named backend port.',
  source: `apiVersion: v1
kind: Service
metadata:
  name: api
  namespace: demo
spec:
  ports:
    - name: http
      port: 80
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api
  namespace: demo
spec:
  defaultBackend:
    service:
      name: api
      port:
        name: admin
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
  validIngressBackendExample,
  missingIngressServiceExample,
  missingIngressPortExample,
  resourceInventoryExample,
] as const
