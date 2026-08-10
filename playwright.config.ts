import { defineConfig, devices } from '@playwright/test'

function normalizeBasePath(value: string | undefined): string {
  if (!value || value === '/') {
    return ''
  }

  return `/${value.replace(/^\/+|\/+$/g, '')}`
}

const port = 4173
const basePath = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH)
const serverUrl = `http://127.0.0.1:${port}${basePath}/`

export default defineConfig({
  forbidOnly: Boolean(process.env.CI),
  fullyParallel: true,
  outputDir: 'test-results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  reporter: process.env.CI
    ? [['line'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list']],
  retries: 0,
  testDir: './e2e',
  use: {
    baseURL: serverUrl,
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run serve:e2e',
    env: {
      NEXT_PUBLIC_BASE_PATH: basePath,
      PORT: String(port),
    },
    reuseExistingServer: !process.env.CI,
    url: serverUrl,
  },
  workers: process.env.CI ? 1 : undefined,
})
