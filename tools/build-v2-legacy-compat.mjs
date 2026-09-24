// Separate candidate artifact; never edits root application source or main.
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const baseline='03f70223f59d020a5c6ddc3b226c8ccb54218eb7';
const before=readFileSync('compat/v254/service-worker.js','utf8');
if(createHash('sha256').update(before).digest('hex')!=='bbe8854c6eb6d8750a5ad1cccd67e87ad3f09e718f45ac54adc620f715793e9c')throw Error('Archived production SW baseline changed');
let after=before.replace('const CACHE_NAME = "jumvi-missions-v254";', 'const CACHE_NAME = "jumvi-missions-v254-v2compat1";');
after=after.replace('keys.filter((k) => k !== CACHE_NAME)', 'keys.filter((k) => /^jumvi-missions-v[0-9]+(?:-v2compat[0-9]+)?$/.test(k) && k !== CACHE_NAME)');
after=after.replace('if (url.origin !== self.location.origin) return;', 'if (url.origin !== self.location.origin) return;\n  // V2 has its own scope/cache; never intercept its navigation or assets.\n  if (url.pathname === "/v2" || url.pathname.startsWith("/v2/")) return;');
if(after===before||!after.includes('v2compat1')||!after.includes('startsWith("/v2/")'))throw Error('Baseline compatibility patch failed');
mkdirSync('artifacts/v2-legacy-compat',{recursive:true});
writeFileSync('artifacts/v2-legacy-compat/service-worker.js',after);
const sha=x=>createHash('sha256').update(x).digest('hex');
writeFileSync('artifacts/v2-legacy-compat/allowlist.json',JSON.stringify({baseline,allowedLegacyFiles:['service-worker.js'],beforeSHA256:sha(before),afterSHA256:sha(after),status:'CANDIDATE — NOT DEPLOYED',scope:'SW own-cache cleanup and /v2 bypass only; preserve every CORE_ASSETS entry; no UI/content/data migration'},null,2));
