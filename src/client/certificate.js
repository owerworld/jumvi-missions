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
 const background=new Image();background.src=new URL('../assets/certificate/legacy-stars-background-v1.webp',import.meta.url).href;
 await background.decode();canvas.width=background.naturalWidth;canvas.height=background.naturalHeight;
 const c=canvas.getContext('2d');if(!c)throw new Error('canvas-unavailable');
 c.drawImage(background,0,0,canvas.width,canvas.height);c.scale(canvas.width/1376,canvas.height/768);
 const tr=locale==='tr';c.textAlign='center';c.fillStyle='#082b50';
 c.font='bold 42px Arial, sans-serif';c.fillText(tr?'BİRLİKTE OYNADIK!':'WE PLAYED TOGETHER!',665,115,340);
 c.font='bold 38px Arial, sans-serif';c.fillText(words.title,688,235,990);
 c.font='26px Arial, sans-serif';c.fillText(words.count,688,285,1060);
 c.font='bold 23px Arial, sans-serif';c.fillText(tr?'36 farklı görev · Yerel oyun kaydı':'36 different missions · Local play record',365,361,515);
 c.fillStyle='#0879b4';let nameSize=58;c.font=`bold ${nameSize}px Arial, sans-serif`;
 while(c.measureText(words.name).width>925&&nameSize>28){nameSize--;c.font=`bold ${nameSize}px Arial, sans-serif`;}
 c.fillText(words.name,688,452,925);
 c.textAlign='left';c.fillStyle='#082b50';c.font='bold 22px Arial, sans-serif';
 c.fillText(tr?'Tamamlandı bildirimi':'Completion reported',70,575,250);
 c.font='20px Arial, sans-serif';c.fillText(tr?'36 / 36 farklı görev':'36 / 36 different missions',70,610,250);
 c.textAlign='center';c.font='23px Arial, sans-serif';c.fillText(words.scope,820,601,760);
 c.font='22px Arial, sans-serif';c.fillText(words.honesty,820,637,760);
 c.font='bold 24px Arial, sans-serif';c.fillText(tr?'JUMVI EKİBİ':'JUMVI TEAM',1165,702,260);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
 if(!blob||blob.size<1000)throw new Error('png-unavailable');
 return {blob,words};
}

export async function showCertificate(locale,label){
 const {blob,words}=await certificatePng(locale,label),url=URL.createObjectURL(blob);
 const d=document.createElement('dialog'),h=document.createElement('h2'),p=document.createElement('p'),img=document.createElement('img'),row=document.createElement('div');
 const previous=document.activeElement;
 h.id='certificate-title';h.textContent=words.preview;d.setAttribute('aria-labelledby',h.id);d.className='certificate-preview';
 p.textContent=words.honesty;img.src=url;img.alt=words.alt;img.width=1376;img.height=768;row.className='controls';
 row.append(button(words.close,()=>d.close()),button(words.download,()=>{
  const a=document.createElement('a');a.href=url;a.download=`jumvi-play-record-${locale}.png`;document.body.append(a);a.click();a.remove();
 },{kind:'primary'}));
 d.append(h,p,img,row);d.addEventListener('close',()=>{URL.revokeObjectURL(url);d.remove();if(previous?.isConnected)previous.focus();},{once:true});
 document.body.append(d);d.showModal();
}
