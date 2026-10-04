const $=id=>document.getElementById(id),fmt=n=>Number(n||0).toLocaleString('tr-TR');
let data=null,catalog={},generation=0;
async function getJSON(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),8000);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal});if(!r.ok)throw Error('unavailable');return await r.json();}finally{clearTimeout(timer);}}
const el=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node;};
async function load(){
 const gen=++generation;for(const id of ['export-csv','export-json'])$(id).hidden=true;$('refresh').disabled=true;$('results').setAttribute('aria-busy','true');$('error').hidden=true;
 try{const result=await getJSON('/api/summary?'+new URLSearchParams({days:$('days').value,locale:$('locale').value}));if(gen!==generation)return;data=result;render();}
 catch{if(gen!==generation)return;$('error').textContent='Veriler alınamadı. Oturumunu ve bağlantını kontrol edip Yenile’ye basabilirsin. Önceki sayılar güncel olmayabilir.';$('error').hidden=false;}
 finally{if(gen===generation){$('refresh').disabled=false;$('results').setAttribute('aria-busy','false');}}
}
function render(){
 for(const format of ['csv','json']){const link=$('export-'+format);link.href='/api/report?'+new URLSearchParams({days:data.days,locale:data.locale,format});link.hidden=false;}
 $('mode').textContent=data.mode==='demo'?'ÖRNEK VERİ · Bu önizlemedeki sayılar sentetiktir. Gerçek müşteri verisi toplanmıyor.':data.mode==='live'?'ABD · Yalnız günlük kullanım toplamları. Kişisel müşteri listesi tutulmaz.':'VERİ TOPLAMA KAPALI · Panel hazır; gerçek ölçüm henüz etkin değil.';
 $('range').textContent=`${data.start} — ${data.end} · Gün sınırı UTC · ${data.locale==='all'?'Tüm arayüz dilleri':data.locale}`;
 $('actions').textContent=`Yardım açılışı: ${fmt(data.totals.help_open)} · Durdurma: ${fmt(data.totals.round_stop)} · Devam etme: ${fmt(data.totals.round_resume)}`;
 const definitions=[['app_open','Site açılışı','Yeniden açma ve yenilemeler dahil'],['mission_open','Görev açılışı','Bir görevin giriş ekranının açılması'],['round_start','Başlatılan tur','Fiziksel oyunun yapıldığını kanıtlamaz'],['completion_reported','“Tamamladım” bildirimi','Kullanıcının kendi bildirimi']];
 $('cards').replaceChildren(...definitions.map(([key,label,note])=>{const card=el('article',undefined,'card');card.append(el('small',label),el('b',fmt(data.totals[key])),el('p',note));return card;}));
 const max=Math.max(1,...Object.values(data.daily));$('chart').setAttribute('role','img');$('chart').setAttribute('aria-label','Günlük site açılışları. Tam sayılar aşağıdaki tabloda.');
 $('chart').replaceChildren(...Object.entries(data.daily).map(([day,count])=>{const b=el('div',undefined,'bar');b.style.height=`${count===0?0:Math.max(2,count/max*100)}%`;b.title=`${day}: ${fmt(count)}`;return b;}));
 $('daily').replaceChildren(...Object.entries(data.daily).map(([day,count])=>{const tr=el('tr');tr.append(el('td',day),el('td',fmt(count)));return tr;}));renderMissions();
}
function renderMissions(){if(!data)return;const sort=$('sort').value,rows=Object.entries(catalog).map(([id,title])=>({id,title,counts:data.missions[id]||{}})).sort((a,b)=>(b.counts[sort]||0)-(a.counts[sort]||0)||a.id.localeCompare(b.id));
 $('empty').hidden=Object.keys(data.missions).length!==0;
 $('missions').replaceChildren(...rows.map(({id,title,counts},index)=>{const tr=el('tr'),name=el('td');name.append(el('span',title,'mission-title'),el('span',`${id.toUpperCase()} · ${index+1}. sırada`,'mission-id'));tr.append(name,...['mission_open','round_start','help_open','completion_reported'].map(e=>el('td',fmt(counts[e]))));return tr;}));
}
for(const id of ['days','locale'])$(id).addEventListener('change',load);$('refresh').addEventListener('click',load);$('sort').addEventListener('change',renderMissions);
try{catalog=await getJSON('/missions.json');await load();}catch{$('error').textContent='Görev listesi yüklenemedi. Sayfayı yenileyebilirsin.';$('error').hidden=false;$('results').setAttribute('aria-busy','false');}
