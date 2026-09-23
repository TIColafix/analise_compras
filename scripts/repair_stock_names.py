"""Repara somente descrições importadas; verifica invariância dos demais campos."""
import sys,json,shutil,datetime
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from import_erp import ROOT,parse_erp
batch=parse_erp(ROOT/'source-data/erp');target=ROOT/'dist/data.json';before=json.loads(target.read_text(encoding='utf8'));after=json.loads(target.read_text(encoding='utf8'));names={r['id']:r for r in batch['stocks']};changes=[]
for row in after['weekly']:
 if row['date']==batch['date'] and row.get('source')=='SALDO ALMOXARIFADOS 27.04.pdf' and row['id'] in names:
  source=names[row['id']]
  assert row['unit']==source['unit'] and row['stock']==source['stock'] and row['warehouse']==source['warehouse'] and row['warehouses']==source['warehouses']
  if row['name']!=source['name']:changes.append({'id':row['id'],'before':row['name'],'after':source['name']});row['name']=source['name']
# No other data or manual edits may change.
check=json.loads(json.dumps(after))
for a,b in zip(check['weekly'],before['weekly']):a['name']=b['name']
assert check==before
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S');shutil.copy2(target,ROOT/'source-data/backups'/('before-name-repair-'+stamp+'.json'))
tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(after,ensure_ascii=False,separators=(',',':')),encoding='utf8');tmp.replace(target)
(ROOT/'docs/correcao-descricoes.json').write_text(json.dumps(changes,ensure_ascii=False,indent=2),encoding='utf8')
print(f'{len(changes)} descrições corrigidas; códigos, unidades, saldos, almoxarifados e todos os demais dados intactos.')
