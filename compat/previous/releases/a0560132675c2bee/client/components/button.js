export function button(label, action, {kind='secondary', active=false, disabled=false}={}) {
 const b=document.createElement('button');b.type='button';b.className=`control ${kind}${active?' active-control':''}`;b.textContent=label;b.disabled=disabled;
 let pointer=null, cancelled=false;
 b.addEventListener('pointerdown',e=>{pointer={id:e.pointerId,x:e.clientX,y:e.clientY};cancelled=false;});
 b.addEventListener('pointermove',e=>{if(pointer && Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>8) cancelled=true;});
 b.addEventListener('pointercancel',()=>{cancelled=true;pointer=null;});
 b.addEventListener('keydown',e=>{if(e.repeat && ['Enter',' '].includes(e.key))e.preventDefault();});
 b.addEventListener('click',e=>{if(e.detail>1)return;if(cancelled && e.detail!==0){cancelled=false;pointer=null;return;}pointer=null;cancelled=false;action(e);});
 return b;
}
