import { test, expect } from '@playwright/test'

test('YouTube format uses exact 1920x1080 capture geometry', async ({ page }) => {
  await page.goto('./', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('button', { name: '16:9 YouTube' })).toHaveClass(/active/)
  await expect(page.locator('.landscape-preview')).toHaveCount(1)
  await expect.poll(() => page.locator('canvas[aria-hidden="true"]').evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([1920, 1080])

  await page.getByRole('button', { name: '9:16 Shorts / Vertical' }).click()
  await expect(page.locator('.vertical-preview')).toHaveCount(1)
  await expect.poll(() => page.locator('canvas[aria-hidden="true"]').evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([1080, 1920])

  await page.getByRole('button', { name: '16:9 YouTube' }).click()
  await expect(page.locator('.landscape-preview')).toHaveCount(1)
  await expect.poll(() => page.locator('canvas[aria-hidden="true"]').evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([1920, 1080])
})
