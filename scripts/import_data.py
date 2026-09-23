"""Importa somente as fontes Excel do modelo; nunca altera os arquivos originais."""
import argparse,collections,datetime,hashlib,json,math
from pathlib import Path
import openpyxl
ROOT=Path(__file__).resolve().parents[1]
def import_data(source):
 existing=ROOT/'dist/data.json'
 if existing.exists() and (json.loads(existing.read_text(encoding='utf8')).get('parameterEdits') or len(json.loads(existing.read_text(encoding='utf8')).get('meta',{}).get('erpImports',[]))>1):
  raise ValueError('A base contém histórico diário. Use a área Importações; reconstruir pelos Excel apagaria os lotes posteriores.')
 issues=[]
 def issue(table,row,field,value,reason):issues.append(dict(table=table,row=row,field=field,value=str(value),reason=reason))
 def date(v,t,r,k):
  if v is None:return None
  if isinstance(v,(datetime.datetime,datetime.date)):d=v.date() if isinstance(v,datetime.datetime) else v
  else:
   d=None
   for f in ('%d/%m/%Y','%Y-%m-%d'):
    try:d=datetime.datetime.strptime(str(v).strip(),f).date();break
    except ValueError:pass
  if not d or not 2000<=d.year<=2100:issue(t,r,k,v,'Data inválida; registro não usado no cálculo por data');return None
  return d.isoformat()
 def num(v):
  if v is None or v=='':return None
  if isinstance(v,(int,float)) and math.isfinite(v):return v
  try:return float(str(v).replace('.','').replace(',','.'))
  except ValueError:return None
 def txt(v):return str(v).strip() if v is not None else ''
 data={};counts={};files=[]
 required={
 'AnaliseDiariaMRP':['Estoque Atual','Almox 1','Data de Análise','Cód. Item','Descrição','UM'],
 'MovimentacoesMRP':['Data Relatório','Item','Tipo','Referência','Data Fim','Quantidade'],
 'ParametrosMRP':['Item','Tempo Reposição','Tempo Segurança','Lote Mínimo','Lote Múltiplo','Consumo Médio','Estoque Segurança','UM'],
 'Monitoramento Mensal':['Codigo','Data do Relatório','Consumo médio'],
 'Monitoramento Semanal':['Codigo','Data do Relatório','Saldo Total','Saldo Almox 1'],
 'Fornecedor_Preferencial':['Codigo','Produto','Fornecedor preferencial'],
 'Movimentos':['Item','Descrição','Tipo Movimento','Data Requisição','Quantidade']}

 for filename in ['Monitoramento_mrp.xlsx','Consumos atualizado.xlsx']:
  path=source/filename;files.append(dict(name=filename,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
  w=openpyxl.load_workbook(path,read_only=True,data_only=True)
  for s in w:
   if s.title not in required:continue
   it=s.iter_rows(values_only=True);headers=[txt(h) for h in next(it)];records=[]
   missing=set(required[s.title])-set(headers)
   if missing:raise ValueError(f'{s.title}: colunas ausentes: {sorted(missing)}')
   for n,values in enumerate(it,2):
    if not any(v is not None for v in values):continue
    r={k:v for k,v in zip(headers,values) if k};r['_row']=n;records.append(r)
   data[s.title]=records;counts[s.title]=len(records)
  w.close()
 missing=set(required)-set(data)
 if missing:raise ValueError(f'Abas ausentes: {sorted(missing)}')
 def mapped(table,spec):
  out=[]
  for r in data[table]:
   o={'row':r['_row']}
   for key,(field,kind) in spec.items():o[key]=date(r.get(field),table,r['_row'],field) if kind=='d' else num(r.get(field)) if kind=='n' else txt(r.get(field))
   out.append(o)
  return out
 params=mapped('ParametrosMRP',{'id':('Item','s'),'lead':('Tempo Reposição','n'),'buffer':('Tempo Segurança','n'),'min':('Lote Mínimo','n'),'multiple':('Lote Múltiplo','n'),'monthly':('Consumo Médio','n'),'safety':('Estoque Segurança','n'),'unit':('UM','s')})
 daily=mapped('AnaliseDiariaMRP',{'id':('Cód. Item','s'),'name':('Descrição','s'),'date':('Data de Análise','d'),'stock':('Estoque Atual','n'),'warehouse':('Almox 1','n'),'unit':('UM','s'),'message':('Mensagem Usuário','s')})
 weekly=mapped('Monitoramento Semanal',{'id':('Codigo','s'),'name':('Produto','s'),'date':('Data do Relatório','d'),'stock':('Saldo Total','n'),'warehouse':('Saldo Almox 1','n'),'message':('Pedido/Observações','s')})
 monthly=mapped('Monitoramento Mensal',{'id':('Codigo','s'),'date':('Data do Relatório','d'),'monthly':('Consumo médio','n'),'safety':('Estoque segurança','n')})
 movements=mapped('MovimentacoesMRP',{'id':('Item','s'),'date':('Data Relatório','d'),'end':('Data Fim','d'),'type':('Tipo','s'),'ref':('Referência','s'),'qty':('Quantidade','n'),'projected':('Estoque Projetado','n')})
 suppliers=mapped('Fornecedor_Preferencial',{'id':('Codigo','s'),'name':('Produto','s'),'supplier':('Fornecedor preferencial','s')})
 catalog={r['id']:{'id':r['id'],'name':r['name'],'supplier':r['supplier']} for r in suppliers}
 for r in daily+weekly:
  catalog.setdefault(r['id'],{'id':r['id'],'name':r['name'],'supplier':''})
 for r in params:catalog.setdefault(r['id'],{'id':r['id'],'name':r['id'],'supplier':''}).update(unit=r['unit'])
 history=collections.defaultdict(float)
 for r in data['Movimentos']:
  id=txt(r.get('Item'));d=date(r.get('Data Requisição'),'Movimentos',r['_row'],'Data Requisição');q=num(r.get('Quantidade'))
  catalog.setdefault(id,{'id':id,'name':txt(r.get('Descrição')),'supplier':'','unit':''})
  if d and q is not None:history[(id,d[:7],txt(r.get('Tipo Movimento')))]+=q
 for table,rows in [('AnaliseDiariaMRP',daily),('Monitoramento Semanal',weekly)]:
  groups=collections.defaultdict(list)
  for r in rows:groups[(r['date'],r['id'])].append(r)
  for key,rs in groups.items():
   if len(rs)>1:issue(table,','.join(str(r['row']) for r in rs),'item/data',key,'Duplicidade: saldo único se idêntico; conflitos bloqueiam cálculo')
  for r in rows:
   u=catalog.get(r['id'],{}).get('unit')
   if r.get('unit') and u and u!=r['unit']:issue(table,r['row'],'UM',r['unit']+' / '+u,'Unidade divergente dos parâmetros; cálculo bloqueado')
 result=dict(meta=dict(files=files,counts=counts,imported=datetime.datetime.now().isoformat(timespec='seconds')),catalog=list(catalog.values()),params=params,daily=daily,weekly=weekly,monthly=monthly,movements=movements,history=[dict(id=k[0],month=k[1],type=k[2],qty=round(v,8)) for k,v in history.items()],issues=issues)
 target=ROOT/'dist/data.json';target.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'),allow_nan=False),encoding='utf8')
 (ROOT/'docs/qualidade-dados.json').write_text(json.dumps(issues,ensure_ascii=False,indent=2),encoding='utf8')
 if (source/'erp'/'Necessidades de compra do dia.csv').exists():
  from import_erp import import_erp
  import_erp(source/'erp')
 print(json.dumps(dict(counts=counts,issues=len(issues),bytes=target.stat().st_size,latestMRP=max(r['date'] for r in daily if r['date']),latestStock=max(r['date'] for r in weekly if r['date'])),ensure_ascii=False))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=ROOT/'source-data');import_data(p.parse_args().source)
