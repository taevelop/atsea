import { test, expect } from '@playwright/test';

const snapshot = page => page.evaluate(() => window.__ATSEA__.snapshot());
const whaleTotal = async page => {
  const { counts } = await snapshot(page);
  return counts.whale + counts.dolphin;
};
const slider = (page, id, value) => page.locator(`#${id}`).evaluate((input, next) => {
  input.value = String(next);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}, value);
const ready = page => page.waitForFunction(() => window.__ATSEA__?.snapshot().ready);

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(() => {
    if (!localStorage.getItem('atsea.lang')) localStorage.setItem('atsea.lang', 'en');
    if (!localStorage.getItem('atsea.view')) localStorage.setItem('atsea.view', '2d');
  });
});

test('Whale between Sharks and Coral controls the combined total independently in both views', async ({ page }, info) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  const initial = await snapshot(page);
  expect(await whaleTotal(page)).toBe(Number(await page.locator('#whale').inputValue()));
  await expect(page.getByRole('slider', { name: 'Whale', exact: true })).toBeVisible();
  expect(await page.locator('.ctl input').evaluateAll(inputs => inputs.map(input => input.id)))
    .toEqual(['fish', 'sharks', 'whale', 'coral', 'starfish', 'seaweed', 'speed']);
  const max = Number(await page.locator('#sharks').getAttribute('max'));
  await expect(page.locator('#whale')).toHaveAttribute('max', String(max));
  for (const total of [0, 1, max, 5]) {
    await slider(page, 'whale', total);
    await expect(page.locator('#whale-v')).toHaveText(String(total));
    expect(await whaleTotal(page)).toBe(total);
    expect((await snapshot(page)).counts).toMatchObject({ fish: initial.counts.fish, shark: initial.counts.shark });
  }
  const { counts } = await snapshot(page);
  expect(counts.whale).toBeGreaterThan(0);
  expect(counts.dolphin).toBeGreaterThan(0);
  await slider(page, 'fish', 0);
  await slider(page, 'sharks', 0);
  expect(await whaleTotal(page)).toBe(5);
  await page.locator('#btn-view').click();
  await expect.poll(async () => (await snapshot(page)).renderMode, { timeout: 60_000 }).toBe('3d');
  expect(await whaleTotal(page)).toBe(5);
  await page.screenshot({ path: info.outputPath('whale-controls.png'), fullPage: true });
  await page.locator('#btn-view').click();
  await expect.poll(async () => (await snapshot(page)).renderMode).toBe('2d');
  expect(await whaleTotal(page)).toBe(5);
  expect(errors).toEqual([]);
});

test('Whale settings restore their shared maximum and survive restock, reload, resize and translation', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('atsea.sliders')) {
      localStorage.setItem('atsea.sliders', JSON.stringify({ fish: 20, sharks: 2, whale: 24 }));
    }
  });
  await page.goto('/');
  await ready(page);
  await expect(page.locator('#whale')).toHaveValue('24');
  await expect(page.locator('#whale')).toHaveAttribute('max', '24');
  await expect(page.locator('#sharks')).toHaveAttribute('max', '24');
  expect(await whaleTotal(page)).toBe(24);
  await slider(page, 'whale', 5);
  await page.locator('#btn-restock').click();
  expect(await whaleTotal(page)).toBe(5);
  await page.reload();
  await ready(page);
  await expect(page.locator('#whale')).toHaveValue('5');
  expect(await whaleTotal(page)).toBe(5);
  const cols = (await snapshot(page)).cols;
  const viewport = page.viewportSize();
  await page.setViewportSize({ ...viewport, width: viewport.width + 60 });
  await expect.poll(async () => (await snapshot(page)).cols).not.toBe(cols);
  expect((await snapshot(page)).counts.fish).toBe(20);
  expect(await whaleTotal(page)).toBe(5);
  await page.locator('#btn-lang').click();
  await expect(page.getByRole('slider', { name: '고래', exact: true })).toBeVisible();
  await expect(page.locator('#whale')).toHaveAttribute('max', await page.locator('#sharks').getAttribute('max'));
});
