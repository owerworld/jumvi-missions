import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),process.env.PROMOTION_EXACT_SHA);
const m=JSON.parse(readFileSync('artifacts/root-promotion/promotion-manifest.json'));assert.equal(m.sourceSHA,process.env.PROMOTION_EXACT_SHA);assert.equal(m.v2Release,process.env.ROOT_EXACT_ARTIFACT);
const c=JSON.parse(readFileSync('wrangler.root-promotion.json'));assert.equal(c.name,'jumvi-v2-legacy-compat');assert.equal(c.main,'src/root-promotion-worker.mjs');assert.deepEqual(c.routes,[{pattern:'https://qr.jumvi.co/*',zone_name:'jumvi.co'}]);assert.deepEqual(c.analytics_engine_datasets,[]);assert(!c.services&&!c.kv_namespaces&&!c.d1_databases);assert.equal(c.assets.directory,'artifacts/root-promotion');
const v2=JSON.parse(readFileSync('wrangler.v2.live.json'));assert.equal(v2.name,'jumvi-missions-v2-review');assert.deepEqual(v2.routes,[{pattern:'https://qr.jumvi.co/v2*',zone_name:'jumvi.co'}]);
console.log('Exact approved root/V1 mapping and isolated bindings verified');
