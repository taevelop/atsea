import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { inspectWaterPixels } from './image-checks.js';

const diagnostics = new WeakMap();
const state = page => page.evaluate(() => window.__ATSEA__.snapshot());
const depth = async page => Number((await page.locator('#metres').textContent()).replace(/[^\d]/g, ''));
const ready = async page => {
  await page.goto('/');
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().renderMode === '3d', undefined, { timeout: 60_000 });
  await expect(page.locator('#c')).toBeVisible();
};
const slider = async (page, id, value) => page.locator(`#${id}`).evaluate((input, val) => {
  input.value = String(val);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, value);
const blur = page => page.evaluate(() => document.activeElement?.blur());

test.beforeEach(async ({ page }) => {
  const errors = [];
  diagnostics.set(page, errors);
  page.on('pageerror', error => errors.push(`Runtime: ${error.message}`));
  page.on('console', message => { if (message.type() === 'error') errors.push(`Console: ${message.text()}`); });
  page.on('response', response => {
    if (/\.(glb|png)(?:\?|$)/.test(response.url()) && response.status() >= 400) errors.push(`Asset ${response.status()}: ${response.url()}`);
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem('atsea.lang')) localStorage.setItem('atsea.lang', 'en');
  });
});

test.afterEach(async ({ page }, info) => {
  const errors = diagnostics.get(page) || [];
  if (errors.length) await info.attach('browser-errors', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
  expect(errors.filter(error => error.startsWith('Runtime:'))).toEqual([]);
  if (!info.title.includes('@failure-case')) expect(errors).toEqual([]);
});

test('3D aquarium preserves desktop/mobile layout and model-based guide cards', async ({ page }) => {
  await ready(page);
  await expect(page).toHaveTitle('At Sea — Animated Tropical Sea');
  for (const id of ['btn-rod', 'btn-sub', 'btn-guide', 'btn-pause', 'btn-lang', 'gauge']) await expect(page.locator(`#${id}`)).toBeVisible();
  await expect(page.locator('#btn-bait')).toBeHidden();
  const bounds = await page.evaluate(() => {
    const rect = element => { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height }; };
    return { canvas: rect(document.querySelector('#c')), gauge: rect(document.querySelector('#gauge')), bar: rect(document.querySelector('.bar:not(.bar--top)')), viewport: innerWidth, documentWidth: document.documentElement.scrollWidth };
  });
  expect(bounds.canvas.width).toBeGreaterThan(280);
  expect(bounds.canvas.height).toBeGreaterThan(300);
  expect(bounds.gauge.left).toBeGreaterThanOrEqual(bounds.canvas.right - 2);
  expect(bounds.bar.top).toBeGreaterThanOrEqual(bounds.canvas.bottom - 2);
  expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.viewport + 1);
  await page.locator('#btn-guide').click();
  await expect(page.locator('#guide')).toBeVisible();
  await expect(page.locator('#guide-grid .sp[data-id^="fish"]')).toHaveCount(7);
  await expect(page.locator('#guide-grid .sp[data-id="megalodon"]')).toHaveCount(0);
  await expect(page.locator('#guide-grid pre')).toHaveCount(0);
  await expect.poll(() => page.locator('#guide-grid img').evaluateAll(images => images.length >= 15 && images.every(image => image.complete && image.naturalWidth >= 64))).toBe(true);
  await page.locator('[data-tab="rare"]').click();
  await expect(page.locator('#guide-grid .sp[data-id="shark"]')).toHaveCount(1);
  await page.locator('[data-tab="titles"]').click();
  await expect(page.locator('#guide-grid')).toContainText(/title|First Cast/i);
  await page.locator('[data-tab="trophies"]').click();
  await expect(page.locator('#guide-grid .trophy')).toHaveCount(2);
  await page.locator('#btn-guide-close').click();
  await expect(page.locator('#guide')).toBeHidden();
});

test('depth bounds, paused diving, resize, restock, and wallpaper preserve viewing depth', async ({ page }, info) => {
  await ready(page);
  await page.locator('#btn-pause').click();
  await expect(page.locator('#btn-pause')).toHaveAttribute('aria-pressed', 'true');
  const frozen = await page.evaluate(() => window.__ATSEA__.getOcean().groups.fish.slice(0, 5).map(f => [f.x, f.yf]));
  await page.locator('#btn-bottom').click();
  await expect.poll(() => depth(page)).toBe(1500);
  expect(await page.evaluate(() => window.__ATSEA__.getOcean().groups.fish.slice(0, 5).map(f => [f.x, f.yf]))).toEqual(frozen);
  await blur(page);
  await page.keyboard.press('End');
  await expect.poll(() => depth(page)).toBe(1500);
  await page.keyboard.press('Home');
  await expect.poll(() => depth(page)).toBe(0);
  await page.locator('#c').hover();
  await page.mouse.wheel(0, 900);
  await expect.poll(() => depth(page)).toBeGreaterThan(0);
  const gauge = await page.locator('#track').boundingBox();
  await page.mouse.move(gauge.x + gauge.width / 2, gauge.y + gauge.height / 2);
  await page.mouse.down();
  await page.mouse.move(gauge.x + gauge.width / 2, gauge.y + gauge.height * 0.6);
  await page.mouse.up();
  await expect.poll(() => depth(page)).toBeGreaterThan(650);
  await expect.poll(() => depth(page)).toBeLessThan(1200);
  await page.evaluate(() => window.__ATSEA__.diveToFraction(0.5));
  await expect.poll(() => depth(page)).toBe(750);
  const targetSize = info.project.name === 'mobile' ? { width: 844, height: 390 } : { width: 1280, height: 800 };
  await page.setViewportSize(targetSize);
  await expect.poll(() => depth(page)).toBe(750);
  await page.locator('#btn-restock').click();
  await expect.poll(() => depth(page)).toBe(750);
  await page.locator('#btn-bare').click();
  await expect(page.locator('body')).toHaveClass(/bare/);
  await expect(page.locator('#gauge')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__ATSEA__.snapshot().depthFraction)).toBeCloseTo(0.5, 2);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/bare/);
  await expect.poll(() => depth(page)).toBe(750);
});

test('fish slider zero/max, separate shark slider, submarine, and tint controls work', async ({ page }, info) => {
  await ready(page);
  await page.locator('#btn-pause').click();
  await slider(page, 'fish', 0);
  const zero = await page.evaluate(() => Object.fromEntries(Object.entries(window.__ATSEA__.getOcean().groups).map(([kind, group]) => [kind, group.length])));
  for (const kind of ['fish', 'lantern', 'jelly', 'seahorse', 'squid', 'angler', 'octopus', 'ray']) expect(zero[kind]).toBe(0);
  expect(zero.shark).toBeGreaterThan(0);
  await slider(page, 'sharks', 0);
  expect(await page.evaluate(() => window.__ATSEA__.getOcean().groups.shark.length)).toBe(0);
  const max = await page.locator('#fish').getAttribute('max');
  await slider(page, 'fish', Number(max));
  await expect.poll(async () => (await state(page)).redTide).toBe(true);
  expect(await page.evaluate(() => window.__ATSEA__.getOcean().groups.fish.length)).toBe(Number(max));
  const maxBox = await page.locator('#c').boundingBox();
  const maxPixels = await page.screenshot({ path: info.outputPath('red-ocean.png'), fullPage: true });
  await info.attach('maximum population red ocean', { path: info.outputPath('red-ocean.png'), contentType: 'image/png' });
  const redAppearance = inspectWaterPixels(maxPixels, maxBox);
  expect(redAppearance.distinctColors).toBeGreaterThan(100);
  expect(redAppearance.meanRed).toBeGreaterThan(redAppearance.meanBlue);
  await slider(page, 'fish', 20);
  await expect.poll(async () => (await state(page)).redTide).toBe(false);
  await page.locator('#btn-sub').click();
  await expect(page.locator('#btn-sub')).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => window.__ATSEA__.getOcean().subs.length)).toBe(1);
  await page.locator('#btn-sub').click();
  await expect(page.locator('#btn-sub')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#btn-water').click();
  await expect(page.locator('#btn-water')).toHaveAttribute('aria-pressed', 'false');
  await page.locator('#btn-water').click();
  await expect(page.locator('#btn-water')).toHaveAttribute('aria-pressed', 'true');
});

test('manual fishing updates the catch notice, guide, and persistent record once', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.__ATSEA__.setPaused(true));
  await page.locator('#btn-rod').click();
  const id = await page.evaluate(() => {
    const sea = window.__ATSEA__.getOcean();
    const fish = sea.groups.fish[0];
    for (const key of Object.keys(sea.groups)) sea.groups[key] = [];
    sea.groups.fish = [fish];
    const rod = sea.rod;
    rod.tip = rod.stop;
    fish.x = rod.x - fish.w / 2;
    fish.y = fish.yf = rod.tip - fish.h / 2;
    fish.hooked = false; fish.chew = 0; fish.rare = false;
    rod.mark = fish;
    return fish.guideId;
  });
  await page.locator('#btn-rod').click();
  await page.evaluate(() => {
    const random = Math.random;
    try { Math.random = () => 0.2; window.__ATSEA__.getOcean().workRod(1); }
    finally { Math.random = random; }
  });
  expect(await page.evaluate(() => window.__ATSEA__.getOcean().rod.state)).toBe('on');
  await page.locator('#btn-rod').click();
  await page.evaluate(() => window.__ATSEA__.getOcean().workRod(100));
  await expect(page.locator('#catch')).toBeVisible();
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem('atsea.guide') || '{}')[key], id)).toBe(1);
  await page.locator('#btn-guide').click();
  await expect(page.locator(`#guide-grid .sp[data-id="${id}"]`)).not.toHaveClass(/sp--unknown/);
  await page.reload();
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().renderMode === '3d');
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem('atsea.guide'))[key], id)).toBe(1);
});

test('legacy language, collapsed controls, slider, and collection records survive reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('atsea.guide', JSON.stringify({ fish0: 8, fish6: 4, angler: 2 }));
      localStorage.setItem('atsea.rare', JSON.stringify({ shark: 1, fish6: 1 }));
      localStorage.setItem('atsea.sliders', JSON.stringify({ fish: 31, sharks: 2, speed: 20 }));
      sessionStorage.setItem('seeded', 'yes');
    }
  });
  await ready(page);
  await expect(page.locator('#fish')).toHaveValue('31');
  await expect(page.locator('#sharks')).toHaveValue('2');
  await page.locator('#btn-lang').click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('atsea.lang'))).toBe('ko');
  await expect(page.locator('#btn-guide')).toHaveAttribute('aria-label', '도감');
  await page.locator('#btn-panel').click();
  await expect(page.locator('#btn-panel')).toHaveAttribute('aria-expanded', 'false');
  await page.reload();
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().renderMode === '3d');
  await expect(page.locator('#btn-panel')).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#btn-guide')).toHaveAttribute('aria-label', '도감');
  await page.locator('#btn-guide').click();
  await expect(page.locator('[data-id="fish0"] .sp-tally')).toContainText('8');
  await expect(page.locator('[data-id="fish6"] .sp-tally')).toContainText('4');
  const rareRecords = await page.evaluate(() => JSON.parse(localStorage.getItem('atsea.rare')));
  expect(rareRecords.fish6).toBe(1);
  // A naturally spotted rare shark can add a legitimate sighting during reload.
  expect(rareRecords.shark).toBeGreaterThanOrEqual(1);
});

test('unlocked bait summons megalodon and reveals its hidden guide entry only on sighting', async ({ page }) => {
  await page.addInitScript(() => {
    const ids = ['fish0', 'fish1', 'fish2', 'fish3', 'fish4', 'fish5', 'fish6', 'jelly', 'seahorse', 'squid', 'ray', 'lantern', 'octopus', 'angler'];
    localStorage.setItem('atsea.guide', JSON.stringify({ ...Object.fromEntries(ids.map(id => [id, 1])), fish0: 400 }));
    localStorage.setItem('atsea.rare', JSON.stringify({ fish0: 12, fish1: 1, fish2: 1, fish3: 1, shark: 1 }));
    localStorage.setItem('atsea.stats', JSON.stringify({ snap: 10, seabed: 1 }));
  });
  await ready(page);
  await page.evaluate(() => window.__ATSEA__.setPaused(true));
  await expect(page.locator('#btn-bait')).toBeVisible();
  if ((await state(page)).cols < 61) {
    await page.locator('#btn-bait').click();
    expect(await page.evaluate(() => window.__ATSEA__.getOcean().groups.megalodon.length)).toBe(0);
    await expect(page.locator('#hint')).toContainText('too small');
    await page.setViewportSize({ width: 844, height: 390 });
    await expect.poll(async () => (await state(page)).cols).toBeGreaterThanOrEqual(61);
  }
  await page.locator('#btn-bait').click();
  expect(await page.evaluate(() => window.__ATSEA__.getOcean().groups.megalodon.length)).toBe(1);
  await page.locator('#btn-bait').click();
  expect(await page.evaluate(() => window.__ATSEA__.getOcean().groups.megalodon.length)).toBe(1);
  await page.evaluate(() => {
    const state = window.__ATSEA__.snapshot();
    const mega = window.__ATSEA__.getOcean().groups.megalodon[0];
    mega.x = 0; mega.y = mega.yf = state.cam + 1;
  });
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('atsea.seen') || '{}').megalodon)).toBe(1);
  await page.locator('#btn-guide').click();
  await expect(page.locator('#guide-grid [data-id="megalodon"]')).toBeVisible();
});

test('two-finger dive moves depth and releases cleanly after touch ends', async ({ page, context }, info) => {
  test.skip(info.project.name !== 'mobile', 'Real two-contact input is verified on the touch project.');
  await ready(page);
  await page.evaluate(() => window.__ATSEA__.setPaused(true));
  // New visitors can show a sighting card over the intended touch coordinates.
  const dismiss = page.locator('[data-close-catch]');
  if (await dismiss.isVisible()) await dismiss.click();
  const box = await page.locator('#c').boundingBox();
  const cdp = await context.newCDPSession(page);
  const y = box.y + box.height * 0.7;
  const points = [ { x: box.x + 90, y, id: 1 }, { x: box.x + 170, y, id: 2 } ];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points.map(p => ({ ...p, y: y - 120 })) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(() => depth(page)).toBeGreaterThan(0);
  await page.evaluate(() => window.__ATSEA__.diveToFraction(0));
  await expect.poll(() => depth(page)).toBe(0);
  await page.touchscreen.tap(box.x + 100, box.y + box.height / 2);
  await expect.poll(() => depth(page)).toBe(0);
  await cdp.detach();
});

test('surface, middle, and seabed render with measured browser frame timing', async ({ page }, info) => {
  await ready(page);
  for (const [name, fraction] of [['surface', 0], ['middle', 0.5], ['seabed', 1]]) {
    await page.evaluate(f => window.__ATSEA__.diveToFraction(f), fraction);
    await expect.poll(() => depth(page)).toBe(Math.round(fraction * 1500));
    const canvasBox = await page.locator('#c').boundingBox();
    const pixels = await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
    await info.attach(name, { path: info.outputPath(`${name}.png`), contentType: 'image/png' });
    const appearance = inspectWaterPixels(pixels, canvasBox);
    await info.attach(`${name}-pixels`, { body: JSON.stringify(appearance), contentType: 'application/json' });
    expect(appearance.distinctColors, `${name}: WebGL water must contain visible rendered detail`).toBeGreaterThan(100);
    expect(appearance.brightnessRange, `${name}: WebGL water must not be a cleared dark frame`).toBeGreaterThan(30);
  }
  const performanceSample = await page.evaluate(async () => {
    const frameTimes = [];
    const started = performance.now();
    let previous = started;
    await new Promise(resolve => {
      const sample = now => {
        frameTimes.push(now - previous); previous = now;
        if (now - started < 4000) requestAnimationFrame(sample); else resolve();
      };
      requestAnimationFrame(sample);
    });
    const ordered = frameTimes.slice(1).sort((a, b) => a - b);
    return { elapsedMs: previous - started, frames: frameTimes.length, fps: Number((frameTimes.length * 1000 / (previous - started)).toFixed(1)), p95FrameMs: Number(ordered[Math.floor(ordered.length * 0.95)].toFixed(1)), viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, userAgent: navigator.userAgent, state: window.__ATSEA__.snapshot(), environment: 'Headless Microsoft Edge, ANGLE SwiftShader software WebGL; viewport emulation is not physical mobile hardware.' };
  });
  await writeFile(info.outputPath('performance.json'), JSON.stringify(performanceSample, null, 2));
  await info.attach('performance', { path: info.outputPath('performance.json'), contentType: 'application/json' });
  expect(performanceSample.frames).toBeGreaterThan(3);
});


test('model download failure offers a working view-button retry @failure-case', async ({ page }) => {
  await page.route('**/*.glb', route => route.abort('failed'));
  await page.goto('/');
  await expect(page.locator('#sea-loading')).toBeVisible();
  await expect(page.locator('#sea-retry')).toBeVisible();
  await expect(page.locator('#sea-loading-label')).toContainText(/continues in 2D|2D로 이어/);
  expect((await state(page)).failed).toBe(false);
  expect((await state(page)).renderMode).toBe('2d');
  await page.evaluate(() => {
    window.__ATSEA__.setPaused(true); window.__ATSEA__.castRod();
    window.__failureOcean = window.__ATSEA__.getOcean();
    window.__failureRod = window.__failureOcean.rod;
    window.__ATSEA__.recordCatch();
  });
  await page.unroute('**/*.glb');
  await expect(page.locator('#btn-view')).toHaveText('3D');
  await page.locator('#btn-view').click();
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().renderMode === '3d', undefined, { timeout: 60_000 });
  await expect(page.locator('#sea-loading')).toBeHidden();
  expect((await state(page)).failed).toBe(false);
  expect(await page.evaluate(() => window.__failureOcean === window.__ATSEA__.getOcean() && window.__failureRod === window.__ATSEA__.getOcean().rod)).toBe(true);
  expect((await state(page)).guideLog.fish0).toBe(1);
  await page.locator('#btn-bottom').click();
  await expect.poll(() => depth(page)).toBe(1500);
});

test('WebGL context restoration recovers the scene without losing saved records @failure-case', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'Context loss recovery uses the desktop WebGL test environment.');
  await ready(page);
  await page.evaluate(() => {
    window.__ATSEA__.setPaused(true); window.__ATSEA__.castRod(); window.__ATSEA__.toggleSub();
    window.__contextOcean = window.__ATSEA__.getOcean();
    window.__contextRod = window.__contextOcean.rod;
    window.__ATSEA__.recordCatch({ kind: 'fish', shapeIndex: 0, rare: false });
  });
  const supported = await page.evaluate(() => {
    const gl = document.querySelector('#c').getContext('webgl2');
    const loss = gl.getExtension('WEBGL_lose_context');
    if (!loss) return false;
    window.__contextLossTest = loss;
    loss.loseContext();
    return true;
  });
  expect(supported).toBe(true);
  await expect(page.locator('#sea-retry')).toBeVisible();
  expect((await state(page)).renderMode).toBe('2d');
  expect(await page.evaluate(() => window.__contextOcean === window.__ATSEA__.getOcean())).toBe(true);
  await page.evaluate(() => window.__contextLossTest.restoreContext());
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().renderMode === '3d', undefined, { timeout: 60_000 });
  await expect(page.locator('#sea-loading')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('atsea.guide')).fish0)).toBe(1);
  expect(await page.evaluate(() => window.__contextOcean === window.__ATSEA__.getOcean() && window.__contextRod === window.__ATSEA__.getOcean().rod)).toBe(true);
  await page.locator('#btn-guide').click();
  await expect(page.locator('[data-id="fish0"]')).not.toHaveClass(/sp--unknown/);
});




test('field guide keyboard focus stays in the dialog and species navigation preserves pause', async ({ page }) => {
  await ready(page);
  await page.evaluate(() => window.__ATSEA__.setPaused(true));
  await page.locator('#btn-guide').focus();
  await page.keyboard.press('d');
  await expect(page.locator('#guide')).toBeVisible();
  await expect(page.locator('#btn-guide-close')).toBeFocused();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('#guide'))).toBe(true);
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('#guide'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.locator('#guide')).toBeHidden();
  await expect(page.locator('#btn-guide')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#guide')).toBeVisible();
  await page.locator('#guide-grid [data-id="angler"]').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#guide')).toBeHidden();
  await expect.poll(() => depth(page)).toBeGreaterThan(1200);
  await expect(page.locator('#btn-pause')).toHaveAttribute('aria-pressed', 'true');
});
