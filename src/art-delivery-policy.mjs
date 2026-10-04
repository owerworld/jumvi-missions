// Deterrence, not authentication: referrer-free direct downloads remain possible.
// No visitor identifiers, cookie requirements, image tokens or offline expiry.
export function isProtectedImage(path){
 try {return /\/releases\/[a-f0-9]{16}\/assets\/.*\.(?:webp|png|jpe?g|gif|avif|svg)$/i.test(decodeURIComponent(path));}
 catch {return false;}
}
export function rejectImageEmbedding(request){
 const url=new URL(request.url);
 if(!isProtectedImage(url.pathname))return false;
 if(request.headers.get('Sec-Fetch-Site')==='cross-site')return true;
 const ref=request.headers.get('Referer');
 if(!ref)return false; // Privacy browsers, installed PWA and direct inspection.
 try {
  const source=new URL(ref);
  if(!['https:','http:'].includes(source.protocol))return true;
  return source.origin!==url.origin && !(['qr.jumvi.co','jumvi.co','www.jumvi.co'].includes(url.hostname)&&['qr.jumvi.co','jumvi.co','www.jumvi.co'].includes(source.hostname)&&source.protocol==='https:');
 }catch{return true;}
}
export function protectAssetResponse(response,path){
 response.headers.set('X-Content-Type-Options','nosniff');
 if(isProtectedImage(path))response.headers.set('Cross-Origin-Resource-Policy','same-site');
 if(path.endsWith('.html'))response.headers.set('Content-Security-Policy',"frame-ancestors 'self' https://jumvi.co https://www.jumvi.co");
 return response;
}
