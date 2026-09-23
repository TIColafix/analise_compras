"""Importação idempotente do lote ERP (CSV de necessidades + dois PDFs FOCCO)."""
import csv,datetime,hashlib,io,json,re,os,shutil
from pathlib import Path
from decimal import Decimal
from pypdf import PdfReader
ROOT=Path(os.environ.get('MRP_DATA_ROOT',Path(__file__).resolve().parents[1]))
FILES=['Necessidades de compra do dia.csv','PERFIL ITENS 27.04.pdf','SALDO ALMOXARIFADOS 27.04.pdf']
def number(s):return float(Decimal(s.replace('.','').replace(',','.')))
def date(s):return datetime.datetime.strptime(s[:10],'%d/%m/%Y').date().isoformat() if s else None
def parse_erp(folder):
 texts={name:[p.extract_text(extraction_mode='layout') for p in PdfReader(folder/name).pages] for name in FILES[1:]}
 reportdates={date(re.search(r'Data:\s*(\d{2}/\d{2}/\d{4})',text).group(1)) for pages in texts.values() for text in pages}
 if len(reportdates)!=1:raise ValueError('Os PDFs não têm a mesma data de relatório.')
 reportdate=reportdates.pop();items={};moves=[];current=None;last=None;unmatched=[]
 labels={'lead':'Tempo Reposição','buffer':'Tempo Segurança','safety':'Est. Segurança','min':'Lote Minímo','multiple':'Lote Múltiplo','monthly':'Consumo Médio','initial':'Estoque Inicial'}
 for pi,txt in enumerate(texts[FILES[1]],1):
  for line in txt.splitlines():
   m=re.match(r'\s*Item:\s+(\S+)\s+(.*?)\s+UM:\s+(\w+)',line)
   if m:
    id,name,unit=m.groups();current=items.setdefault(id,dict(id=id,name=name.strip(),unit=unit,pages=[],date=reportdate,source=FILES[1]));current['pages'].append(pi);last=None;continue
   if not current:continue
   for k,label in labels.items():
    m=re.search(re.escape(label)+r':\s*([\d.,]+)(?=\s|$)',line)
    if m:current[k]=number(m.group(1))
   m=re.match(r'\s*([A-Z]{2,3})\s+(?:(\S+)\s+)?(?:(\d{2}/\d{2}/\d{4})\s+)?(\d{2}/\d{2}/\d{4})\s+([\d.,-]+)(?:\(([+-])\))?\s+([\d.,-]+)(.*)',line)
   if m:
    typ,ref,start,end,q,sign,proj,msg=m.groups();amount=number(q);last=dict(id=current['id'],date=reportdate,type=typ,ref=ref or '',start=date(start),end=date(end),qty=amount,direction=sign,signedQty=amount*(-1 if sign=='-' else 1) if sign else None,projected=number(proj),message=msg.strip(),page=pi,row=f'p.{pi}',source=FILES[1]);moves.append(last)
   elif re.match(r'\s*[A-Z]{2,3}\s+.*\d{2}/\d{2}/\d{4}',line):unmatched.append([FILES[1],pi,line])
   elif re.match(r'^\s+\d+\s*$',line) and last:last['ref']+=line.strip()
 stocks={};current=None
 for pi,txt in enumerate(texts[FILES[2]],1):
  for line in txt.splitlines():
   m=re.match(r'^([A-Z]+\d+)\s+(.*?)\s+(KG|UN|SC|MT|PC)\s+(.+)$',line)
   if m:
    name_start=m.start(2);name_end=m.start(3);id,name,unit,rest=m.groups();values=re.findall(r'-?[\d.]+,\d+',rest)
    if id in stocks:raise ValueError('Item de saldo repetido: '+id)
    current=dict(id=id,name=name.strip(),unit=unit,date=reportdate,stock=number(values[-1]),warehouses=[],page=pi,row=f'p.{pi}',source=FILES[2],overlay='Total Geral:' in rest,nameLines=[name.strip()]);stocks[id]=current;continue
   if current and not current['warehouses'] and line[:name_start].strip()=='' and line[name_start:name_end].strip() and not line[name_end:].strip():
    continuation=line[name_start:name_end].strip();current['nameLines'].append(continuation);current['name']=' '.join(current['nameLines']);continue
   m=re.match(r'\s*Almoxarifado:\s+(\d+)\s+(.*?)\s+(-?[\d.]+,\d+)\s+(-?[\d.]+,\d+)\s*$',line)
   if m and current:
    code,name,ignored,balance=m.groups();current['warehouses'].append(dict(code=code,name=name.strip(),qty=number(balance),page=pi))
   elif re.match(r'^[A-Z]+\d+\s',line):unmatched.append([FILES[2],pi,line])
   elif re.match(r'\s*Almoxarifado:',line):unmatched.append([FILES[2],pi,line])
 for r in stocks.values():
  if not r['warehouses']:raise ValueError('Sem almoxarifados: '+r['id'])
  if len({w['code'] for w in r['warehouses']})!=len(r['warehouses']):raise ValueError('Almoxarifado duplicado: '+r['id'])
  total=round(sum(w['qty'] for w in r['warehouses']),4)
  if abs(total-r['stock'])>.0002:raise ValueError(f'Saldo não reconciliado: {r["id"]}: {r["stock"]} x {total}')
  r['warehouse']=next((w['qty'] for w in r['warehouses'] if w['code']=='1'),0)
  r['reconciled']=True
 for r in items.values():
  for k in labels:r.setdefault(k,None)
  # Campos ausentes ficam nulos para preservar ajustes manuais por campo.
 b=(folder/FILES[0]).read_bytes()
 try:csvtext=b.decode('utf-8-sig')
 except UnicodeDecodeError:csvtext=b.decode('cp1252')
 reader=csv.DictReader(io.StringIO(csvtext.replace('\r\r\n','\n')),delimiter=';');required={'Emp.','Dt. Compra','Cód. Item','Descrição','UM','Quantidade','Dt. Entrega','Ordem','Tipo','Mensagem'}
 if not required<=set(k.strip() for k in reader.fieldnames):raise ValueError('Cabeçalho CSV inesperado')
 requests=[]
 for n,raw in enumerate(reader,2):
  r={k.strip():(v or '').strip() for k,v in raw.items()};requests.append(dict(id=r['Cód. Item'],name=r['Descrição'],unit=r['UM'],date=reportdate,company=r['Emp.'],purchaseDate=date(r['Dt. Compra']),delivery=date(r['Dt. Entrega']),qty=number(r['Quantidade']),order=r['Ordem'],type=r['Tipo'],message=r['Mensagem'],row=n,source=FILES[0]))
 if not items or not stocks or unmatched:raise ValueError('Extração incompleta: '+str(unmatched))
 if len({(r['company'],r['order'],r['id']) for r in requests})!=len(requests):raise ValueError('Ordens duplicadas no CSV')
 for r in requests:
  if r['id'] not in items:raise ValueError('Item CSV sem perfil: '+r['id'])
  if r['unit']!=items[r['id']]['unit']:raise ValueError('Unidade CSV/perfil divergente: '+r['id'])
 return dict(date=reportdate,params=list(items.values()),movements=moves,stocks=list(stocks.values()),requests=requests,files=[dict(name=f,sha256=hashlib.sha256((folder/f).read_bytes()).hexdigest()) for f in FILES])
def import_erp(folder=ROOT/'source-data/erp'):
 batch=parse_erp(folder);target=ROOT/'dist/data.json';data=json.loads(target.read_text(encoding='utf8'));snapshot=batch['date'];signature=hashlib.sha256(json.dumps(batch['files'],sort_keys=True).encode()).hexdigest()
 if any(r.get('signature')==signature for r in data['meta'].get('erpImports',[])):print('Lote ERP já importado; nenhuma duplicação.');return
 if any(r['date']==snapshot for r in data['meta'].get('erpImports',[])):raise ValueError('Já existe outro lote nesta data. Para preservar o histórico, a substituição não é permitida.')
 backup=ROOT/'source-data/backups';backup.mkdir(parents=True,exist_ok=True);shutil.copy2(target,backup/('before-'+datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')+'.json'))
 audit=dict(date=snapshot,files=batch['files'],counts={k:len(batch[k]) for k in ['requests','params','stocks','movements']},notes=[],changes=[])
 def replace_rows(key,new,keyfn):
  keys={keyfn(r) for r in new};old=[r for r in data.get(key,[]) if keyfn(r) in keys];data[key]=[r for r in data.get(key,[]) if keyfn(r) not in keys]+new;audit['changes'].append(dict(table=key,replaced=len(old),imported=len(new)))
 olddaily={(r['date'],r['id']):r for r in data['daily']};stockmap={r['id']:r for r in batch['stocks']};catalog={r['id']:r for r in data['catalog']};known=set(catalog)
 for r in batch['params']+batch['stocks']:
  existing=catalog.setdefault(r['id'],dict(id=r['id'],name=r['name'],supplier='',unit=r['unit']));existing.setdefault('unit',r['unit'])
  if existing.get('unit') and existing['unit']!=r['unit']:raise ValueError('Unidade diverge do catálogo: '+r['id'])
  existing['unit']=r['unit']
 daily=[]
 for r in batch['requests']:
  old=olddaily.get((snapshot,r['id']),{});stock=stockmap.get(r['id']);row={**old,**{k:r[k] for k in ['id','name','unit','date','row','source']},'message':r['message'],'requestsSource':FILES[0]}
  if stock:row.update(stock=stock['stock'],warehouse=stock['warehouse'],balanceSource=FILES[2],warehouses=stock['warehouses'])
  else:
   row.update(stock=old.get('stock'),warehouse=old.get('warehouse'),balanceSource='Excel anterior da mesma data',balanceUnverified=True)
   audit['notes'].append(r['id']+': ausente no PDF de saldos. Saldo anterior preservado com aviso; recomendação bloqueada.')
  daily.append(row)
 replace_rows('daily',daily,lambda r:(r['date'],r['id']))
 # O perfil é completo para cada item incluído: substitui o snapshot, nunca acumula.
 profileids={r['id'] for r in batch['params']};oldmoves=[r for r in data['movements'] if r['date']==snapshot and r['id'] in profileids];data['movements']=[r for r in data['movements'] if not(r['date']==snapshot and r['id'] in profileids)]+batch['movements'];audit['changes'].append(dict(table='movements',replaced=len(oldmoves),imported=len(batch['movements'])))
 oldweekly={(r['date'],r['id']):r for r in data['weekly']}
 covered={r['id'] for r in batch['stocks']}
 for r in data['weekly']:
  if r['date']==snapshot and r['id'] not in covered:
   r['balanceUnverified']=True
   audit['notes'].append(r['id']+': posição semanal mantida do Excel, mas ausente no novo PDF; saldo não confirmado.')
 weekly=[{**oldweekly.get((snapshot,r['id']),{}),**r} for r in batch['stocks']];replace_rows('weekly',weekly,lambda r:(r['date'],r['id']))
 replace_rows('paramSnapshots',batch['params'],lambda r:(r['date'],r['id']))
 replace_rows('requests',batch['requests'],lambda r:(r['date'],r['company'],r['order'],r['id']))
 profiles=[]
 for p in batch['params']:
  s=stockmap.get(p['id']);profiles.append(dict(id=p['id'],date=snapshot,name=p['name'],unit=p['unit'],stock=s['stock'] if s else None,warehouse=s['warehouse'] if s else None,warehouses=s['warehouses'] if s else [],balanceUnverified=not bool(s),row='PDF p.'+','.join(map(str,p['pages'])),source=FILES[1],message='',fromProfile=True))
 replace_rows('reportProfiles',profiles,lambda r:(r['date'],r['id']))
 data['catalog']=list(catalog.values());audit['newItems']=sorted(set(catalog)-known);audit['notes'].append(f'CSV associado ao lote {snapshot} pela data dos PDFs; datas de compra e entrega mantidas separadamente.')
 audit['notes'].append('Estoque Inicial do Perfil não substitui Saldo Atual do relatório de almoxarifados: são conceitos e escopos diferentes.')
 audit['notes'].append(f'Parâmetros versionados em {snapshot}; histórico anterior preservado.')
 audit['notes'].append(f"{len(batch['stocks'])} saldos reconciliados com a soma dos almoxarifados.")
 data['meta'].setdefault('erpImports',[]).append(dict(signature=signature,date=snapshot,files=batch['files'],counts=audit['counts']));data['meta']['preferredDate']=max(r['date'] for r in data['meta']['erpImports'])
 data['meta']['files']=[r for r in data['meta']['files'] if r['name'] not in FILES]+batch['files']
 for note in audit['notes']:data['issues'].append(dict(table='Importação ERP',row='',field='Lote '+snapshot,value='',reason=note))
 tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf8');tmp.replace(target)
 (ROOT/f'docs/importacao-erp-{snapshot}.json').write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf8')
 (ROOT/'docs/qualidade-dados.json').write_text(json.dumps(data['issues'],ensure_ascii=False,indent=2),encoding='utf8')
 print(json.dumps(audit,ensure_ascii=False,indent=2))
if __name__=='__main__':
 import sys
 folder=Path(sys.argv[2]) if len(sys.argv)>2 else ROOT/'source-data/erp'
 try:
  if len(sys.argv)>1 and sys.argv[1]=='preview':
   b=parse_erp(folder);print(json.dumps(dict(date=b['date'],counts={k:len(b[k]) for k in ['requests','params','stocks','movements']},files=b['files']),ensure_ascii=False))
  else:import_erp(folder)
 except Exception as e:
  print(str(e),file=sys.stderr);sys.exit(1)

