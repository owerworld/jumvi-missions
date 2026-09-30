from pathlib import Path
import json, hashlib
from xml.sax.saxutils import escape
from reportlab import rl_config
from reportlab.pdfgen import canvas
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, letter
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
rl_config.invariant=1
root=Path(__file__).resolve().parent.parent
pdfmetrics.registerFont(TTFont('Jumvi',str(root/'assets/fonts/atkinson/AtkinsonHyperlegibleNext.ttf')))
ink=HexColor('#152D40');blue=HexColor('#075985');lime=HexColor('#B9EB39');pale=HexColor('#EFF7FC')
styles={name:ParagraphStyle(name,fontName='Jumvi',fontSize=size,leading=line,textColor=ink,spaceAfter=space) for name,size,line,space in [('title',24,29,12),('mission',19,23,10),('body',11.5,16,8),('label',11.5,16,5),('small',9,13,6)]}
styles['label'].textColor=blue
records=[json.loads((root/f'content/missions/m{i:02}.json').read_text()) for i in range(1,37)]
presentation=json.loads((root/'content/customer-presentation-v1.json').read_text())
manifest={'presentationSHA256':hashlib.sha256((root/'content/customer-presentation-v1.json').read_bytes()).hexdigest(),'authority':'Locked canonical mission records; not the legacy printed mechanics','missions':{m['id']:hashlib.sha256((root/f"content/missions/{m['id']}.json").read_bytes()).hexdigest() for m in records},'books':{}}
W,H=landscape(letter);usable=W-64;card_height=H-112
for locale in ['en-US','tr']:
 tr=locale=='tr';out=root/f'assets/parents/mission-book-{locale}-v1.pdf'
 def p(text,style='body'):return Paragraph(escape(str(text)),styles[style])
 def card(m,width):
  c={**m['locale'][locale],**presentation['missions'].get(m['id'],{}).get('customerCopy',{}).get(locale,{})};data=[p(f"{int(m['id'][1:]):02} · {c.get('title',c.get('mission'))}",'mission')]
  if c.get('setup'):data += [p('HAZIRLIK' if tr else 'SETUP','label'),p(c['setup'])]
  option=lambda v: (' veya ' if tr else ' or ').join(map(str,v)) if isinstance(v,list) else str(v)
  kit=f"{m['players']} {'oyuncu' if tr else 'players'} · {option(m['equipment']['paddles'])} {'paddle' if tr else 'paddles'} · {option(m['equipment']['balls'])} {'top' if tr else 'ball'}"
  data += [p(c.get('materials',kit),'small')]
  data += [p('ADIMLAR' if tr else 'STEPS','label')]
  for i,step in enumerate(c.get('steps',[c.get('toss',''),c.get('catch','')]),1):data.append(p(f'{i}. {step}'))
  data += [p('HEDEF' if tr else 'GOAL','label'),p(c['goal']),p('GÜVENLİK' if tr else 'SAFETY','label'),p(c.get('safety',c.get('safe')))]
  height=sum(x.wrap(width-32,10000)[1]+x.getSpaceAfter()+x.getSpaceBefore() for x in data)+32
  return data,height
 def page_footer(c,doc):
  c.setFillColor(ink);c.setFont('Jumvi',9);c.drawString(32,24,'JUMVI · V2 · qr.jumvi.co/v2/');c.drawRightString(W-32,24,f"{'Sayfa' if tr else 'Page'} {doc.page}")
  c.setStrokeColor(lime);c.setLineWidth(3);c.line(32,H-28,W-32,H-28)
 story=[Spacer(1,16),p('JUMVI Görev Kitabı' if tr else 'JUMVI Mission Book','title'),p('36 görev · V2 baskı sürümü' if tr else '36 missions · V2 print edition','mission'),p('Ebeveynler için yazdırılabilir oyun yönergeleri. Her görevin hazırlığını, adımlarını, hedefini ve güvenlik koşullarını birlikte okuyun.' if tr else 'Printable play instructions for grown-ups. Read each mission’s setup, steps, goal and safety guidance together.'),p('JUMVI paddle’ının sapı yoktur. El, arkadaki kayışla takılır. Yapışarak yakalama mavi ön yüzde yapılır; top boş elle ayrılır. Her görevin kendi el ve sıra adımlarını izleyin.' if tr else 'The JUMVI paddle has no handle. Your hand fits under the strap on the back. Sticky catches happen on the blue front; remove the ball with your free hand. Follow each mission’s hand and turn sequence.'),p('Oyuncu oluşturmak veya ilerleme kaydetmek zorunlu değildir. Uygulama fiziksel yakalamaları ya da beceriyi ölçmez.' if tr else 'Creating a player or saving progress is optional. The app does not measure physical catches or skill.'),p('Bu kitap V2’nin onaylı görev kurallarını kullanır. Eski kitapta geçen saplı paddle, eller üzerinde yengeç yürüyüşü veya farklı oyuncu/top sıraları bu sürümün kaynağı değildir.' if tr else 'This book uses the approved V2 mission rules. Older references to handles, weight-bearing crab walks or different player/ball sequences do not apply.'),PageBreak()]
 i=0
 while i<len(records):
  first=records[i];a,ah=card(first,(usable-16)/2)
  if ah>card_height:
   a,_=card(first,usable);row=[[a]];widths=[usable];i+=1
  elif i+1<len(records):
   b,bh=card(records[i+1],(usable-16)/2)
   if bh<=card_height:row=[[a,'',b]];widths=[(usable-16)/2,16,(usable-16)/2];i+=2
   else:row=[[a]];widths=[usable];i+=1
  else:row=[[a]];widths=[usable];i+=1
  table=Table(row,colWidths=widths,rowHeights=[card_height]);commands=[('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),16),('RIGHTPADDING',(0,0),(-1,-1),16),('TOPPADDING',(0,0),(-1,-1),16),('BOTTOMPADDING',(0,0),(-1,-1),16)]
  for col in ([0,2] if len(widths)==3 else [0]):commands += [('BACKGROUND',(col,0),(col,0),pale),('BOX',(col,0),(col,0),.7,HexColor('#536C7C'))]
  table.setStyle(TableStyle(commands));story += [table]
  if i<len(records):story += [PageBreak()]
 doc=SimpleDocTemplate(str(out),pagesize=(W,H),leftMargin=32,rightMargin=32,topMargin=44,bottomMargin=36,title='JUMVI V2 Mission Book' if not tr else 'JUMVI V2 Görev Kitabı',author='JUMVI')
 doc.build(story,onFirstPage=page_footer,onLaterPages=page_footer)
 manifest['books'][locale]={'path':str(out.relative_to(root)),'sha256':hashlib.sha256(out.read_bytes()).hexdigest(),'bytes':out.stat().st_size}
 print(locale,out.stat().st_size)
(root/'assets/parents/mission-book-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
