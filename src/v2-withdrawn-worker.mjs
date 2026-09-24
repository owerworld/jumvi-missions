// Prebuilt rollback candidate: preserve installed SW and versioned assets; withdraw entry only.
import review,{isV2Path} from './v2-review-worker.mjs';
export default {async fetch(request,env){const u=new URL(request.url);if(!isV2Path(u.pathname))return review.fetch(request,env);
if(u.pathname.startsWith('/v2/releases/')||u.pathname==='/v2/service-worker.js')return review.fetch(request,env);
return new Response('JUMVI review is temporarily unavailable. The existing JUMVI site remains available at /. Local review records have not been deleted.',{status:410,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','Vary':'*','X-Robots-Tag':'noindex, nofollow, noarchive'}});}};
