'use client'

import dynamic from 'next/dynamic'

const ManifestWorkbench = dynamic(
  () => import('./manifest-workbench').then((module) => module.ManifestWorkbench),
  {
    ssr: false,
    loading: () => (
      <div aria-label="Loading manifest editor" className="workbench-loading" role="status">
        <span className="status-pulse" aria-hidden="true" />
        Loading the local manifest editor…
      </div>
    ),
  },
)

export function WorkbenchLoader() {
  return <ManifestWorkbench />
}
