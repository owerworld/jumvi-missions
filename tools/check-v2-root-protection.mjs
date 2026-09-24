import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const old=JSON.parse(readFileSync('artifacts/v2-release/root-public-baseline.json'));
const compat=JSON.parse(readFileSync('artifacts/v2-legacy-compat/allowlist.json'));
for(const f of old.resources){const r=await fetch('https://qr.jumvi.co'+f.path);assert.equal(r.status,200);const h=createHash('sha256').update(Buffer.from(await r.arrayBuffer())).digest('hex');assert.equal(h,f.path.startsWith('/service-worker.js')?compat.afterSHA256:f.sha256,f.path);}
console.log('Legacy public bytes unchanged except explicit SW compatibility allowlist');
