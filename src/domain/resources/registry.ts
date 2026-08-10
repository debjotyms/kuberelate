import type { ResourceSupport } from '@/domain/model/analysis'

export interface ResourceDefinition {
  readonly scope: 'namespaced' | 'cluster'
  readonly support: Exclude<ResourceSupport, 'generic'>
}

const namespaced = (support: ResourceDefinition['support'] = 'partial'): ResourceDefinition => ({
  scope: 'namespaced',
  support,
})

const cluster = (support: ResourceDefinition['support'] = 'partial'): ResourceDefinition => ({
  scope: 'cluster',
  support,
})

const definitions = new Map<string, ResourceDefinition>([
  ['|ConfigMap', namespaced()],
  ['|Endpoints', namespaced()],
  ['|LimitRange', namespaced()],
  ['|Namespace', cluster()],
  ['|Node', cluster()],
  ['|PersistentVolume', cluster()],
  ['|PersistentVolumeClaim', namespaced()],
  ['|Pod', namespaced()],
  ['|PodTemplate', namespaced()],
  ['|ReplicationController', namespaced()],
  ['|ResourceQuota', namespaced()],
  ['|Secret', namespaced()],
  ['|Service', namespaced()],
  ['|ServiceAccount', namespaced()],
  ['admissionregistration.k8s.io|MutatingWebhookConfiguration', cluster()],
  ['admissionregistration.k8s.io|ValidatingWebhookConfiguration', cluster()],
  ['apiextensions.k8s.io|CustomResourceDefinition', cluster()],
  ['apps|ControllerRevision', namespaced()],
  ['apps|DaemonSet', namespaced()],
  ['apps|Deployment', namespaced()],
  ['apps|ReplicaSet', namespaced()],
  ['apps|StatefulSet', namespaced()],
  ['autoscaling|HorizontalPodAutoscaler', namespaced()],
  ['batch|CronJob', namespaced()],
  ['batch|Job', namespaced()],
  ['certificates.k8s.io|CertificateSigningRequest', cluster()],
  ['coordination.k8s.io|Lease', namespaced()],
  ['discovery.k8s.io|EndpointSlice', namespaced()],
  ['extensions|Ingress', namespaced()],
  ['networking.k8s.io|Ingress', namespaced()],
  ['networking.k8s.io|IngressClass', cluster()],
  ['networking.k8s.io|NetworkPolicy', namespaced()],
  ['policy|PodDisruptionBudget', namespaced()],
  ['rbac.authorization.k8s.io|ClusterRole', cluster()],
  ['rbac.authorization.k8s.io|ClusterRoleBinding', cluster()],
  ['rbac.authorization.k8s.io|Role', namespaced()],
  ['rbac.authorization.k8s.io|RoleBinding', namespaced()],
  ['scheduling.k8s.io|PriorityClass', cluster()],
  ['storage.k8s.io|CSIDriver', cluster()],
  ['storage.k8s.io|CSINode', cluster()],
  ['storage.k8s.io|CSIStorageCapacity', namespaced()],
  ['storage.k8s.io|StorageClass', cluster()],
  ['storage.k8s.io|VolumeAttachment', cluster()],
])

export function getResourceDefinition(
  apiGroup: string,
  kind: string,
): ResourceDefinition | undefined {
  return definitions.get(`${apiGroup}|${kind}`)
}
