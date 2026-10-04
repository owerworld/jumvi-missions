import {handle} from './root-promotion-worker.mjs';
export default {fetch:(r,e)=>handle(r,e,async req=>{
 const p=new URL(req.url).pathname;
 if(p==='/api/beacon')return new Response(null,{status:204});
 if(/^\/(?:api|panel|analiz|data|src|tools|compat)(?:\/|$)/.test(p)||req.headers.has('Authorization')||!['GET','HEAD'].includes(req.method))return new Response('Unavailable in staging',{status:404});
 return e.ASSETS.fetch(new Request(req.url,{method:req.method}));
},{staging:true})};
