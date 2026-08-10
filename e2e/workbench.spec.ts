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

const service = `apiVersion: v1
kind: Service
metadata:
  name: web
`

test('explains a broken Service selector through topology and source by keyboard', async ({
  page,
}) => {
  await page.goto(appPath)

  const workbench = page.locator('#workbench')
  const editor = workbench.getByRole('textbox', { name: 'Kubernetes YAML manifest editor' })
  const loadExample = workbench.getByRole('button', { name: 'Load example' })

  await expect(editor).toBeVisible()
  await expect(workbench.getByText('Paste YAML or load the example')).toBeVisible()

  await loadExample.focus()
  await page.keyboard.press('Enter')

  await expect(workbench.locator('[data-analysis-status="valid"]')).toBeVisible()
  await expect(workbench.locator('[data-resource-kind]')).toHaveCount(2)
  await expect(workbench.locator('[data-diagnostic-code="KG-SVC-001"]')).toContainText(
    'Service selector matches no supplied workload',
  )
  await expect(workbench.getByText('No matching workload')).toBeVisible()
  await expect(workbench.getByRole('status')).toContainText(
    'Analysis complete. 2 resources, 0 errors, 1 warning, and 1 relationship.',
  )

  const issue = workbench.locator('[data-diagnostic-code="KG-SVC-001"]')
  await issue.getByRole('button', { name: 'View in topology' }).focus()
  await page.keyboard.press('Enter')
  const serviceNode = workbench.getByRole('button', {
    name: /Service demo\/web\. Warning\. Inspect resource/,
  })
  await expect(serviceNode).toBeFocused()
  await expect(
    workbench.getByRole('region', { name: 'Service selector matches no supplied workload' }),
  ).toContainText('kubectl get endpointslice -n demo')

  await issue.getByRole('button', { name: 'View selector' }).focus()
  await page.keyboard.press('Enter')
  await expect(editor).toBeFocused()

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+f' : 'Control+f')
  await expect(page.locator('.cm-search input[name="search"]')).toBeVisible()
  await page.keyboard.press('Escape')

  const a11y = await new AxeBuilder({ page }).include('#workbench').analyze()
  expect(a11y.violations).toEqual([])
})

test('shows a working selector in the map and equivalent relationship list', async ({ page }) => {
  await page.goto(appPath)

  const workbench = page.locator('#workbench')
  await workbench.getByLabel('Example').selectOption('working-service-selector')
  await workbench.getByRole('button', { name: 'Load example' }).click()

  await expect(workbench.locator('[data-analysis-status="valid"]')).toBeVisible()
  await expect(workbench.locator('[data-diagnostic-code="KG-SVC-001"]')).toHaveCount(0)
  await expect(workbench.getByRole('button', { name: /Inspect relationship\./ })).toContainText(
    'selects · inferred',
  )

  await workbench.getByRole('button', { name: 'Relationship list' }).click()
  const list = workbench.getByLabel('Semantic relationship list')
  await expect(list.getByText('Resolved match')).toBeVisible()
  await expect(list).toContainText(
    'Service demo/web selects Pods represented by Deployment demo/web using app=web.',
  )
})

test('keeps the resource inventory example available', async ({ page }) => {
  await page.goto(appPath)

  const workbench = page.locator('#workbench')
  await workbench.getByLabel('Example').selectOption('resource-inventory')
  await workbench.getByRole('button', { name: 'Load example' }).click()

  await expect(workbench.locator('[data-analysis-status="valid"]')).toBeVisible()
  await expect(workbench.locator('[data-resource-kind]')).toHaveCount(4)
  await expect(workbench.locator('[data-resource-kind="StudyGuide"]')).toContainText('Generic kind')
})

test('keeps valid documents visible beside malformed YAML and recovers after correction', async ({
  page,
}) => {
  await page.goto(appPath)

  const workbench = page.locator('#workbench')
  const editor = workbench.getByRole('textbox', { name: 'Kubernetes YAML manifest editor' })
  const malformed = `${service}---\napiVersion: v1\nkind: ConfigMap\nmetadata: [\n`

  await editor.fill(malformed)
  await expect(workbench.locator('[data-analysis-status="partial"]')).toBeVisible()
  await expect(workbench.locator('[data-resource-kind="Service"]')).toBeVisible()
  await expect(workbench.getByText('YAML parse error')).toBeVisible()

  await workbench
    .getByRole('region', { name: 'Issues' })
    .getByRole('button', { name: 'View in YAML' })
    .click()
  await expect(editor).toBeFocused()

  await editor.fill(service)
  await expect(workbench.locator('[data-analysis-status="valid"]')).toBeVisible()
  await expect(workbench.getByText('YAML parse error')).toHaveCount(0)
  await expect(workbench.locator('[data-resource-kind="Service"]')).toBeVisible()
})

test('analysis stays local, keeps Secret values out of results, and passes axe in key states', async ({
  page,
}) => {
  await page.goto(appPath)

  const workbench = page.locator('#workbench')
  const editor = workbench.getByRole('textbox', { name: 'Kubernetes YAML manifest editor' })
  const requestsAfterEditorLoaded: { url: string; body: string | null }[] = []
  page.on('request', (request) =>
    requestsAfterEditorLoaded.push({ url: request.url(), body: request.postData() }),
  )

  const emptyA11y = await new AxeBuilder({ page }).include('#workbench').analyze()
  expect(emptyA11y.violations).toEqual([])

  const sentinel = 'synthetic-never-render-secret'
  const secret = `apiVersion: v1
kind: Secret
metadata:
  name: demo
stringData:
  token: ${sentinel}
`

  await editor.fill(secret)
  await expect(workbench.locator('[data-analysis-status="valid"]')).toBeVisible()
  await expect(editor).toContainText(sentinel)
  await expect(workbench.locator('.results-panel')).not.toContainText(sentinel)
  expect(JSON.stringify(requestsAfterEditorLoaded)).not.toContain(sentinel)
  expect(
    requestsAfterEditorLoaded.every(
      (request) => new URL(request.url).origin === 'http://127.0.0.1:4173',
    ),
  ).toBe(true)

  const storage = await page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(window.localStorage)),
    session: Object.fromEntries(Object.entries(window.sessionStorage)),
    url: window.location.href,
  }))
  expect(JSON.stringify(storage)).not.toContain(sentinel)

  const validA11y = await new AxeBuilder({ page }).include('#workbench').analyze()
  expect(validA11y.violations).toEqual([])

  await page.emulateMedia({ colorScheme: 'dark' })
  const darkA11y = await new AxeBuilder({ page }).include('#workbench').analyze()
  expect(darkA11y.violations).toEqual([])
  await page.emulateMedia({ colorScheme: 'light' })

  await editor.fill('apiVersion: v1\nkind: Secret\nmetadata: [\n')
  await expect(workbench.locator('[data-analysis-status="invalid"]')).toBeVisible()

  const invalidA11y = await new AxeBuilder({ page }).include('#workbench').analyze()
  expect(invalidA11y.violations).toEqual([])
})

test('reflows the populated workbench at 320 CSS pixels without horizontal scrolling', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto(appPath)

  const workbench = page.locator('#workbench')
  await workbench.getByRole('button', { name: 'Load example' }).click()
  await expect(workbench.locator('[data-analysis-status="valid"]')).toBeVisible()
  await expect(workbench.locator('[data-resource-kind]')).toHaveCount(2)

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)

  const a11y = await new AxeBuilder({ page }).include('#workbench').analyze()
  expect(a11y.violations).toEqual([])
})
