import { afterEach, describe, expect, it } from 'vitest'

import manifest from './manifest'

const originalBasePath = process.env.NEXT_PUBLIC_BASE_PATH

afterEach(() => {
  if (originalBasePath === undefined) {
    delete process.env.NEXT_PUBLIC_BASE_PATH
    return
  }

  process.env.NEXT_PUBLIC_BASE_PATH = originalBasePath
})

describe('web manifest', () => {
  it('uses root-relative paths for local builds', () => {
    delete process.env.NEXT_PUBLIC_BASE_PATH

    expect(manifest()).toMatchObject({
      icons: [{ src: '/icon.svg' }],
      name: 'KubeRelate',
      short_name: 'KubeRelate',
      start_url: '/',
    })
  })

  it('prefixes paths for GitHub project Pages', () => {
    process.env.NEXT_PUBLIC_BASE_PATH = '/kube-relate/'

    expect(manifest()).toMatchObject({
      icons: [{ src: '/kube-relate/icon.svg' }],
      start_url: '/kube-relate/',
    })
  })
})
