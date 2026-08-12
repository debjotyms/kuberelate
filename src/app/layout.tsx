import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'

import { product } from '@/config/product'

import './globals.css'

export const metadata: Metadata = {
  applicationName: product.name,
  category: 'technology',
  description: product.description,
  metadataBase: new URL(product.siteUrl),
  openGraph: {
    description: product.description,
    siteName: product.name,
    title: `${product.name} — ${product.tagline}`,
    type: 'website',
    url: product.siteUrl,
  },
  robots: {
    follow: true,
    index: true,
  },
  title: {
    default: `${product.name} — ${product.tagline}`,
    template: `%s · ${product.name}`,
  },
  twitter: {
    card: 'summary',
    description: product.description,
    title: `${product.name} — ${product.tagline}`,
  },
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { color: '#f4f8fb', media: '(prefers-color-scheme: light)' },
    { color: '#07131f', media: '(prefers-color-scheme: dark)' },
  ],
}

interface RootLayoutProps {
  children: ReactNode
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('kuberelate-theme');if(!t){var p=localStorage.getItem('kuberelate-preferences');if(p){var parsed=JSON.parse(p);if(parsed&&parsed.state&&parsed.state.theme){t=parsed.state.theme;}}}if(!t)t='system';document.documentElement.dataset.theme=t;}catch(e){}})()`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
