import {existsSync} from 'node:fs';
import {readLoads,saveLoad} from './cement-store.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const bundledPython=join(process.env.USERPROFILE||process.env.HOME||root,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const python=process.env.MRP_PYTHON||(existsSync(bundledPython)?bundledPython:'python');
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/engine.js':'engine.js','/data.json':'data.json','/favicon.svg':'favicon.svg','/imports.js':'imports.js','/cement.js':'cement.js'};
const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',svg:'image/svg+xml',json:'application/json; charset=utf-8'};
const pending=new Map();let busy=false;
const names=['Necessidades de compra do dia.csv','PERFIL ITENS 27.04.pdf','SALDO ALMOXARIFADOS 27.04.pdf'];
function run(mode,folder){return new Promise((resolve,reject)=>{const p=spawn(python,[join(root,'scripts/import_erp.py'),mode,folder],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c?reject(Error(err.trim()||'Falha na importação.')):resolve(out));});}
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>40*1024*1024)throw Error('Limite de 30 MB por lote excedido.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
const reply=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
createServer(async(req,res)=>{try{
 if(req.headers.host!=='127.0.0.1:4173'&&req.headers.host!=='localhost:4173')return reply(res,403,{error:'Endereço não autorizado.'});
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/health'&&req.method==='GET')return reply(res,200,{app:'colafix-compras-mrp',version:1});
 if(path==='/api/cement'&&req.method==='GET')return reply(res,200,await readLoads(root));
 if(path.startsWith('/api/')){
  if(req.method!=='POST')return reply(res,405,{error:'Método não permitido.'});
  if(!['http://127.0.0.1:4173','http://localhost:4173'].includes(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json'))return reply(res,403,{error:'Importação permitida apenas pela aplicação local.'});
  if(busy)return reply(res,409,{error:'Uma importação está em andamento. Aguarde.'});
  busy=true;try{const input=await body(req);
   if(path==='/api/health'&&req.method==='GET')return reply(res,200,{app:'colafix-compras-mrp',version:1});
 if(path==='/api/cement')return reply(res,200,{ok:true,load:await saveLoad(root,input)});
   if(path==='/api/parameters'){
    const target=join(root,'dist/data.json'),raw=await readFile(target,'utf8'),data=JSON.parse(raw);
    if(!data.catalog.some(r=>r.id===input.id)||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||![...data.daily,...data.weekly,...(data.reportProfiles||[])].some(r=>r.id===input.id&&r.date===input.date))throw Error('Item ou data inválidos.');
    const allowed=['monthly','safety','min','multiple','lead','buffer'],values=input.values;
    if(!values||typeof values!=='object'||!Object.keys(values).length||Object.entries(values).some(([k,v])=>!allowed.includes(k)||typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e12))throw Error('Informe números válidos e não negativos.');
    const edit={id:input.id,date:input.date,values,savedAt:new Date().toISOString(),knownDates:[...new Set((data.paramSnapshots||[]).map(r=>r.date))]};
    data.parameterEdits??=[];data.parameterEdits.push(edit);
    const backup=join(root,'source-data/backups');await mkdir(backup,{recursive:true});await writeFile(join(backup,'parameters-'+randomUUID()+'.json'),raw);
    const temp=target+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(data));await rename(temp,target);
    return reply(res,200,{ok:true,edit});
   }
   if(path==='/api/import/preview'){
    if(!Array.isArray(input.files)||input.files.length!==3)throw Error('Selecione os três arquivos.');
    const id=randomUUID(),folder=join(root,'source-data/imports',id);await mkdir(folder,{recursive:true});
    for(let n=0;n<3;n++){const f=input.files[n];if(typeof f.content!=='string'||!f.content.length)throw Error('Arquivo vazio.');const bytes=Buffer.from(f.content,'base64');if(n>0&&bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Perfil e saldos devem ser arquivos PDF.');await writeFile(join(folder,names[n]),bytes);}
    await writeFile(join(folder,'originais.json'),JSON.stringify(input.files.map(f=>({name:String(f.name)}))));
    const result=JSON.parse(await run('preview',folder));const data=JSON.parse(await readFile(join(root,'dist/data.json'),'utf8'));
    const same=data.meta.erpImports?.find(r=>r.date===result.date);result.duplicate=!!same&&result.files.every((f,i)=>same.files[i]?.sha256===f.sha256);result.conflict=!!same&&!result.duplicate;
    pending.set(id,{folder,result});return reply(res,200,{id,...result});
   }
   if(path==='/api/import/commit'){
    const entry=pending.get(input.id);if(!entry)throw Error('Confira os arquivos novamente antes de importar.');if(entry.result.conflict)throw Error('Já existe um lote diferente nesta data; histórico preservado.');
    if(!entry.result.duplicate)await run('commit',entry.folder);
    await writeFile(join(entry.folder,'resultado.json'),JSON.stringify({...entry.result,importedAt:new Date().toISOString()},null,2));pending.delete(input.id);
    return reply(res,200,{ok:true,duplicate:entry.result.duplicate,date:entry.result.date});
   }
   return reply(res,404,{error:'Rota não encontrada.'});
  }finally{busy=false;}
 }
 if(req.method!=='GET')return reply(res,405,{error:'Método não permitido.'});
 const file=files[path];if(!file)return reply(res,404,{error:'Não encontrado.'});const content=await readFile(join(root,'dist',file));res.writeHead(200,{'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-store'});res.end(content);
}catch(e){reply(res,400,{error:e.message});}}).listen(4173,'127.0.0.1',()=>console.log('Monitoramento MRP: http://127.0.0.1:4173'));
