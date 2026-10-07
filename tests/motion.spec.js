import { test, expect } from '@playwright/test';
import { rotationAt, rotatePoint, slerp } from '../motion.js';
import fs from 'node:fs';
const data = JSON.parse(fs.readFileSync(new URL('../data/motion.json', import.meta.url)));
const places = JSON.parse(fs.readFileSync(new URL('../data/places.json', import.meta.url)));
test('sampled rotations reproduce known GPlates continent coordinates', () => {
  for (const age of [0, 160, 200, 240, 260, 300]) {
    for (let i = 0; i < places.places.length; i++) {
      const p = places.places[i],
        actual = rotatePoint(rotationAt(data, data.placePids[i], age), [p.lon, p.lat]),
        expected = places.coordinates[String(age)][i];
      const longitudeError = Math.abs(((actual[0] - expected[0] + 540) % 360) - 180);
      expect(longitudeError).toBeLessThan(0.001);
      expect(Math.abs(actual[1] - expected[1])).toBeLessThan(0.001);
    }
  }
  const q = slerp([1, 0, 0, 0], [-1, 0, 0, 0], 0.5);
  expect(q).toEqual([1, 0, 0, 0]);
});
test('playback moves continents in both directions, pauses, scrubs, and returns to detailed views', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.waitForFunction(() => window.pangea?.ready);
  await page.evaluate(() => {
    window.renderErrors = [];
    pangea.viewer.scene.renderError.addEventListener((scene, error) =>
      renderErrors.push(error.message),
    );
  });
  await page.getByRole('button', { name: 'Play continental motion', exact: true }).click();
  await page.waitForFunction(() => window.pangea.motion && window.pangea.motionReady);
  await page.waitForFunction(() => window.pangea.age < 239);
  const a = await page.evaluate(() => ({
    age: window.pangea.age,
    label: window.pangea.viewer.entities.values[0].position.getValue(Cesium.JulianDate.now()),
  }));
  await page.waitForFunction((age) => window.pangea.age < age - 4, a.age);
  const b = await page.evaluate(() =>
    window.pangea.viewer.entities.values[0].position.getValue(Cesium.JulianDate.now()),
  );
  expect(b).not.toEqual(a.label);
  await page.getByRole('button', { name: 'Pause continental motion', exact: true }).click();
  const paused = await page.evaluate(() => window.pangea.age);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.pangea.age)).toBe(paused);
  await page.screenshot({ path: '.qa/motion-desktop.png' });
  await page.locator('#time-direction').click();
  await page.locator('#time-speed').selectOption('20');
  await page.locator('#time-play').click();
  await page.waitForFunction((age) => window.pangea.age > age + 2, paused);
  await page.locator('#time-play').click();
  await page.locator('#project-satellite').check();
  await expect(page.locator('#data-note')).toContainText('Modern imagery');
  await page.waitForTimeout(250);
  await page.screenshot({ path: '.qa/projected-satellite.png' });
  await page.locator('#project-satellite').uncheck();
  await page.locator('#time-scrubber').fill('175');
  await page.waitForFunction(() => window.pangea.age === 125);
  expect(await page.evaluate(() => window.pangea.playing)).toBe(false);
  await expect(page.locator('#era-label')).toHaveText('EARLY CRETACEOUS');
  await page.locator('#time-scrubber').fill('0');
  await page.locator('#time-play').click();
  await page.waitForFunction(() => window.pangea.age > 0 && window.pangea.age < 300);
  await page.locator('#time-play').click();
  await page.locator('.time-step[data-age="240"]').click();
  await page.waitForFunction(
    () => window.pangea.age === 240 && !window.pangea.motion && window.pangea.ready,
  );
  expect(await page.evaluate(() => window.pangea.viewer.imageryLayers.length)).toBe(1);
  await page.locator('#time-play').click();
  await page.waitForFunction(() => window.pangea.motion);
  await page.locator('#modern-button').click();
  await page.waitForFunction(
    () => window.pangea.mode === 'modern' && !window.pangea.playing && !window.pangea.motion,
  );
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => renderErrors)).toEqual([]);
});
test('mobile timeline is accessible and stops at an endpoint', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForFunction(() => window.pangea?.ready);
  await page.locator('#time-scrubber').fill('399');
  await page.waitForFunction(
    () => window.pangea.motion && window.pangea.motionReady && window.pangea.age === -99,
  );
  await page.locator('#time-play').click();
  await page.waitForFunction(() => window.pangea.age === -100 && !window.pangea.playing);
  await expect(page.locator('#age-readout')).toHaveText('+100 Myr');
  await page.screenshot({ path: '.qa/motion-mobile.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('slider', { name: 'Geological timeline' })).toBeVisible();
});
