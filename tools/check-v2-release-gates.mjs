import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {execFileSync} from 'node:child_process';
const g=JSON.parse(readFileSync('artifacts/v2-release/gates.json'));
assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),process.env.V2_EXACT_SHA);
for(const k of ['R5_realDeviceCriticalJourney','v2EnvironmentCredentialRoutePermissions','preReleaseCoexistenceExactArtifact'])assert.equal(g[k],'VERIFIED',`Open release gate: ${k}`);
assert.equal(g.liveEdgeCoexistenceAfterPublish,'PENDING','Live edge evidence must be recorded only after publication');
const m=JSON.parse(readFileSync('dist-v2/v2/release-manifest.json'));assert.equal(m.release,process.env.V2_EXACT_ARTIFACT);
const c=JSON.parse(readFileSync('wrangler.v2.live.json'));assert.equal(c.name,'jumvi-missions-v2-review');assert.deepEqual(c.routes,[{pattern:'https://qr.jumvi.co/v2*',zone_name:'jumvi.co'}]);assert.deepEqual(c.analytics_engine_datasets,[]);assert.equal(c.workers_dev,false);
