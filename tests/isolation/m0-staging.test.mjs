import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import staging from '../../src/m0-staging-worker.mjs';

const origin = 'https://jumvi-missions-staging.saykirtasiye.workers.dev';
function environment() {
  let calls = 0;
  const env = new Proxy({ ASSETS: { fetch: async () => {
    calls++;
    return new Response('synthetic public asset', { headers: { 'Content-Type': 'text/html' } });
  } } }, { get(target, key) {
    assert.equal(key, 'ASSETS', `Forbidden binding access: ${String(key)}`);
    return target[key];
  } });
  return { env, calls: () => calls };
}

test('beacon never reads payload, assets, secrets or analytics', async () => {
  const e = environment();
  const req = new Request(`${origin}/api/beacon`, { method: 'POST', body: 'synthetic' });
  req.json = () => { throw Error('Payload must not be read'); };
  const res = await staging.fetch(req, e.env);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('X-Jumvi-Analytics'), 'disabled');
  assert.equal(e.calls(), 0);
  assert.equal(req.bodyUsed, false);
});

test('production and preview aliases fail closed', async () => {
  const e = environment();
  for (const host of ['qr.jumvi.co', 'jumvi-missions.saykirtasiye.workers.dev', 'preview.example']) {
    assert.equal((await staging.fetch(new Request(`https://${host}/`), e.env)).status, 403);
  }
  assert.equal(e.calls(), 0);
});

test('ops and analytics reports are unavailable before asset access', async () => {
  const e = environment();
  for (const path of ['/panel', '/panel/?k=synthetic', '/analiz', '/data', '/data/snapshots/test.json', '/assets/panel/index.html', '/assets/analiz/index.html']) {
    assert.equal((await staging.fetch(new Request(origin + path), e.env)).status, 404, path);
  }
  assert.equal(e.calls(), 0);
});

test('public asset passes with staging-only headers', async () => {
  const e = environment();
  const res = await staging.fetch(new Request(origin + '/'), e.env);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'synthetic public asset');
  assert.equal(e.calls(), 1);
  assert.equal(res.headers.get('X-Jumvi-Environment'), 'm0-staging');
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
  assert.match(res.headers.get('Content-Security-Policy'), /connect-src 'self'/);
});

test('config contains no data, secret, service or route bindings', () => {
  const c = JSON.parse(readFileSync(new URL('../../wrangler.staging.json', import.meta.url)));
  assert.equal(c.name, 'jumvi-missions-staging');
  assert.equal(c.main, 'src/m0-staging-worker.mjs');
  assert.equal(c.workers_dev, true);
  assert.equal(c.preview_urls, false);
  assert.deepEqual(c.routes, []);
  assert.deepEqual(c.analytics_engine_datasets, []);
  assert.deepEqual(c.assets, { directory: 'dist', binding: 'ASSETS', run_worker_first: true, html_handling: 'none' });
  const allowed = new Set(['$schema', 'name', 'main', 'compatibility_date', 'workers_dev', 'preview_urls', 'routes', 'assets', 'analytics_engine_datasets', 'observability']);
  for (const key of Object.keys(c)) assert(allowed.has(key), key);
  assert.equal(c.observability.enabled, false);
});

test('packaged assets exclude operations, source and production reports', () => {
  const root = new URL('../../dist/', import.meta.url);
  assert(existsSync(new URL('index.html', root)));
  for (const path of ['data', 'assets/analiz', 'assets/panel', 'src', 'tools', '.github', 'wrangler.jsonc', 'wrangler.staging.json']) {
    assert.equal(existsSync(new URL(path, root)), false, path);
  }
});

test('EN/TR entry routes resolve explicit HTML files with no redirect loop', async () => {
 const c=JSON.parse(readFileSync('wrangler.staging.json'));
 assert.equal(c.assets.html_handling,'none');
 for(const [path,file] of [['/','/index.html'],['/index.html','/index.html'],['/tr','/tr/index.html'],['/tr/','/tr/index.html'],['/tr/index.html','/tr/index.html']]){
  const res=await staging.fetch(new Request(origin+path),{ASSETS:{fetch:async request=>{
   assert.equal(new URL(request.url).pathname,file);
   return new Response('synthetic locale document');
  }}});
  assert.equal(res.status,200);assert.equal(res.headers.get('Location'),null);
 }
});

test('authenticated and unsupported methods fail before asset access; immutable releases and SW headers are explicit',async()=>{const e=environment();for(const headers of [{Authorization:'Bearer synthetic'},{Cookie:'synthetic=1'}])assert.equal((await staging.fetch(new Request(origin+'/',{headers}),e.env)).status,403);assert.equal((await staging.fetch(new Request(origin+'/',{method:'POST'}),e.env)).status,405);assert.equal(e.calls(),0);const asset=await staging.fetch(new Request(origin+'/releases/0123456789abcdef/client/main.js'),e.env);assert.equal(asset.headers.get('cache-control'),'public, max-age=31536000, immutable');const sw=await staging.fetch(new Request(origin+'/service-worker.js'),e.env);assert.equal(sw.headers.get('cache-control'),'no-store');assert.equal(sw.headers.get('service-worker-allowed'),'/');assert.equal(sw.headers.get('x-content-type-options'),'nosniff');});
