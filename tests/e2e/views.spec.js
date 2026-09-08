import { test, expect } from '@playwright/test';
import { inspectWaterPixels } from './image-checks.js';

const snapshot = page => page.evaluate(() => window.__ATSEA__.snapshot());
const view = async (page, mode) => {
  const button = page.locator('#btn-view');
  await expect(button).toHaveText(mode.toUpperCase());
  await button.click();
  await expect.poll(async () => (await snapshot(page)).renderMode).toBe(mode);
  const title = mode === '2d' ? 'ASCII Tropical Sea' : 'Animated Tropical Sea';
  await expect(page.locator('#sea-title')).toHaveText(title);
  await expect(page).toHaveTitle('At Sea — ' + title);
  await expect(button).toHaveText(mode === '2d' ? '3D' : '2D');
};
const open = async (page, mode = '3d') => {
  await page.addInitScript(initial => {
    if (!localStorage.getItem('atsea.view')) localStorage.setItem('atsea.view', initial);
  }, mode);
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(expected => window.__ATSEA__?.snapshot().ready && window.__ATSEA__.snapshot().renderMode === expected, mode);
};
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => { Math.random = () => .5; localStorage.setItem('atsea.lang', 'en'); });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.__viewErrors = errors;
});
test.afterEach(async ({ page }) => { expect(page.__viewErrors).toEqual([]); });

test('repeated view changes preserve the live ocean, depth, rod, submarine and settings', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const api = window.__ATSEA__;
    api.setPaused(true); api.diveToFraction(.4); api.step(4000); api.toggleSub(); api.castRod();
    window.__switchOcean = api.getOcean();
    window.__switchRod = api.getOcean().rod;
    window.__switchSub = api.getOcean().subs[0];
    window.__switchFish = api.getOcean().groups.fish[0];
  });
  await page.locator('#btn-water').click();
  const titleBox = await page.locator('#sea-title').boundingBox();
  const switchBox = await page.locator('.bar--top #btn-view').boundingBox();
  const seaBox = await page.locator('main.sea').boundingBox();
  expect(switchBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
  expect(switchBox.x + switchBox.width).toBeLessThanOrEqual(seaBox.x + seaBox.width);
  expect(switchBox.y + switchBox.height).toBeLessThanOrEqual(seaBox.y);
  const before = await snapshot(page);
  const animals = await page.evaluate(() => Object.values(window.__ATSEA__.getOcean().groups).flat().map(f => [f.x, f.y, f.yf, f.dir, f.guideId]));
  for (let i = 0; i < 8; i++) { await view(page, '2d'); await view(page, '3d'); }
  expect(await page.evaluate(() => {
    const ocean = window.__ATSEA__.getOcean();
    return ocean === window.__switchOcean && ocean.rod === window.__switchRod && ocean.subs[0] === window.__switchSub && ocean.groups.fish[0] === window.__switchFish;
  })).toBe(true);
  const after = await snapshot(page);
  for (const key of ['cam', 'camTarget', 'clock', 'motion', 'paused', 'waterOn', 'counts', 'rod', 'lang', 'guideLog', 'rareLog', 'statLog', 'seenLog', 'titleLog', 'subCount']) expect(after[key], key).toEqual(before[key]);
  expect(await page.evaluate(() => Object.values(window.__ATSEA__.getOcean().groups).flat().map(f => [f.x, f.y, f.yf, f.dir, f.guideId]))).toEqual(animals);
});

test('fishing continues through cast, hooked and reeling view changes and records one catch', async ({ page }) => {
  await open(page);
  await page.evaluate(() => window.__ATSEA__.setPaused(true));
  await page.locator('#btn-rod').click();
  const keepRod = async () => {
    const before = await snapshot(page);
    await page.evaluate(() => { window.__rodBefore = window.__ATSEA__.getOcean().rod; });
    await view(page, '2d'); await view(page, '3d');
    expect((await snapshot(page)).rod).toEqual(before.rod);
    expect(await page.evaluate(() => window.__rodBefore === window.__ATSEA__.getOcean().rod)).toBe(true);
  };
  await keepRod();
  const id = await page.evaluate(() => {
    const sea = window.__ATSEA__.getOcean(), fish = sea.groups.fish[0], rod = sea.rod;
    for (const kind of Object.keys(sea.groups)) sea.groups[kind] = [];
    sea.groups.fish = [fish]; rod.tip = rod.stop;
    fish.x = rod.x - fish.w / 2; fish.y = fish.yf = rod.tip - fish.h / 2;
    fish.hooked = false; fish.chew = 0; fish.rare = false; rod.mark = fish;
    return fish.guideId;
  });
  await page.locator('#btn-rod').click();
  await page.evaluate(() => window.__ATSEA__.getOcean().workRod(1));
  expect((await snapshot(page)).rod.state).toBe('on');
  await keepRod();
  await page.locator('#btn-rod').click();
  expect((await snapshot(page)).rod.state).toBe('up');
  await keepRod();
  await view(page, '2d');
  await page.evaluate(() => window.__ATSEA__.getOcean().workRod(100));
  await expect.poll(async () => (await snapshot(page)).guideLog[id]).toBe(1);
  await expect(page.locator('#catch pre')).toHaveCount(1);
  await view(page, '3d');
  await expect(page.locator('#catch img')).toHaveCount(1);
  expect((await snapshot(page)).guideLog[id]).toBe(1);
});

test('ASCII and model cards share rare records, titles and trophies and remember the selected view', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('atsea.guide')) {
      localStorage.setItem('atsea.guide', JSON.stringify({ fish0: 9 }));
      localStorage.setItem('atsea.titles', JSON.stringify({ cast: 1 }));
    }
  });
  await open(page, '2d');
  await page.evaluate(() => {
    const api = window.__ATSEA__; api.setPaused(true);
    api.recordCatch(); api.recordCatch({ rare: true }); api.recordCatch({ shapeIndex: 1 });
  });
  const before = await snapshot(page);
  expect(before.guideLog).toEqual({ fish0: 11, fish1: 1 });
  expect(before.rareLog).toEqual({ fish0: 1 });
  expect(before.titleLog).toMatchObject({ cast: 1, luck: 1, 'trophy.plain.1': 1, 'trophy.rare.1': 1 });
  await expect(page.locator('#catch pre')).toHaveCount(1);
  await view(page, '3d');
  await expect(page.locator('#catch img')).toHaveCount(1);
  await page.locator('#btn-guide').click();
  await page.locator('[data-tab="rare"]').click();
  await page.locator('#guide-grid [data-id="fish0"]').focus();
  await page.evaluate(() => window.__ATSEA__.setRenderMode('2d'));
  await expect(page.locator('#guide-grid [data-id="fish0"]')).toBeFocused();
  await expect(page.locator('#guide-grid pre')).toHaveCount(15);
  await expect(page.locator('#guide-grid [data-id="fish0"] pre')).toHaveText('><>');
  await expect(page.locator('#guide-grid [data-id="fish1"] pre')).toContainText('█');
  for (const key of ['guideLog', 'rareLog', 'titleLog']) expect((await snapshot(page))[key]).toEqual(before[key]);
  await page.reload();
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().ready);
  expect((await snapshot(page)).renderMode).toBe('2d');
  expect((await snapshot(page)).guideLog).toEqual(before.guideLog);
  await page.locator('#btn-guide').click();
  await page.locator('#btn-guide-reset').click(); await page.locator('#btn-guide-reset').click();
  await page.locator('#btn-guide-close').click(); await view(page, '3d');
  expect((await snapshot(page)).guideLog).toEqual({});
  expect((await snapshot(page)).titleLog).toEqual({});
});

test('2D remains playable during a 3D download and a late load cannot override the latest choice', async ({ page }) => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let requests = 0;
  await page.route('**/*.glb', async route => { requests++; await gate; await route.continue(); });
  try {
    await page.goto('/');
    await expect.poll(async () => (await snapshot(page)).rendererStatus).toBe('loading');
    await expect(page.locator('#c-ascii')).toBeVisible();
    await expect(page.locator('#sea-title')).toHaveText('ASCII Tropical Sea');
    await expect(page).toHaveTitle('At Sea — ASCII Tropical Sea');
    await page.locator('#btn-pause').click();
    await page.locator('#btn-rod').click();
    await page.evaluate(() => { window.__loadingOcean = window.__ATSEA__.getOcean(); });
    await view(page, '2d');
    await page.locator('#btn-view').click();
    await view(page, '2d');
    release();
    await expect.poll(async () => (await snapshot(page)).rendererStatus, { timeout: 60_000 }).toBe('ready');
    expect((await snapshot(page)).renderMode).toBe('2d');
    expect(await page.evaluate(() => localStorage.getItem('atsea.view'))).toBe('2d');
    expect(await page.evaluate(() => window.__loadingOcean === window.__ATSEA__.getOcean())).toBe(true);
    expect((await snapshot(page)).rod).not.toBeNull();
    await view(page, '3d');
    expect(requests).toBe(21);
  } finally { release(); }
});

test('saved 2D starts without models and renders the surface and seabed as ASCII', async ({ page }, info) => {
  const models = [];
  page.on('request', request => { if (request.url().endsWith('.glb')) models.push(request.url()); });
  await open(page, '2d');
  await page.evaluate(() => window.__ATSEA__.setPaused(true));
  for (const [name, fraction] of [['surface', 0], ['seabed', 1]]) {
    await page.evaluate(f => {
      const api = window.__ATSEA__;
      api.diveToFraction(f); api.step(4000);
      const state = api.snapshot();
      // The deterministic game seed puts animals deeper than the surface viewport.
      // Place three known sprites in each inspected band so this checks glyph rendering.
      api.getOcean().groups.fish.slice(0, 3).forEach((fish, i) => {
        fish.x = state.cols * .2 + i * 10; fish.y = fish.yf = Math.round(state.cam) + 5 + i * 5;
        fish.color = ['#ff8700', '#00ffff', '#ff87ff'][i];
      });
      api.step(1);
    }, fraction);
    const canvas = page.locator('#c-ascii');
    const screenshot = await page.screenshot({ path: info.outputPath('ascii-' + name + '.png'), fullPage: true });
    const appearance = inspectWaterPixels(screenshot, await canvas.boundingBox());
    expect(appearance.distinctColors).toBeGreaterThan(100);
    expect(appearance.brightnessRange).toBeGreaterThan(30);
  }
  await page.locator('#btn-guide').click();
  await expect(page.locator('#guide-grid pre')).toHaveCount(15);
  await expect(page.locator('#guide-grid img')).toHaveCount(0);
  expect(models).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
});

test('special bait and megalodon sighting stay shared when changing view', async ({ page }, info) => {
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 844, height: 390 });
  await page.addInitScript(() => {
    const ids = ['fish0', 'fish1', 'fish2', 'fish3', 'fish4', 'fish5', 'fish6', 'jelly', 'seahorse', 'squid', 'ray', 'lantern', 'octopus', 'angler'];
    localStorage.setItem('atsea.guide', JSON.stringify({ ...Object.fromEntries(ids.map(id => [id, 1])), fish0: 400 }));
    localStorage.setItem('atsea.rare', JSON.stringify({ fish0: 12, fish1: 1, fish2: 1, fish3: 1, shark: 1 }));
    localStorage.setItem('atsea.stats', JSON.stringify({ snap: 10, seabed: 1 }));
  });
  await open(page, '2d');
  await page.evaluate(() => window.__ATSEA__.setPaused(true));
  await expect(page.locator('#btn-bait')).toBeVisible();
  await page.locator('#btn-bait').click();
  await page.evaluate(() => {
    const ocean = window.__ATSEA__.getOcean();
    window.__baitBefore = ocean.bait; window.__megaBefore = ocean.groups.megalodon[0];
  });
  await view(page, '3d'); await view(page, '2d');
  expect(await page.evaluate(() => {
    const ocean = window.__ATSEA__.getOcean();
    return ocean.bait === window.__baitBefore && ocean.groups.megalodon[0] === window.__megaBefore;
  })).toBe(true);
  await page.evaluate(() => {
    const api = window.__ATSEA__, mega = api.getOcean().groups.megalodon[0];
    mega.x = 0; mega.y = mega.yf = api.snapshot().cam + 1;
    api.step(1); api.recordCatch();
  });
  expect((await snapshot(page)).seenLog.megalodon).toBe(1);
  expect((await snapshot(page)).titleLog.real).toBe(1);
  await view(page, '3d');
  await page.locator('#btn-guide').click();
  await expect(page.locator('#guide-grid [data-id="megalodon"]')).toBeVisible();
});

test('ASCII input supports depth gestures and the view buttons work in wallpaper mode', async ({ page, context }, info) => {
  await open(page, '2d');
  await page.evaluate(() => window.__ATSEA__.setPaused(true));
  const box = await page.locator('#c-ascii').boundingBox();
  if (info.project.name === 'mobile') {
    const cdp = await context.newCDPSession(page);
    const y = box.y + box.height * .7;
    const points = [{ x: box.x + 90, y, id: 1 }, { x: box.x + 170, y, id: 2 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points.map(p => ({ ...p, y: y - 120 })) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  } else {
    await page.locator('#c-ascii').hover();
    await page.mouse.wheel(0, 600);
  }
  await expect.poll(async () => (await snapshot(page)).camTarget).toBeGreaterThan(0);
  await page.locator('#btn-bottom').click();
  await expect.poll(() => page.locator('#metres').textContent()).toBe('1500m');
  await page.locator('#btn-bare').click();
  await expect(page.locator('body')).toHaveClass(/bare/);
  await expect(page.locator('#btn-view')).toBeVisible();
  const titleBox = await page.locator('#sea-title').boundingBox();
  const switchBox = await page.locator('#btn-view').boundingBox();
  const toolsBox = await page.locator('.tools').boundingBox();
  expect(switchBox.x).toBeGreaterThan(titleBox.x + titleBox.width);
  expect(toolsBox.y).toBeGreaterThanOrEqual(switchBox.y + switchBox.height);
  const exitBox = await page.locator('#btn-exit').boundingBox();
  expect(exitBox.y).toBeGreaterThan(toolsBox.y + toolsBox.height);
  await view(page, '3d'); await view(page, '2d');
  expect((await snapshot(page)).paused).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/bare/);
});

test('WebGL unavailable at startup still leaves a usable ASCII sea @failure-case', async ({ page }) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
      return kind === 'webgl' || kind === 'webgl2' ? null : getContext.call(this, kind, ...args);
    };
  });
  await page.goto('/');
  await expect.poll(async () => (await snapshot(page)).rendererStatus).toBe('error');
  expect((await snapshot(page)).ready).toBe(true);
  await expect(page.locator('#c-ascii')).toBeVisible();
  await expect(page.locator('#sea-retry')).toBeVisible();
  await page.locator('#btn-bottom').click();
  await expect.poll(() => page.locator('#metres').textContent()).toBe('1500m');
  await expect(page.locator('#btn-view')).toHaveText('3D');
  await expect(page.locator('#btn-view')).toHaveAttribute('aria-label', 'Switch to 3D');
  await page.locator('#btn-guide').click();
  await expect(page.locator('#guide-grid pre')).toHaveCount(15);
});
