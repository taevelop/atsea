import { test, expect } from '@playwright/test';
import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inspectWaterPixels } from '../e2e/image-checks.js';

const ready = async (page, mode = '3d') => {
  await expect(page.locator('#sea-loading')).toBeHidden({ timeout: 60_000 });
  if (mode === '3d') await expect(page.locator('#sea-loading-progress')).toHaveJSProperty('value', 21);
  await expect(page.locator(mode === '3d' ? '#c' : '#c-ascii')).toBeVisible();
  await expect(page.locator('body')).toHaveAttribute('data-view', mode);
  const title = mode === '2d' ? 'ASCII Tropical Sea' : 'Animated Tropical Sea';
  await expect(page.locator('#sea-title')).toHaveText(title);
  await expect(page).toHaveTitle('At Sea — ' + title);
  await expect(page.locator('.bar--top button')).toHaveCount(1);
  await expect(page.locator('#btn-view')).toHaveText(mode === '2d' ? '3D' : '2D');
};
const metres = async page => Number((await page.locator('#metres').textContent()).replace(/[^\d]/g, ''));
const diagnostics = new WeakMap();

test.beforeEach(async ({ page }, info) => {
  // Copy only the deliverable, using spaces and Korean text to catch path assumptions.
  const copyPath = info.outputPath('전달 파일', 'At Sea.html');
  await mkdir(dirname(copyPath), { recursive: true });
  await copyFile(resolve('dist-single/atsea3d.html'), copyPath);
  const url = pathToFileURL(copyPath).href;
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => {
    if (request.url() !== url && !/^(data|blob):/.test(request.url())) externalRequests.push(request.url());
  });
  diagnostics.set(page, { url, errors, externalRequests });
  await page.addInitScript(() => {
    try { if (!localStorage.getItem('atsea.lang')) localStorage.setItem('atsea.lang', 'en'); }
    catch { /* A separate test disables storage before the app starts. */ }
  });
});

test.afterEach(async ({ page }) => {
  const { errors, externalRequests } = diagnostics.get(page);
  expect(externalRequests, 'The copied HTML must not request any other file or server').toEqual([]);
  expect(errors).toEqual([]);
});

test('copied HTML loads offline, renders all models, and supports depth, tools, and guide', async ({ page }, info) => {
  await page.goto(diagnostics.get(page).url);
  await ready(page);
  await expect(page).toHaveTitle('At Sea — Animated Tropical Sea');
  await page.locator('#btn-pause').click();
  await expect(page.locator('#btn-pause')).toHaveAttribute('aria-pressed', 'true');
  for (const [name, button, depth] of [['surface', 'btn-top', 0], ['seabed', 'btn-bottom', 1500]]) {
    await page.locator(`#${button}`).click();
    await expect.poll(() => metres(page)).toBe(depth);
    const box = await page.locator('#c').boundingBox();
    const pixels = await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
    const appearance = inspectWaterPixels(pixels, box);
    expect(appearance.distinctColors).toBeGreaterThan(100);
    expect(appearance.brightnessRange).toBeGreaterThan(30);
  }
  await page.locator('#btn-sub').click();
  await expect(page.locator('#btn-sub')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-rod').click();
  await expect(page.locator('#btn-rod')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#btn-guide').click();
  await expect(page.locator('#guide')).toBeVisible();
  await expect(page.locator('#guide-grid .sp[data-id^="fish"]')).toHaveCount(7);
  await expect.poll(() => page.locator('#guide-grid img').evaluateAll(images =>
    images.length >= 15 && images.every(image => image.complete && image.naturalWidth >= 64))).toBe(true);
  await page.locator('#btn-guide-close').click();
  await page.locator('#btn-view').click();
  await ready(page, '2d');
  await expect(page.locator('#btn-pause')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#btn-sub')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#btn-rod')).toHaveAttribute('aria-pressed', 'true');
  expect(await metres(page)).toBe(1500);
  await page.locator('#btn-guide').click();
  await expect(page.locator('#guide-grid pre')).toHaveCount(15);
  await expect(page.locator('#guide-grid img')).toHaveCount(0);
  await page.locator('#btn-guide-close').click();
  await page.locator('#btn-view').click();
  await ready(page);
  expect(await page.evaluate(() => window.__ATSEA__)).toBeUndefined();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('language, slider settings, and collection records survive a file reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('atsea.guide', JSON.stringify({ fish0: 8 }));
      sessionStorage.setItem('seeded', 'yes');
    }
  });
  await page.goto(diagnostics.get(page).url);
  await ready(page);
  await page.locator('#fish').evaluate(input => {
    input.value = '31';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.locator('#btn-lang').click();
  await expect(page.locator('#btn-guide')).toHaveAttribute('aria-label', '도감');
  await page.locator('#btn-view').click();
  await ready(page, '2d');
  await expect(page.locator('#btn-view')).toHaveAttribute('aria-label', '3D로 전환');
  await page.reload();
  await ready(page, '2d');
  await expect(page.locator('#fish')).toHaveValue('31');
  await expect(page.locator('#btn-guide')).toHaveAttribute('aria-label', '도감');
  await page.locator('#btn-guide').click();
  await expect(page.locator('[data-id="fish0"] .sp-tally')).toContainText('8');
  await expect(page.locator('[data-id="fish0"] pre')).toHaveText('><>');
  await page.locator('#btn-guide-close').click();
  await page.locator('#btn-view').click();
  await ready(page);
  await page.locator('#btn-guide').click();
  await expect(page.locator('[data-id="fish0"] .sp-tally')).toContainText('8');
});

test('offline scene and controls still work when browser storage is unavailable', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      get() { throw new DOMException('Storage unavailable', 'SecurityError'); },
    });
  });
  await page.goto(diagnostics.get(page).url);
  await ready(page);
  await page.locator('#btn-view').click();
  await ready(page, '2d');
  await page.locator('#btn-lang').click();
  await page.locator('#btn-bottom').click();
  await expect.poll(() => metres(page)).toBe(1500);
  await page.locator('#btn-guide').click();
  await expect(page.locator('#guide')).toBeVisible();
});

test('offline ASCII can start and show the guide without WebGL', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('atsea.view', '2d');
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === 'webgl' || type === 'webgl2') throw new Error('WebGL must not be used in saved 2D');
      return original.call(this, type, ...args);
    };
  });
  await page.goto(diagnostics.get(page).url);
  await ready(page, '2d');
  await page.locator('#btn-bottom').click();
  await expect.poll(() => metres(page)).toBe(1500);
  await page.locator('#btn-guide').click();
  await expect(page.locator('#guide-grid pre')).toHaveCount(15);
});
