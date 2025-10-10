import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const VIEWPORTS = [
  { name: 'phone-360x780', size: { width: 360, height: 780 } },
  { name: 'phone-390x844', size: { width: 390, height: 844 } },
  { name: 'phone-412x915', size: { width: 412, height: 915 } },
  { name: 'phone-landscape-780x360', size: { width: 780, height: 360 } },
  { name: 'phone-landscape-844x390', size: { width: 844, height: 390 } },
  { name: 'tablet-768x1024', size: { width: 768, height: 1024 } },
  { name: 'tablet-1024x768', size: { width: 1024, height: 768 } },
  { name: 'desktop-1280x800', size: { width: 1280, height: 800 } },
  { name: 'desktop-1440x900', size: { width: 1440, height: 900 } },
] as const

async function assertNoHorizontalScroll(page: Page) {
  const hasOverflow = await page.evaluate(() => {
    const root = document.scrollingElement
    if (!root) return false
    return root.scrollWidth > root.clientWidth + 1
  })
  expect(hasOverflow).toBeFalsy()
}

test.describe('responsive layout guardrails', () => {
  for (const viewport of VIEWPORTS) {
    test(`layout stable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport.size)
      await page.goto('/responsive-test')
      await page.waitForSelector('.table-layout')

      await assertNoHorizontalScroll(page)

      const trickBox = await page.locator('.trick-area').boundingBox()
      expect(trickBox).not.toBeNull()
      expect(trickBox!.x).toBeGreaterThanOrEqual(0)
      expect(trickBox!.y).toBeGreaterThanOrEqual(0)
      expect(trickBox!.x + trickBox!.width).toBeLessThanOrEqual(viewport.size.width + 1)
      expect(trickBox!.y + trickBox!.height).toBeLessThanOrEqual(viewport.size.height + 1)

      const handRail = await page.locator('.player-hand-rail').boundingBox()
      expect(handRail).not.toBeNull()
      expect(handRail!.y + handRail!.height).toBeLessThanOrEqual(viewport.size.height + 1)

      await expect(page.locator('.action-row')).toBeVisible()
    })
  }
})

test('full hand playthrough keeps layout intact', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/responsive-test')
  await page.waitForSelector('.table-layout')

  const passButton = page.getByRole('button', { name: 'Pass' })
  await expect(passButton).toBeDisabled()

  await page.getByRole('button', { name: 'Accept kitty' }).click()

  const initialHandCount = await page.locator('.player-hand-rail .hand-card').count()
  const discardCard = page.locator('.player-hand-rail .card-button:not(.card-disabled)').first()
  await discardCard.click()
  await expect(page.locator('.player-hand-rail .hand-card')).toHaveCount(initialHandCount - 1)

  while (await page.locator('.player-hand-rail .card-button:not(.card-disabled)').count()) {
    await page.locator('.player-hand-rail .card-button:not(.card-disabled)').first().click()
  }

  await expect(page.locator('.player-hand-rail .hand-card')).toHaveCount(0)
  await expect(page.getByText('Last hand: North / South +2')).toBeVisible()

  const reconnectButton = page.getByRole('button', { name: 'Simulate reconnect' })
  await reconnectButton.click()
  await expect(page.locator('.placeholder-panel')).toBeVisible()
  await expect(page.locator('.table-layout')).toBeVisible()

  await assertNoHorizontalScroll(page)
})
