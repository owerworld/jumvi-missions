// Derived from this immutable module URL, never from query/user input.
export const BASE = new URL(import.meta.url).pathname.startsWith('/v2/releases/') ? '/v2/' : '/';
export const IS_V2 = BASE === '/v2/';
export const storageName = name => IS_V2 ? 'jumvi-v2:' + name : name;
export const releaseId = new URL(import.meta.url).pathname.split('/releases/')[1]?.split('/')[0];
