import { test, expect } from '@playwright/test';

async function openExplorer(page) {
  await page.goto('/');
  await page.waitForFunction(() => window.pangea?.ready);
}

test('future projection crosses today smoothly, reverses, and restores historical snapshots', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openExplorer(page);
  await page.locator('#future-button').click();
  await page.waitForFunction(() => window.pangea.motionReady && window.pangea.age === -50);
  await expect(page.locator('#future-notice')).toBeVisible();
  await expect(page.locator('#era-label')).toHaveText('FUTURE PROJECTION');
  await expect(page.locator('#age-hero')).toHaveText('+50');
  await expect(page.locator('#time-scrubber')).toHaveAttribute('aria-valuetext', /speculative/);
  const futurePosition = await page.evaluate(() =>
    pangea.viewer.entities.values[0].position.getValue(Cesium.JulianDate.now()),
  );
  await page.locator('#time-scrubber').fill('300');
  await page.waitForFunction(() => window.pangea.age === 0);
  const todayPosition = await page.evaluate(() =>
    pangea.viewer.entities.values[0].position.getValue(Cesium.JulianDate.now()),
  );
  expect(futurePosition).not.toEqual(todayPosition);
  await page.locator('#time-scrubber').fill('299');
  await page.locator('#time-play').click();
  await page.waitForFunction(() => window.pangea.age < -1);
  await page.locator('#time-play').click();
  await page.locator('#time-direction').click();
  await page.locator('#time-play').click();
  await page.waitForFunction(() => window.pangea.age > 1);
  await page.locator('#time-play').click();
  await page.getByRole('button', { name: 'Project 100 million years into the future' }).click();
  await page.waitForFunction(() => window.pangea.age === -100 && window.pangea.motionReady);
  await page.locator('#project-satellite').check();
  await page.waitForFunction(() => window.pangea.viewer.scene.globe.tilesLoaded);
  await page.screenshot({ path: '.qa/future-desktop.png' });
  await page.locator('.time-step[data-age="240"]').click();
  await page.waitForFunction(
    () => window.pangea.age === 240 && !window.pangea.motion && window.pangea.ready,
  );
  await expect(page.locator('#future-notice')).toBeHidden();
  expect(errors).toEqual([]);
});

test('a newer snapshot supersedes an in-flight future mesh load', async ({ page }) => {
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  await page.route('**/data/motion.json', async (route) => {
    await pending;
    await route.continue();
  });
  await openExplorer(page);
  await page.locator('#future-button').click();
  await expect(page.locator('#status')).toContainText('Preparing');
  await page.locator('.time-step[data-age="160"]').click();
  await page.waitForFunction(() => window.pangea.age === 160 && window.pangea.ready);
  release();
  await page.waitForResponse('**/data/motion.json');
  // A subsequent projection reuses the prepared mesh and remains functional.
  await page.locator('#future-button').click();
  await page.waitForFunction(() => window.pangea.age === -50 && window.pangea.motionReady);
  await expect(page.locator('#status')).toBeEmpty();
});

test('future controls fit a narrow screen and remain reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openExplorer(page);
  await page.locator('#panel-toggle').click();
  await page.locator('#future-button').click();
  await page.waitForFunction(() => window.pangea.age === -50 && window.pangea.motionReady);
  await page.locator('#panel-toggle').click();
  await expect(page.locator('#future-notice')).toBeVisible();
  await expect(page.getByRole('slider', { name: 'Geological timeline' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.qa/future-mobile.png' });
});
