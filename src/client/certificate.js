import {button} from './components/button.js';

// A local rendering of explicit reports, not a verification of physical performance.
export function certificateText(locale,label){
 const tr=locale==='tr';
 // The customer certificate is English; only the surrounding review UI is localized.
 return {
  title:'LET’S CELEBRATE YOUR PLAY!',name:label,
  count:'Completion reported for 36 different missions',
  scope:'Based on local personal history in this browser.',
  honesty:'Physical skill and catch counts were not measured.',
  alt:`JUMVI play certificate for ${label}. Completion of 36 different missions was reported in this browser. Physical skill was not measured.`,
  preview:tr?'Sertifikayı önizle':'Preview certificate',download:tr?'PNG olarak kaydet':'Save as PNG',close:tr?'Kapat':'Close'
 };
}

export async function certificatePng(locale,label){
 const words=certificateText(locale,label),canvas=document.createElement('canvas');
 const background=new Image();background.src=new URL('../assets/certificate/celebrate-play-en-US-v2.png',import.meta.url).href;
 await background.decode();canvas.width=background.naturalWidth;canvas.height=background.naturalHeight;
 const c=canvas.getContext('2d');if(!c)throw new Error('canvas-unavailable');
 c.drawImage(background,0,0,canvas.width,canvas.height);
 // Preserve the supplied artwork. The centered name is its only variable content.
 c.textAlign='center';c.textBaseline='middle';c.fillStyle='#082b50';
 let nameSize=64;c.font=`bold ${nameSize}px Arial, sans-serif`;
 while(c.measureText(words.name).width>850&&nameSize>18){nameSize--;c.font=`bold ${nameSize}px Arial, sans-serif`;}
 c.fillText(words.name,712.5,589.5,850);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob||blob.size<1000)throw new Error('png-unavailable');
 return {blob,words,width:canvas.width,height:canvas.height};
}

export async function showCertificate(locale,label,{canShow=()=>true}={}){
 const {blob,words,width,height}=await certificatePng(locale,label);
 // Loading the optional artwork can outlast navigation or a history correction.
 if(!await canShow()||document.querySelector('dialog'))return;
 const url=URL.createObjectURL(blob);
 const d=document.createElement('dialog'),h=document.createElement('h2'),p=document.createElement('p'),img=document.createElement('img'),row=document.createElement('div');
 const previous=document.activeElement;
 h.id='certificate-title';h.textContent=words.preview;d.setAttribute('aria-labelledby',h.id);d.className='certificate-preview';
 p.textContent=words.honesty;img.src=url;img.alt=words.alt;img.width=width;img.height=height;row.className='controls';
 row.append(button(words.close,()=>d.close()),button(words.download,()=>{
  const a=document.createElement('a');a.href=url;a.download='jumvi-play-certificate.png';document.body.append(a);a.click();a.remove();
 },{kind:'primary'}));
 d.append(h,p,img,row);d.addEventListener('close',()=>{URL.revokeObjectURL(url);d.remove();if(previous?.isConnected)previous.focus();},{once:true});
 document.body.append(d);d.showModal();
}
