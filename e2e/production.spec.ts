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

    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: 'Waraq Quran Reel Maker', exact: true })).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('.app-shell')).toBeVisible()

    expect(consoleErrors, `Browser console errors:\n${consoleErrors.join('\n')}`).toEqual([])
    expect(pageErrors, `Page errors:\n${pageErrors.join('\n')}`).toEqual([])
    expect(failedRequests, `Failed network requests:\n${failedRequests.join('\n')}`).toEqual([])
  })

  test('Quran UI and primary controls are available', async ({ page }) => {
    await expect(page.getByText('Quran', { exact: true })).toBeVisible()
    await expect(page.getByText('Mushaf style', { exact: true })).toBeVisible()
    await expect(page.getByText('Preview', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Export video', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'En', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ar', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ur', exact: true })).toBeVisible()
  })

  test('Surah and UI language controls work', async ({ page }) => {
    const surah = page.locator('select[aria-label="Surah selector"]')
    await expect(surah).toBeVisible()
    await expect(surah.locator('option')).toHaveCount(114)
    await surah.selectOption('2')
    await expect(surah).toHaveValue('2')
    await expect(page.getByText('Loading selected translations…', { exact: true })).toHaveCount(0, { timeout: 60_000 })

    const app = page.locator('.app-shell')
    const quranTitle = page.getByTestId('quran-section-title')

    await page.getByRole('button', { name: 'Ur', exact: true }).click()
    await expect(app).toHaveAttribute('data-ui-language', 'ur')
    await expect(quranTitle).toHaveText('قرآن')

    await page.getByRole('button', { name: 'Ar', exact: true }).click()
    await expect(app).toHaveAttribute('data-ui-language', 'ar')
    await expect(quranTitle).toHaveText('القرآن')

    await page.getByRole('button', { name: 'En', exact: true }).click()
    await expect(app).toHaveAttribute('data-ui-language', 'en')
    await expect(quranTitle).toHaveText('Quran')
  })

  test('Ahmad Al-Ajmy recitation controls load and expose the expected source', async ({ page }) => {
    await expect(page.getByText('Ahmad Al-Ajmy', { exact: false }).first()).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText('أحمد بن علي العجمي', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play recitation', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Play recitation', exact: true })).toBeEnabled({ timeout: 60_000 })

    const progress = page.getByRole('slider', { name: 'Recitation progress' })
    await expect(progress).toBeVisible()

    const audio = page.locator('#qvm-export-audio')
    await expect(audio).toHaveAttribute('src', /server10\.mp3quran\.net\/ajm\/001\.mp3/)
    await expect(page.getByText(/Quran Foundation request failed/i)).toHaveCount(0)
  })

  test('bundled background media and branding load', async ({ page }) => {
    const imageThumbnails = page.locator('.media-thumb img')
    await expect(imageThumbnails).toHaveCount(5)
    await expect.poll(async () => imageThumbnails.evaluateAll(images => images.filter(image => (image as HTMLImageElement).naturalWidth > 0).length)).toBe(5)

    const videoThumbnails = page.locator('.media-thumb video')
    await expect(videoThumbnails).toHaveCount(3)
    await expect.poll(async () => videoThumbnails.evaluateAll(videos => videos.filter(video => (video as HTMLVideoElement).readyState >= 1).length)).toBe(3)

    await expect(page.getByRole('button', { name: 'Waraq logo', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'CloudTrans logo', exact: true })).toBeVisible()
  })

  test('export is initially available and does not start without user action', async ({ page }) => {
    const exportButton = page.getByRole('button', { name: 'Export video', exact: true })
    await expect(exportButton).toBeEnabled()
    await expect(page.getByText(/Exporting/)).toHaveCount(0)
  })
})
