import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

test('a swallowed fish produces a prominent 3D burst in shallow and deep water', async ({ page }, info) => {
  if (info.project.name === 'mobile') await page.setViewportSize({ width: 844, height: 700 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Math.random = () => .5;
    localStorage.setItem('atsea.lang', 'en');
    localStorage.setItem('atsea.view', '3d');
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().renderMode === '3d');
  await page.evaluate(() => {
    const api = window.__ATSEA__;
    api.setPaused(true);
    window.predationAnimals = { shark: api.getOcean().groups.shark[0], fish: api.getOcean().groups.fish[0] };
  });
  for (const depth of [0, .85]) {
    const state = await page.evaluate(depth => {
      const api = window.__ATSEA__, ocean = api.getOcean();
      api.diveToFraction(depth); api.step(3000);
      const state = api.snapshot(), { shark, fish } = window.predationAnimals;
      for (const kind of Object.keys(ocean.groups)) ocean.groups[kind] = [];
      shark.x = Math.max(1, state.cols / 2 - shark.w);
      shark.y = shark.yf = state.cam + state.rows / 2 - shark.h / 2;
      shark.dir = 1;
      fish.x = shark.x + shark.w - 1 - fish.w / 2;
      fish.y = fish.yf = shark.y + Math.floor(shark.h / 2) - fish.h / 2;
      fish.hooked = false;
      ocean.groups.shark = [shark]; ocean.groups.fish = [fish];
      ocean.nextMeal = 0;
      ocean.feed(1000000, state.cam, state.rows);
      if (ocean.pending?.[0] !== fish) throw new Error('The shark did not target the fish');
      ocean.swallow(ocean.pending[1] + 1);
      if (ocean.groups.fish.includes(fish)) throw new Error('The fish was not swallowed');
      window.reviewChomps = ocean.chomps;
      for (const chomp of window.reviewChomps) chomp.age = 6;
      ocean.chomps = []; ocean.alarms = [];
      api.step(1);
      document.getElementById('catch').hidden = true;
      return state;
    }, depth);
    const canvas = page.locator('#c');
    const before = PNG.sync.read(await canvas.screenshot());
    await page.evaluate(() => {
      const api = window.__ATSEA__;
      api.getOcean().chomps = window.reviewChomps; api.step(1);
    });
    const after = PNG.sync.read(await canvas.screenshot({ path: info.outputPath(`predation-${depth}.png`) }));
    let changed = 0, left = after.width, right = 0;
    for (let y = 0; y < after.height; y++) for (let x = 0; x < after.width; x++) {
      const i = (y * after.width + x) * 4;
      if (Math.max(...[0, 1, 2].map(c => after.data[i + c] - before.data[i + c])) < 35) continue;
      changed++; left = Math.min(left, x); right = Math.max(right, x);
    }
    expect(changed).toBeGreaterThan(300);
    expect(right - left).toBeGreaterThan(after.width / state.cols * 6);
    await page.evaluate(() => { window.__ATSEA__.getOcean().chomps = []; });
  }
  expect(errors).toEqual([]);
});
