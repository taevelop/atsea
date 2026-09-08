import { test, expect } from '@playwright/test';
import { inspectWaterPixels } from './image-checks.js';

const kinds = ['turtle', 'crab', 'shrimp', 'dolphin', 'whale', 'oarfish'];
const snapshot = page => page.evaluate(() => window.__ATSEA__.snapshot());

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Math.random = () => .5;
    localStorage.setItem('atsea.lang', 'en');
    localStorage.setItem('atsea.view', '2d');
  });
});

test('six swimming species render in both views and retain their identities and observations', async ({ page }, info) => {
  // Large visitors require a wider sea, as the existing shark does.
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 844, height: 700 });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().ready);
  await page.evaluate(() => {
    const api = window.__ATSEA__; api.setPaused(true);
    window.__newAnimals = Object.fromEntries(Object.entries(api.getOcean().groups).map(([kind, list]) => [kind, list[0]]));
    for (const kind of Object.keys(api.getOcean().groups)) api.getOcean().groups[kind] = [];
  });
  for (const kind of kinds) {
    const before = await page.evaluate(kind => {
      const api = window.__ATSEA__, ocean = api.getOcean(), state = api.snapshot();
      for (const key of Object.keys(ocean.groups)) ocean.groups[key] = [];
      const animal = window.__newAnimals[kind];
      animal.x = (state.cols - animal.w) / 2;
      animal.y = animal.yf = state.cam + (state.rows - animal.h) / 2;
      animal.rare = false; animal.dir = 1;
      ocean.groups[kind] = [animal]; api.step(1);
      document.getElementById('catch').hidden = true;
      return [animal.guideId, animal.x, animal.y, animal.w, animal.h];
    }, kind);
    for (const mode of ['2d', '3d']) {
      await page.evaluate(mode => window.__ATSEA__.setRenderMode(mode), mode);
      await expect.poll(async () => (await snapshot(page)).renderMode).toBe(mode);
      await page.evaluate(() => window.__ATSEA__.step(1));
      const canvas = page.locator(mode === '2d' ? '#c-ascii' : '#c');
      const shot = await page.screenshot({ path: info.outputPath(`${kind}-${mode}.png`) });
      const pixels = inspectWaterPixels(shot, await canvas.boundingBox());
      // A single small ASCII animal uses one ink color, unlike the full aquarium.
      expect(pixels.distinctColors).toBeGreaterThan(50);
      expect(pixels.brightnessRange).toBeGreaterThan(30);
      expect(await page.evaluate(kind => {
        const animal = window.__ATSEA__.getOcean().groups[kind][0];
        return [animal.guideId, animal.x, animal.y, animal.w, animal.h];
      }, kind)).toEqual(before);
    }
  }
  expect((await snapshot(page)).seenLog).toMatchObject({ turtle: 1, dolphin: 1, whale: 1 });
  expect((await snapshot(page)).guideLog).toEqual({});
  await page.reload();
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().ready);
  expect((await snapshot(page)).seenLog).toMatchObject({ turtle: 1, dolphin: 1, whale: 1 });
  expect(errors).toEqual([]);
});

test('crab, shrimp and oarfish catches appear in both guides and persist', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().ready);
  await page.evaluate(() => {
    const api = window.__ATSEA__; api.setPaused(true);
    for (const kind of ['crab', 'shrimp', 'oarfish']) api.recordCatch({ kind });
  });
  await page.locator('#btn-guide').click();
  for (const mode of ['2d', '3d']) {
    await page.evaluate(mode => window.__ATSEA__.setRenderMode(mode), mode);
    await expect.poll(async () => (await snapshot(page)).renderMode).toBe(mode);
    for (const kind of ['crab', 'shrimp', 'oarfish']) {
      await expect(page.locator(`#guide-grid [data-id="${kind}"] ${mode === '2d' ? 'pre' : 'img'}`)).toHaveCount(1);
    }
    expect((await snapshot(page)).guideLog).toEqual({ crab: 1, shrimp: 1, oarfish: 1 });
  }
  await page.reload();
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().ready);
  expect((await snapshot(page)).guideLog).toEqual({ crab: 1, shrimp: 1, oarfish: 1 });
});

test('all six rare species share both views, rare records and persistent discovery', async ({ page }, info) => {
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 844, height: 700 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().ready);
  await page.evaluate(() => {
    const api = window.__ATSEA__; api.setPaused(true);
    window.__rareAnimals = Object.fromEntries(Object.entries(api.getOcean().groups).map(([kind, list]) => [kind, list[0]]));
  });
  for (const kind of kinds) {
    await page.evaluate(kind => {
      const api = window.__ATSEA__, ocean = api.getOcean(), state = api.snapshot();
      for (const key of Object.keys(ocean.groups)) ocean.groups[key] = [];
      const animal = window.__rareAnimals[kind];
      animal.x = (state.cols - animal.w) / 2;
      animal.y = animal.yf = state.cam + (state.rows - animal.h) / 2;
      animal.rare = true; animal.color = '#f2fbff'; animal.logged = false;
      ocean.groups[kind] = [animal];
      api.step(1); api.step(1); // Seeing the same rare visitor twice must not double count it.
      if (['crab', 'shrimp', 'oarfish'].includes(kind)) api.recordCatch({ kind, rare: true });
      document.getElementById('catch').hidden = true;
    }, kind);
    for (const mode of ['2d', '3d']) {
      await page.evaluate(mode => window.__ATSEA__.setRenderMode(mode), mode);
      await expect.poll(async () => (await snapshot(page)).renderMode).toBe(mode);
      await page.screenshot({ path: info.outputPath(`${kind}-rare-${mode}.png`) });
    }
    expect((await snapshot(page)).rareLog[kind]).toBe(1);
  }
  const expected = Object.fromEntries(kinds.map(kind => [kind, 1]));
  expect((await snapshot(page)).rareLog).toEqual(expected);
  expect((await snapshot(page)).guideLog).toEqual({ crab: 1, shrimp: 1, oarfish: 1 });
  await page.locator('#btn-guide').click();
  await page.locator('[data-tab="rare"]').click();
  for (const kind of kinds) await expect(page.locator(`#guide-grid [data-id="${kind}"]`)).not.toHaveClass(/sp--unknown/);
  await page.reload();
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().ready);
  expect((await snapshot(page)).rareLog).toEqual(expected);
});
