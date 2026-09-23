import {button} from './button.js';
export function dialog({title,body,cancelLabel,confirmLabel,onConfirm}) {
 const d=document.createElement('dialog'),h=document.createElement('h2'),p=document.createElement('p'),row=document.createElement('div');
 h.id='dialog-title';h.textContent=title;p.textContent=body;d.setAttribute('aria-labelledby',h.id);row.className='controls';
 let done=false;const previous=document.activeElement;
 row.append(button(cancelLabel,()=>d.close()),button(confirmLabel,()=>{if(!done){done=true;onConfirm();d.close();}}));d.append(h,p,row);
 d.addEventListener('close',()=>{d.remove();if(previous?.isConnected)previous.focus();},{once:true});document.body.append(d);d.showModal();return d;
}
