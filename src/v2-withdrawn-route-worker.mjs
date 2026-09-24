import withdrawn from './v2-withdrawn-worker.mjs';import {isV2Path} from './v2-review-worker.mjs';
export default {async fetch(request,env){const u=new URL(request.url);if(u.hostname!=='qr.jumvi.co')return new Response('Review route only',{status:403});return isV2Path(u.pathname)?withdrawn.fetch(request,env):fetch(request);}};
