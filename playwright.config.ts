import { defineConfig, devices } from '@playwright/test'

const productionBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'https://xl8saif.github.io/QuranReels/'
const isProduction = Boolean(process.env.PLAYWRIGHT_BASE_URL)

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  reporter: 'html',
  use: {
    baseURL: productionBaseURL,
    trace: 'on-first-retry',
  },
  ...(isProduction ? {} : {
    webServer: {
      command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  }),
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
  ],
})
