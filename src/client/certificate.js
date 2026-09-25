import {button} from './components/button.js';

// A local rendering of explicit reports, not a verification of physical performance.
export function certificateText(locale,label){
 const tr=locale==='tr';
 return tr?{
  title:'JUMVI OYUN KAYDI',name:label,
  count:'36 farklı görev için tamamlandı bildirimi',
  scope:'Bu cihazdaki yerel kişisel geçmişe dayanır.',
  honesty:'Fiziksel beceri veya yakalama sayısı ölçülmedi.',
  alt:`${label} için JUMVI oyun kaydı. 36 farklı görevin tamamlandığı bu cihazda bildirildi. Fiziksel beceri ölçülmedi.`,
  preview:'Sertifikayı önizle',download:'PNG olarak kaydet',close:'Kapat'
 }:{
  title:'JUMVI PLAY RECORD',name:label,
  count:'Completion reported for 36 different missions',
  scope:'Based on local personal history in this browser.',
  honesty:'Physical skill and catch counts were not measured.',
  alt:`JUMVI play record for ${label}. Completion of 36 different missions was reported in this browser. Physical skill was not measured.`,
  preview:'Preview certificate',download:'Save as PNG',close:'Close'
 };
}

export async function certificatePng(locale,label){
 const words=certificateText(locale,label),canvas=document.createElement('canvas');
 canvas.width=1200;canvas.height=850;
 const c=canvas.getContext('2d');if(!c)throw new Error('canvas-unavailable');
 c.fillStyle='#fffdf5';c.fillRect(0,0,1200,850);
 c.strokeStyle='#082b50';c.lineWidth=14;c.strokeRect(36,36,1128,778);
 c.fillStyle='#082b50';c.font='bold 86px Arial, sans-serif';c.fillText('JUMVI',95,170);
 c.fillStyle='#a8e741';c.beginPath();c.arc(426,114,13,0,Math.PI*2);c.fill();
 c.fillStyle='#082b50';c.font='bold 41px Arial, sans-serif';c.fillText(words.title,95,275);
 c.fillStyle='#0879b4';c.fillRect(95,311,1010,5);
 c.fillStyle='#082b50';c.font='bold 58px Arial, sans-serif';
 const name=words.name.length>30?`${words.name.slice(0,29)}…`:words.name;
 c.fillText(name,95,405,1010);
 c.font='34px Arial, sans-serif';c.fillText(words.count,95,505,1010);
 c.font='29px Arial, sans-serif';c.fillText(words.scope,95,590,1010);
 c.fillText(words.honesty,95,645,1010);
 c.fillStyle='#f07c25';c.beginPath();c.arc(1030,690,42,0,Math.PI*2);c.fill();
 c.strokeStyle='#1487c7';c.lineWidth=13;c.beginPath();c.arc(1030,690,42,-0.7,0.7);c.stroke();
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob||blob.size<1000)throw new Error('png-unavailable');
 return {blob,words};
}

export async function showCertificate(locale,label){
 const {blob,words}=await certificatePng(locale,label),url=URL.createObjectURL(blob);
 const d=document.createElement('dialog'),h=document.createElement('h2'),p=document.createElement('p'),img=document.createElement('img'),row=document.createElement('div');
 const previous=document.activeElement;
 h.id='certificate-title';h.textContent=words.preview;d.setAttribute('aria-labelledby',h.id);d.className='certificate-preview';
 p.textContent=words.honesty;img.src=url;img.alt=words.alt;img.width=1200;img.height=850;row.className='controls';
 row.append(button(words.close,()=>d.close()),button(words.download,()=>{
  const a=document.createElement('a');a.href=url;a.download=`jumvi-play-record-${locale}.png`;document.body.append(a);a.click();a.remove();
 },{kind:'primary'}));
 d.append(h,p,img,row);d.addEventListener('close',()=>{URL.revokeObjectURL(url);d.remove();if(previous?.isConnected)previous.focus();},{once:true});
 document.body.append(d);d.showModal();
}
