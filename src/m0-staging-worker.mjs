// M0 isolation adapter only. The production Worker is imported unchanged.
import baseline from './worker.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== 'jumvi-missions-staging.saykirtasiye.workers.dev') {
      return new Response('Staging origin only', { status: 403 });
    }
    const headers = {
      'X-Jumvi-Environment': 'm0-staging',
      'X-Jumvi-Analytics': 'disabled',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
      'Cache-Control': 'no-store'
    };
    if (url.pathname === '/api/beacon') {
      return new Response(null, { status: 204, headers });
    }
    if (/^\/(?:panel|analiz|data)(?:\/|$)/.test(url.pathname) ||
        /^\/assets\/(?:panel|analiz)(?:\/|$)/.test(url.pathname)) {
      return new Response('Unavailable in M0 staging', { status: 404, headers });
    }
    // Explicit allowlist prevents forwarding any accidental secrets/datasets.
    const response = await baseline.fetch(request, { ASSETS: env.ASSETS });
    const result = new Response(response.body, response);
    for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
    result.headers.set('Content-Security-Policy', "connect-src 'self'; form-action 'self'");
    return result;
  }
};
