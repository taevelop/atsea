import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

function yellowDifference(before, after, top) {
  let count = 0, sumX = 0;
  for (let y = top; y < after.height; y++) for (let x = 0; x < after.width; x++) {
    const i = (y * after.width + x) * 4;
    const r = after.data[i] - before.data[i], g = after.data[i + 1] - before.data[i + 1];
    const b = after.data[i + 2] - before.data[i + 2];
    if (r > 24 && g > 24 && b < Math.min(r, g) * .6) { count++; sumX += x; }
  }
  return { count, x: sumX / Math.max(1, count) };
}

test('angler bulbs glow yellow and illuminate the seabed as they move, turn, and leave', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    // Seeded, but never constant: Three.js needs distinct random material UUIDs.
    let seed = 1729;
    Math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
    localStorage.setItem('atsea.lang', 'en');
    localStorage.setItem('atsea.view', '3d');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().renderMode === '3d');
  const state = await page.evaluate(() => {
    const api = window.__ATSEA__, ocean = api.getOcean();
    api.setPaused(true);
    api.diveToFraction(1); api.step(3000);
    window.reviewAngler = ocean.groups.angler[0];
    for (const kind of Object.keys(ocean.groups)) ocean.groups[kind] = [];
    ocean.floor = []; ocean.weeds = []; ocean.bubbles = []; ocean.alarms = []; ocean.chomps = [];
    ocean.subs = [];
    api.step(1);
    document.getElementById('catch').hidden = true;
    return api.snapshot();
  });
  const canvas = page.locator('#c');
  const capture = async name => PNG.sync.read(await canvas.screenshot({ path: info.outputPath(name + '.png') }));
  const baseline = await capture('seabed-unlit');
  const floorTop = baseline.height - Math.ceil(baseline.height / state.rows * 2);
  await page.evaluate(() => {
    const api = window.__ATSEA__, ocean = api.getOcean(), animal = window.reviewAngler;
    animal.x = 1; animal.y = animal.yf = ocean.floorY - animal.h - 4;
    animal.dir = 1; animal.rare = false; animal.color = '#af5f00';
    ocean.groups.angler = [animal]; api.step(1);
  });
  const left = await capture('angler-yellow-left');
  const leftLight = yellowDifference(baseline, left, floorTop);
  expect(errors).toEqual([]);
  expect(leftLight.count).toBeGreaterThan(50);
  let bulbPixels = 0;
  for (let y = 0; y < floorTop; y++) for (let x = 0; x < left.width; x++) {
    const i = (y * left.width + x) * 4;
    if (left.data[i] > 200 && left.data[i + 1] > 190 && left.data[i + 2] < 120) bulbPixels++;
  }
  expect(bulbPixels).toBeGreaterThan(5);

  await page.evaluate(() => {
    const api = window.__ATSEA__, ocean = api.getOcean();
    window.reviewAngler.x = ocean.w - window.reviewAngler.w - 1;
    api.step(1);
  });
  const right = await capture('angler-yellow-right');
  const rightLight = yellowDifference(baseline, right, floorTop);
  expect(rightLight.count).toBeGreaterThan(50);
  expect(rightLight.x - leftLight.x).toBeGreaterThan(20);
  expect(await page.evaluate(() => window.__ATSEA__.snapshot().clock)).toBe(state.clock);

  await page.evaluate(() => {
    const api = window.__ATSEA__;
    window.reviewAngler.y = window.reviewAngler.yf = api.snapshot().cam + 1;
    api.step(1);
  });
  const distant = await capture('angler-high-faint-reflection');
  expect(yellowDifference(baseline, distant, floorTop).count).toBeLessThan(rightLight.count * .4);

  await page.evaluate(() => {
    const api = window.__ATSEA__, animal = window.reviewAngler;
    animal.y = animal.yf = api.getOcean().floorY - animal.h - 4;
    animal.rare = true; animal.color = '#f2fbff'; animal.dir = -1;
    animal.x = (api.getOcean().w - animal.w) / 2;
    api.step(1);
  });
  const rare = await capture('angler-rare-yellow-lure');
  expect(yellowDifference(baseline, rare, floorTop).count).toBeGreaterThan(50);
  await page.evaluate(async () => {
    const api = window.__ATSEA__;
    await api.setRenderMode('2d'); api.step(1);
  });
  await expect(page.locator('#c-ascii')).toBeVisible();
  await page.evaluate(async () => {
    const api = window.__ATSEA__;
    await api.setRenderMode('3d'); api.step(1);
  });
  const restored = await capture('angler-view-restored');
  expect(yellowDifference(baseline, restored, floorTop).count).toBeGreaterThan(50);

  await page.evaluate(() => {
    const api = window.__ATSEA__;
    window.reviewAngler.x = api.getOcean().w + 10;
    api.step(1);
  });
  const gone = await capture('angler-left-no-light');
  expect(yellowDifference(baseline, gone, floorTop).count).toBe(0);
  expect(errors).toEqual([]);
});
