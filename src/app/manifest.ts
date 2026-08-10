import type { MetadataRoute } from 'next'

import { product } from '@/config/product'

export const dynamic = 'force-static'

function getBasePath(): string {
  const value = process.env.NEXT_PUBLIC_BASE_PATH

  if (!value || value === '/') {
    return ''
  }

  return `/${value.replace(/^\/+|\/+$/g, '')}`
}

export default function manifest(): MetadataRoute.Manifest {
  const basePath = getBasePath()

  return {
    background_color: '#f4f8fb',
    description: product.description,
    display: 'standalone',
    icons: [
      {
        sizes: 'any',
        src: `${basePath}/icon.svg`,
        type: 'image/svg+xml',
      },
    ],
    name: product.name,
    short_name: product.name,
    start_url: `${basePath}/`,
    theme_color: '#0086ff',
  }
}
