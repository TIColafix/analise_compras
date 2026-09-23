"""Empacota código e dados locais para continuar em outro PC, sem publicar."""
from pathlib import Path
import datetime,hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT.parent/'transferencias';OUT.mkdir(exist_ok=True)
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
archive=OUT/f'Compras-MRP-{stamp}.zip'
paths=[p for p in ROOT.rglob('*') if p.is_file() and p.name!='PACOTE.json' and not any(x in {'.git','__pycache__','node_modules','.venv'} for x in p.relative_to(ROOT).parts) and p.suffix not in {'.log','.tmp','.pyc'}]
manifest={'createdAt':datetime.datetime.now().astimezone().isoformat(),'mode':'Cópia para alternar entre PCs; sem sincronização automática','files':[]}
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in sorted(paths):
  content=p.read_bytes();name=p.relative_to(ROOT).as_posix();manifest['files'].append({'path':name,'bytes':len(content),'sha256':hashlib.sha256(content).hexdigest()});z.writestr('mrp-app/'+name,content)
 z.writestr('mrp-app/PACOTE.json',json.dumps(manifest,ensure_ascii=False,indent=2))
with zipfile.ZipFile(archive) as z:
 assert z.testzip() is None
 for entry in manifest['files']:assert hashlib.sha256(z.read('mrp-app/'+entry['path'])).hexdigest()==entry['sha256']
print(str(archive));print(f"{len(paths)} arquivos verificados; {archive.stat().st_size/1024/1024:.1f} MB")
