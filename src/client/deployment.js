// Derived from this immutable module URL, never from query/user input.
export const IS_V2 = new URL(import.meta.url).pathname.startsWith('/v2/releases/');
// The promoted document reuses the V2 code/data namespace at the root URL.
// Only the fixed, server-built shell opts in; stored player records never migrate.
export const BASE = IS_V2 && globalThis.document?.documentElement?.dataset.jumviHome !== 'true' ? '/v2/' : '/';
export const storageName = name => IS_V2 ? 'jumvi-v2:' + name : name;
export const releaseId = new URL(import.meta.url).pathname.split('/releases/')[1]?.split('/')[0];
