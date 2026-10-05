import unittest,tempfile,sys,json,copy,contextlib,io
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import import_erp as imp
class ImportTests(unittest.TestCase):
 def test_multiline_stock_descriptions_and_balances(self):
  batch=imp.parse_erp(imp.ROOT/'source-data/erp');rows={r['id']:r for r in batch['stocks']}
  self.assertEqual(len(rows),107)
  self.assertEqual(rows['E00015']['name'],'SACARIA PAPEL ARGAMASSA MULTIPLO USO')
  self.assertEqual(rows['E00014']['name'],'SACARIA PLASTICO ARGAMASSA GRANDES FORMATOS')
  self.assertEqual(rows['NV0005']['name'],'CUNHA COLAFIX PACOTE 50 PECAS')
  self.assertEqual(rows['E00015']['stock'],37440)
  self.assertEqual(rows['E00015']['warehouse'],26629)
  self.assertEqual(rows['E00015']['unit'],'UN')
  for row in rows.values():self.assertAlmostEqual(row['stock'],sum(w['qty'] for w in row['warehouses']),places=3)
 def test_purchase_stock_uses_only_warehouse_1(self):
  batch=imp.parse_erp(imp.ROOT/'source-data/erp');rows={r['id']:r for r in batch['stocks']}
  for row in rows.values():
   almox1=next((w['qty'] for w in row['warehouses'] if w['code']=='1'),0)
   self.assertEqual(row['warehouse'],almox1)
  # O saldo total continua reconciliado para auditoria, mas planejamento/MRP
  # deve consumir somente o campo warehouse (Almoxarifado 1).
  sample=next((row for row in rows.values() if any(w['code']=='2' and w['qty'] for w in row['warehouses'])),None)
  self.assertIsNotNone(sample)
  self.assertNotEqual(sample['stock'],sample['warehouse'])

 def test_daily_history_and_conflict(self):
  original=imp.ROOT;parser=imp.parse_erp
  batch=parser(original/'source-data/erp')
  with tempfile.TemporaryDirectory() as tmp:
   imp.ROOT=Path(tmp);(imp.ROOT/'dist').mkdir();(imp.ROOT/'docs').mkdir()
   raw=(original/'dist/data.json').read_bytes();target=imp.ROOT/'dist/data.json';target.write_bytes(raw)
   try:
    new=copy.deepcopy(batch);new['date']='2026-09-21'
    for key in ['requests','stocks','params','movements']:
     for r in new[key]:r['date']=new['date']
    new['files'][0]['sha256']='test-new-day'
    imp.parse_erp=lambda _:new
    with contextlib.redirect_stdout(io.StringIO()):imp.import_erp(Path(tmp))
    after=target.read_bytes();data=json.loads(after);before=json.loads(raw)
    for key in ['daily','weekly','movements','paramSnapshots','requests','reportProfiles']:
     self.assertEqual([r for r in data[key] if r['date']!='2026-09-21'],before[key])
    self.assertEqual(data['meta']['preferredDate'],'2026-09-21')
    with contextlib.redirect_stdout(io.StringIO()):imp.import_erp(Path(tmp))
    self.assertEqual(target.read_bytes(),after)
    new['files'][0]['sha256']='different-same-day'
    with self.assertRaises(ValueError):imp.import_erp(Path(tmp))
    self.assertEqual(target.read_bytes(),after)
    self.assertEqual(len(list((imp.ROOT/'source-data/backups').glob('*.json'))),1)
   finally:imp.ROOT=original;imp.parse_erp=parser
if __name__=='__main__':unittest.main()
