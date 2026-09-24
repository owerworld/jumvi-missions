// Cloudflare routes include query strings. The trailing wildcard is narrowed here.
// An out-of-scope request is returned to the existing same-host Custom Domain Worker.
import review,{isV2Path} from './v2-review-worker.mjs';
export async function handle(request,env,originFetch=fetch){
 const u=new URL(request.url);if(u.hostname!=='qr.jumvi.co')return new Response('Review route only',{status:403});
 if(!isV2Path(u.pathname))return originFetch(request);
 return review.fetch(request,env);
}
export default {fetch(request,env){return handle(request,env);}};
