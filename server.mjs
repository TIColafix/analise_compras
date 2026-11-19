import {existsSync} from 'node:fs';
import {readLoads,saveLoad,readDiesel,saveDiesel,readDeliveryDeadlines,saveDeliveryDeadline} from './cement-store.mjs';
import {readMaintenance,saveMaintenance} from './maintenance-store.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {tmpdir} from 'node:os';
import {unlink,stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('.',import.meta.url));
const bundledPython=join(process.env.USERPROFILE||process.env.HOME||root,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const python=process.env.MRP_PYTHON||(existsSync(bundledPython)?bundledPython:'python');
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/engine.js':'engine.js','/data.json':'data.json','/favicon.svg':'favicon.svg','/imports.js':'imports.js','/cement.js':'cement.js','/diesel.js':'diesel.js','/deadlines.js':'deadlines.js','/maintenance.js':'maintenance.js','/mpquotes.js':'mpquotes.js','/reports.js':'reports.js'};
const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',svg:'image/svg+xml',json:'application/json; charset=utf-8'};
const pending=new Map();let busy=false;
const names=['Necessidades de compra do dia.csv','PERFIL ITENS 27.04.pdf','SALDO ALMOXARIFADOS 27.04.pdf'];
function runPurchasePdf(file){return new Promise((resolve,reject)=>{const p=spawn(python,[join(root,'scripts/import_purchase_order.py'),file],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c?reject(Error(err.trim()||(()=>{try{return JSON.parse(out).error}catch{return 'Falha ao ler pedido PDF.'}})())):resolve(out));});}
function run(mode,folder){return new Promise((resolve,reject)=>{const p=spawn(python,[join(root,'scripts/import_erp.py'),mode,folder],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c?reject(Error(err.trim()||'Falha na importação.')):resolve(out));});}
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>40*1024*1024)throw Error('Limite de 30 MB por lote excedido.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
const reply=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};

const backupEqual=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y);};
async function exportSql(req,res){
 const user=process.env.BACKUP_ADMIN_USER,pass=process.env.BACKUP_ADMIN_PASSWORD,db=process.env.DATABASE_URL;
 if(!user||!pass||!db)return reply(res,503,{error:'Backup indisponível: configure BACKUP_ADMIN_USER, BACKUP_ADMIN_PASSWORD e DATABASE_URL.'});
 let provided='';
 try{const header=String(req.headers.authorization||'');if(header.startsWith('Basic '))provided=Buffer.from(header.slice(6),'base64').toString('utf8');}catch{}
 const sep=provided.indexOf(':');
 if(sep<0||!backupEqual(provided.slice(0,sep),user)||!backupEqual(provided.slice(sep+1),pass)){
  res.writeHead(401,{'WWW-Authenticate':'Basic realm="Backup Colafix"','Cache-Control':'no-store','Content-Type':'application/json'});
  return res.end(JSON.stringify({error:'Acesso restrito ao administrador de backup.'}));
 }
 const target=join(tmpdir(),'colafix-'+randomUUID()+'.sql');
 try{
  await new Promise((resolve,reject)=>{
   const child=spawn('pg_dump',['--dbname='+db,'--format=plain','--no-owner','--no-acl','--encoding=UTF8','--file='+target],{env:process.env,stdio:['ignore','ignore','pipe']});
   let error='',done=false;
   const timer=setTimeout(()=>{child.kill('SIGKILL');},120000);
   child.stderr.on('data',d=>{error=(error+d.toString()).slice(-2000);});
   child.on('error',e=>{if(!done){done=true;clearTimeout(timer);reject(e);}});
   child.on('close',code=>{if(!done){done=true;clearTimeout(timer);code===0?resolve():reject(Error('pg_dump falhou. Consulte os logs privados.'));}});
  });
  const info=await stat(target);if(!info.size)throw Error('O arquivo de backup está vazio.');
  res.writeHead(200,{'Content-Type':'application/sql','Content-Disposition':'attachment; filename="colafix_backup_completo.sql"','Content-Length':info.size,'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'});
  const {createReadStream}=await import('node:fs');
  await new Promise((resolve,reject)=>{const stream=createReadStream(target);stream.on('error',reject);res.on('close',resolve);stream.on('end',resolve);stream.pipe(res);});
 }catch(e){if(!res.headersSent)reply(res,500,{error:e.code==='ENOENT'?'pg_dump não está instalado no servidor.':'Não foi possível gerar o backup. Verifique os logs do servidor.'});}
 finally{await unlink(target).catch(()=>{});}
}

createServer(async(req,res)=>{try{
 const origin=req.headers.origin||'';
 const allowedOrigin='https://ticolafix.github.io';
 if(origin===allowedOrigin){
  res.setHeader('Access-Control-Allow-Origin',allowedOrigin);
  res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
 }
 const backupPath=new URL(req.url,'http://localhost').pathname;
 if(backupPath==='/api/admin/backup-sql'){
  if(origin&&origin!==allowedOrigin)return reply(res,403,{error:'Origem não autorizada.'});
  if(req.method==='OPTIONS'){res.writeHead(204);return res.end();}
  if(req.method==='GET')return await exportSql(req,res);
  return reply(res,405,{error:'Método não permitido.'});
 }
 if(req.headers.host!=='127.0.0.1:4173'&&req.headers.host!=='localhost:4173')return reply(res,403,{error:'Endereço não autorizado.'});
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/api/health'&&req.method==='GET')return reply(res,200,{app:'colafix-compras-mrp',version:1});
 if(path==='/api/external-summary'&&req.method==='GET'){
  const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
  let dollar=null,weather=[];
  try{
   const j=await get('https://economia.awesomeapi.com.br/json/last/USD-BRL');
   const x=j.USDBRL;if(x)dollar={value:Number(x.bid),high:Number(x.high),low:Number(x.low),updated:x.create_date||''};
  }catch{}
  try{
   const j=await get('https://api.open-meteo.com/v1/forecast?latitude=-29.9514&longitude=-51.0939&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo&forecast_days=7');
   weather=(j.daily?.time||[]).map((date,i)=>({date,code:j.daily.weather_code[i],max:j.daily.temperature_2m_max[i],min:j.daily.temperature_2m_min[i],rain:j.daily.precipitation_probability_max[i]}));
  }catch{}
  return reply(res,200,{dollar,weather,updatedAt:new Date().toISOString()});
 }
 if(path==='/api/cement'&&req.method==='GET')return reply(res,200,await readLoads(root));
 if(path==='/api/diesel'&&req.method==='GET')return reply(res,200,await readDiesel(root));
 if(path==='/api/deadlines'&&req.method==='GET')return reply(res,200,await readDeliveryDeadlines(root));
 if(path==='/api/maintenance'&&req.method==='GET')return reply(res,200,await readMaintenance(root));
 if(path.startsWith('/api/')){
  if(req.method!=='POST')return reply(res,405,{error:'Método não permitido.'});
  if(!['http://127.0.0.1:4173','http://localhost:4173'].includes(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json'))return reply(res,403,{error:'Importação permitida apenas pela aplicação local.'});
  if(busy)return reply(res,409,{error:'Uma importação está em andamento. Aguarde.'});
  busy=true;try{const input=await body(req);
   if(path==='/api/health'&&req.method==='GET')return reply(res,200,{app:'colafix-compras-mrp',version:1});
 if(path==='/api/cement')return reply(res,200,{ok:true,load:await saveLoad(root,input)});if(path==='/api/cement-monthly-order')return reply(res,200,{ok:true,orders:await saveMonthlyOrder(root,input)});
   if(path==='/api/diesel')return reply(res,200,{ok:true,load:await saveDiesel(root,input)});
   if(path==='/api/deadlines')return reply(res,200,{ok:true,order:await saveDeliveryDeadline(root,input)});
   if(path==='/api/maintenance')return reply(res,200,{ok:true,request:await saveMaintenance(root,input)});
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
   if(path==='/api/deadlines/import-pdf'){
    const f=input.file;if(!f||typeof f.content!=='string'||!f.content.length)throw Error('Selecione o PDF do pedido.');
    const bytes=Buffer.from(f.content,'base64');if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('O arquivo deve ser um PDF.');
    const folder=join(root,'source-data/imports/purchase-orders');await mkdir(folder,{recursive:true});
    const target=join(folder,randomUUID()+'.pdf');await writeFile(target,bytes);
    const parsed=JSON.parse(await runPurchasePdf(target));return reply(res,200,{ok:true,...parsed});
   }
   if(path==='/api/import/preview'){
    if(!Array.isArray(input.files)||input.files.length!==3)throw Error('Selecione os três arquivos.');
    const id=randomUUID(),folder=join(root,'source-data/imports',id);await mkdir(folder,{recursive:true});
    for(let n=0;n<3;n++){const f=input.files[n];if(typeof f.content!=='string'||!f.content.length)throw Error('Arquivo vazio.');const bytes=Buffer.from(f.content,'base64');if(n>0&&bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Perfil e saldos devem ser arquivos PDF.');await writeFile(join(folder,names[n]),bytes);}
    await writeFile(join(folder,'originais.json'),JSON.stringify(input.files.map(f=>({name:String(f.name)}))));
    const result=JSON.parse(await run('preview',folder));let data={meta:{erpImports:[]}};try{data=JSON.parse(await readFile(join(root,'dist/data.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    const same=data.meta?.erpImports?.find(r=>r.date===result.date);result.duplicate=!!same&&result.files.every((f,i)=>same.files[i]?.sha256===f.sha256);result.conflict=!!same&&!result.duplicate;
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
}catch(e){reply(res,400,{error:e.message});}}).listen(Number(process.env.PORT)||4173,process.env.PORT?'0.0.0.0':'127.0.0.1',()=>console.log('Monitoramento MRP iniciado'));
