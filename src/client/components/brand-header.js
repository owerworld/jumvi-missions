import {el} from './dom.js';

// The same approved wordmark and quiet header across play and local management.
export function brandHeader(locale, menu=null) {
 const header=el('header',undefined,'customer-header'),logo=el('img');
 logo.src=new URL('../../assets/mission-illustrations/m25/jumvi-logo.webp',import.meta.url);
 logo.alt='JUMVI';logo.width=192;logo.height=160;logo.className='brand';
 header.append(logo);
 if(menu){header.classList.add('has-profile-menu');header.append(menu);}else header.append(el('span',locale==='tr'?'OYNA · HAREKET ET':'PLAY · MOVE','customer-eyebrow'));
 return header;
}
