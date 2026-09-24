// Staging isolation adapter. Never imports production code or resources.
import review,{isV2Path} from "./v2-review-worker.mjs";


export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.hostname !== 'jumvi-missions-staging.saykirtasiye.workers.dev') {
      return new Response('Staging origin only', { status: 403 });
    }
    if(isV2Path(url.pathname))return review.fetch(request,env);
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
    if (request.headers.has('Authorization') || request.headers.has('Cookie')) return new Response('No authenticated app responses', {status:403,headers});
    if (!['GET','HEAD'].includes(request.method)) return new Response('Method not allowed',{status:405,headers});
    if (/^\/(?:api|src|tools|compat)(?:\/|$)/.test(url.pathname)) return new Response('Unavailable',{status:404,headers});
    // Explicit allowlist prevents forwarding any accidental secrets/datasets.
    const path = url.pathname === '/' ? '/index.html' : (['/tr','/tr/'].includes(url.pathname) ? '/tr/index.html' : url.pathname);
    const response = await env.ASSETS.fetch(path === url.pathname ? request : new Request(new URL(path, url), request));
    const result = new Response(response.body, response);
    for (const [key, value] of Object.entries(headers)) result.headers.set(key, value);
    result.headers.set('X-Content-Type-Options','nosniff');
    if (/^\/releases\/[a-f0-9]{16}\//.test(path)&&response.status===200) result.headers.set('Cache-Control','public, max-age=31536000, immutable');
    if (path==='/service-worker.js') result.headers.set('Service-Worker-Allowed','/');
    result.headers.set('Content-Security-Policy', "connect-src 'self'; form-action 'self'");
    return result;
  }
};
