import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') {
    return ''
  }

  return `/${value.replace(/^\/+|\/+$/g, '')}`
}

const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)
const appPath = `${basePath}/`

test('loads the exported product shell directly with only local assets', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => requests.push(request.url()))

  const response = await page.goto(appPath)

  expect(response?.status()).toBe(200)
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: /understand kubernetes before you deploy it/i,
    }),
  ).toBeVisible()
  await expect(page.getByText('Your manifests never leave your browser.')).toBeVisible()
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    `${basePath}/manifest.webmanifest`,
  )

  const requestOrigins = new Set(requests.map((requestUrl) => new URL(requestUrl).origin))
  expect([...requestOrigins]).toEqual(['http://127.0.0.1:4173'])
})

test('has no automatically detectable accessibility violations in either color scheme', async ({
  page,
}) => {
  for (const colorScheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme })
    await page.goto(appPath)

    const results = await new AxeBuilder({ page }).analyze()

    expect(results.violations, `${colorScheme} color scheme`).toEqual([])
  }
})
