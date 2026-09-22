// Package tracked public baseline assets; never include analytics reports or ops panels.
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, rmSync, lstatSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const target = resolve(root, '.wrangler/m0-staging/assets');
const allowed = new Set(['.html', '.js', '.css', '.json', '.webmanifest', '.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif', '.ico', '.avif', '.mp3', '.wav', '.ogg', '.m4a', '.mp4', '.webm', '.woff', '.woff2', '.ttf', '.pdf', '.txt', '.glb', '.gltf', '.bin']);
const excluded = /^(?:\.|src\/|tools\/|docs\/|data\/|prototypes\/|assets\/(?:analiz|panel)\/|wrangler(?:\.|$))/;
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
let count = 0;
for (const name of files) {
  if (excluded.test(name) || !allowed.has(extname(name)) || !lstatSync(resolve(root, name)).isFile()) continue;
  const dest = resolve(target, name);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(resolve(root, name), dest);
  count++;
}
console.log(`M0 staging assets: ${count}; analytics reports, ops panels, source/config and secrets excluded.`);
