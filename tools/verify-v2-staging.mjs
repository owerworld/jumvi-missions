import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {chromium, webkit, expect} from '@playwright/test';
import {serveCoexist} from './serve-v2-coexist.mjs';

const origin = process.env.V2_REVIEW_ORIGIN || 'https://jumvi-missions-staging.saykirtasiye.workers.dev';
assert(['https://jumvi-missions-staging.saykirtasiye.workers.dev', 'https://qr.jumvi.co'].includes(origin));
const local = JSON.parse(readFileSync('dist-v2/v2/release-manifest.json'));
const offline = JSON.parse(readFileSync('dist-v2/v2/sw-release.json'));
const remote = await fetch(origin + '/v2/release-manifest.json').then(r => r.json());
assert.deepEqual(remote, local);
const pending = [...local.files];
await Promise.all(Array.from({length: 8}, async () => {
  for (let file; (file = pending.shift());) {
    const response = await fetch(origin + file.path);
    assert.equal(response.status, 200, file.path);
    assert.equal(response.headers.get('x-jumvi-analytics'), 'disabled');
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, file.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256, file.path);
  }
}));
console.log(`V2 ${local.release}: ${local.files.length} live file hashes verified`);

async function readyForOffline(page, mission = 'm30') {
  await expect.poll(() => page.evaluate(async () =>
    (await navigator.serviceWorker.getRegistration('/v2/'))?.active?.scriptURL.endsWith('/v2/service-worker.js')
  ), {timeout: 60000}).toBe(true);
  await page.reload();
  await expect(page.locator('[data-start]')).toBeEnabled({timeout: 45000});
  await expect.poll(() => page.evaluate(() =>
    navigator.serviceWorker.controller?.scriptURL.endsWith('/v2/service-worker.js')
  )).toBe(true);
  await expect.poll(() => page.evaluate(async ({release, paths}) => {
    const cache = await caches.open(`jumvi-v2-${release}-content`);
    return (await Promise.all(paths.map(path => cache.match(path)))).every(Boolean);
  }, {release: local.release, paths: offline.missions[mission]}), {timeout: 45000}).toBe(true);
}

async function checkFallback(page, base) {
  for (const path of ['/v2/', '/v2/tr/']) {
    const response = await page.goto(base + path, {waitUntil: 'domcontentloaded'});
    assert.equal(response.status(), 200);
    assert.equal(response.fromServiceWorker(), true);
    await expect(page.locator('[data-start]')).toBeEnabled({timeout: 30000});
    await expect(page.locator('html')).toHaveAttribute('lang', path.includes('/tr/') ? 'tr' : 'en-US');
  }
}

for (const engine of [chromium, webkit]) {
  const browser = await engine.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    for (const tr of [true, false]) {
      await page.goto(origin + (tr ? '/v2/tr/' : '/v2/'));
      await expect(page.locator('[data-start]')).toBeEnabled({timeout: 45000});
      for (const id of ['m25', 'm07', 'm20', 'm30']) {
        await page.getByRole('button', {name: tr ? 'Başka uygun görev' : 'Find another suitable mission', exact: true}).click();
        await page.locator(`[data-mission-id=${id}] button`).click();
        await expect(page.locator('[data-start]')).toBeEnabled({timeout: 45000});
        await page.getByRole('button', {name: tr ? 'Açıklama / yardım' : 'How to play / help', exact: true}).click();
        await expect(page.locator('#first-step')).toBeVisible();
        await page.getByRole('button', {name: tr ? 'Göreve dön' : 'Back to the mission', exact: true}).first().click();
        await page.locator('[data-start]').click();
        await page.locator('.active-control').first().click();
        await expect(page.locator('[data-view=help]')).toBeVisible();
        await page.getByRole('button', {name: tr ? 'Tura dön' : 'Back to this round', exact: true}).first().click();
        await page.locator('.active-control').nth(1).click();
        await expect(page.locator('[data-view=stopped]')).toBeVisible();
        await page.getByRole('button', {name: tr ? 'Ayrıl' : 'Leave', exact: true}).click();
      }
    }
    await readyForOffline(page);
    console.log(`${engine.name()}: live TR/EN pilot flows and controlled/cached m30 PASS`);
    if (engine === chromium) {
      await context.setOffline(true);
      await checkFallback(page, origin);
      console.log('chromium: live-origin offline emulation TR/EN PASS');
    } else {
      // Playwright 1.63 WebKit rejects SW navigation under setOffline, even literal
      // Responses: https://github.com/microsoft/playwright/issues/42775
      // Preserve the gap explicitly; verify fallback against the byte-identical
      // deployed artifact with local origin sockets unavailable instead.
      console.log('webkit: live-origin setOffline NOT TESTED (Playwright #42775); separate origin-outage check follows');
      const replica = await serveCoexist(0);
      const replicaContext = await browser.newContext();
      try {
        const replicaPage = await replicaContext.newPage();
        await replicaPage.goto(replica.origin + '/v2/');
        await expect(replicaPage.locator('[data-start]')).toBeEnabled({timeout: 45000});
        await replicaPage.getByRole('button', {name: 'Find another suitable mission', exact: true}).click();
        await replicaPage.locator('[data-mission-id=m30] button').click();
        await expect(replicaPage.locator('[data-start]')).toBeEnabled({timeout: 45000});
        await readyForOffline(replicaPage);
        replica.state.offline = true;
        await assert.rejects(fetch(replica.origin + '/__qa.html'));
        await checkFallback(replicaPage, replica.origin);
        console.log('webkit: same verified artifact, LOCAL origin socket outage TR/EN PASS (not live-origin offline emulation)');
      } finally {
        await replicaContext.close();
        replica.server.closeAllConnections();
        await new Promise(resolve => replica.server.close(resolve));
      }
    }
    await context.close();
  } finally {
    await browser.close();
  }
}
console.log(`V2 exact artifact ${local.release}: live hashes + Chromium/WebKit online PASS; offline coverage and limitations recorded above`);
