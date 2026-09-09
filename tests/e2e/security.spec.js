import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('extreme saved settings stay bounded through view changes and reload', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('atsea.sliders')) {
      localStorage.setItem('atsea.sliders', JSON.stringify({ fish: 1e9, sharks: 1e9, whale: 1e9, coral: 1e9, starfish: 1e9, seaweed: 1e9, speed: 1e9 }));
      localStorage.setItem('atsea.view', '2d');
      localStorage.setItem('atsea.guide', JSON.stringify({ fish0: 1000000 }));
    }
  });
  await page.goto('/');
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().renderMode === '2d');
  await page.locator('#btn-pause').click();
  const limits = { fish: 1000, sharks: 24, whale: 24, coral: 28, starfish: 28, seaweed: 100, speed: 60 };
  for (const [key, max] of Object.entries(limits)) {
    await expect(page.locator('#' + key)).toHaveValue(String(max));
    expect(Number(await page.locator('#' + key).getAttribute('max'))).toBeLessThanOrEqual(max);
  }
  await page.evaluate(async () => {
    const api = window.__ATSEA__;
    await api.setRenderMode('3d');
  });
  await page.waitForFunction(() => window.__ATSEA__.snapshot().renderMode === '3d');
  await page.evaluate(() => window.__ATSEA__.setRenderMode('2d'));
  await page.locator('#fish').evaluate(input => input.dispatchEvent(new Event('change', { bubbles: true })));
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('atsea.sliders')))).toEqual(limits);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('atsea.guide')))).toEqual({ fish0: 1000000 });
  await page.reload();
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().renderMode === '2d');
  await expect(page.locator('#fish')).toHaveValue('1000');
});


test('security headers allow the app and same-origin frames, but block external embedding', async ({ page, baseURL }) => {
  test.skip(process.env.ATSEA_SECURITY_HEADERS !== 'true', 'Requires the Cloudflare static-assets runtime with _headers enabled');
  const response = await page.request.get('/');
  const headers = response.headers();
  expect(headers['content-security-policy']).toContain("script-src 'self'");
  expect(headers['content-security-policy']).toContain("frame-ancestors 'self'");
  expect(headers['x-frame-options']).toBe('SAMEORIGIN');
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');

  // Enforce the exact shipped CSP and HTML through browser interception as well.
  // Local HTTP filters/extensions can otherwise rewrite both before the browser sees them.
  const rules = await readFile(new URL('../../public/_headers', import.meta.url), 'utf8');
  const policy = rules.match(/^  Content-Security-Policy: (.+)$/m)[1];
  const html = await readFile(new URL('../../dist/index.html', import.meta.url), 'utf8');
  await page.route(new URL('/', baseURL).href, route => route.fulfill({
    body: html,
    contentType: 'text/html',
    headers: { 'content-security-policy': policy, 'x-frame-options': headers['x-frame-options'] },
  }));
  const violations = [];
  await page.exposeFunction('recordPolicyViolation', value => violations.push(value));
  await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => window.recordPolicyViolation(event.violatedDirective)));
  await page.goto('/');
  await page.waitForFunction(() => window.__ATSEA__?.snapshot().renderMode === '3d');
  await page.locator('#btn-guide').click();
  await expect(page.locator('#guide')).toBeVisible();
  await page.evaluate(async () => { await document.fonts.load('15px "IBM Plex Mono"'); });
  expect(violations).toEqual([]);

  const framedURL = new URL('/', baseURL).href;
  const sameOrigin = new URL('/frame-test', baseURL).href;
  const frameHTML = '<iframe src="' + framedURL + '"></iframe>';
  await page.route(sameOrigin, route => route.fulfill({ contentType: 'text/html', body: frameHTML }));
  await page.goto(sameOrigin);
  await expect(page.frameLocator('iframe').locator('#btn-view')).toBeVisible();

  const errors = [];
  page.on('console', message => errors.push(message.text()));
  await page.route('http://frame-host.invalid/**', route => route.fulfill({ contentType: 'text/html', body: frameHTML }));
  await page.goto('http://frame-host.invalid/');
  await expect.poll(() => errors.some(message => message.includes('frame-ancestors') || message.includes('X-Frame-Options'))).toBe(true);
  await expect(page.frameLocator('iframe').locator('#btn-view')).toHaveCount(0);
});
