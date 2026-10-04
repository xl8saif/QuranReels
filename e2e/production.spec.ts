import { test, expect } from '@playwright/test'

test.describe('published QuranReels site', () => {
  test.beforeEach(async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []
    const failedRequests: string[] = []

    page.on('console', message => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })
    page.on('pageerror', error => pageErrors.push(error.message))
    page.on('requestfailed', request => {
      const failure = request.failure()?.errorText || 'unknown request failure'
      failedRequests.push(`${request.method()} ${request.url()} — ${failure}`)
    })
    page.on('response', response => {
      if (response.status() >= 400) {
        failedRequests.push(`${response.request().method()} ${response.url()} — HTTP ${response.status()}`)
      }
    })

    const response = await page.goto('./', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    expect(response, 'Published site returned no navigation response').not.toBeNull()
    expect(response?.status(), 'Published site HTTP status').toBe(200)
    await expect(page.locator('#root')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByRole('heading', { name: 'Waraq Quran Reels', exact: true })).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.app-shell')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.minimal-preview')).toBeVisible({ timeout: 30_000 })
    await expect(page.locator('.minimal-recitation')).toBeVisible({ timeout: 30_000 })
    await page.waitForTimeout(2_000)

    expect(consoleErrors, `Browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
    expect(pageErrors, `Page errors:\n${pageErrors.join('\n')}`).toEqual([])
    expect(failedRequests, `Failed network requests:\n${failedRequests.join('\n')}`).toEqual([])
  })

  test('Quran UI and primary controls are available', async ({ page }) => {
    await expect(page.getByText('Surah', { exact: true })).toBeVisible()
    await expect(page.getByText('Mushaf', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create video', exact: true })).toBeVisible()
    await expect(page.getByText(/Ahmad Al-Ajmy/)).toBeVisible()
    await expect(page.getByText('أحمد بن علي العجمي', { exact: true })).toBeVisible()
  })

  test('Surah selector exposes all 114 Quran chapters', async ({ page }) => {
    const surah = page.getByLabel('Surah')
    await expect(surah).toBeVisible()
    await expect(surah.locator('option')).toHaveCount(114)
    await surah.selectOption('2')
    await expect(surah).toHaveValue('2')
    await expect(page.locator('.subtitle')).toContainText('البقرة')
  })

  test('Ahmad Al-Ajmy recitation controls load and expose the expected source', async ({ page }) => {
    await expect(page.getByText('Ahmad Al-Ajmy', { exact: false }).first()).toBeVisible()
    await expect(page.getByText('أحمد بن علي العجمي', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play recitation', exact: true })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Recitation progress' })).toBeVisible()

    const audio = page.locator('#qvm-export-audio')
    await expect(audio).toHaveAttribute('src', /server10\.mp3quran\.net\/ajm\/001\.mp3/, { timeout: 30_000 })
  })

  test('Ahmad Al-Ajmy recitation switches with the selected Surah', async ({ page }) => {
    const surah = page.getByLabel('Surah')
    await surah.selectOption('2')
    const audio = page.locator('#qvm-export-audio')
    await expect(audio).toHaveAttribute('src', /server10\.mp3quran\.net\/ajm\/002\.mp3/, { timeout: 30_000 })
  })

  test('export control is initially available and does not start without user action', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: 'Create video', exact: true })
    await expect(exportButton).toBeEnabled()
    await expect(page.getByText(/Creating video…/)).toHaveCount(0)
  })
})
