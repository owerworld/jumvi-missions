// Add the exact V2 bytes to the isolated staging asset bundle; no rebuild or root replacement.
import {cpSync,readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const m=JSON.parse(readFileSync('dist-v2/v2/release-manifest.json'));assert.equal(m.base,'/v2/');
cpSync('dist-v2/v2','dist/v2',{recursive:true});console.log('Staging V2 artifact '+m.release);
