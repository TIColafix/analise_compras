import {existsSync} from 'node:fs';
import {readLoads,saveLoad,readDiesel,saveDiesel,readDeliveryDeadlines,saveDeliveryDeadline,saveMonthlyOrder,saveBagPrices,saveBagProducts} from './cement-store.mjs';
import {readMaintenance,saveMaintenance,deleteMaintenance} from './maintenance-store.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID,randomBytes,createHmac,timingSafeEqual} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {readDocument,writeDocument,appendAudit,readAudit} from './database.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const bundledPython=join(process.env.USERPROFILE||process.env.HOME||root,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const python=process.env.MRP_PYTHON||(existsSync(bundledPython)?bundledPython:'python');
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/engine.js':'engine.js','/data.json':'data.json','/favicon.svg':'favicon.svg','/imports.js':'imports.js','/cement.js':'cement.js','/bulk-prices.js':'bulk-prices.js','/areia-amigos.js':'areia-amigos.js','/diesel.js':'diesel.js','/deadlines.js':'deadlines.js','/maintenance.js':'maintenance.js','/mpquotes.js':'mpquotes.js','/reports.js':'reports.js','/migration':'migration.html','/migration.html':'migration.html'};
const types={html:'text/html; charset=utf-8',css:'text/css',js:'text/javascript',svg:'image/svg+xml',json:'application/json; charset=utf-8'};
const pending=new Map();const sessions=new Map();let busy=false;
async function pythonReady(){return new Promise(resolve=>{const p=spawn(python,['-c','import sys,pypdf; print(sys.version.split()[0],pypdf.__version__)'],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',e=>resolve({ok:false,error:e.message}));p.on('close',c=>resolve(c===0?{ok:true,detail:out.trim()}:{ok:false,error:err.trim()||'Python indisponível'}));});}
const port=Number(process.env.PORT)||4173;
const host=process.env.HOST||(process.env.RAILWAY_ENVIRONMENT?'0.0.0.0':'127.0.0.1');
const publicOrigin=(process.env.APP_ORIGIN||'').replace(/\/$/,'');
const localOrigins=new Set(['http://127.0.0.1:4173','http://localhost:4173']);
function allowedOrigin(origin){return localOrigins.has(origin)||!!publicOrigin&&origin===publicOrigin;}
function parseBasic(req){
 const h=req.headers.authorization||'';if(!h.startsWith('Basic '))return null;
 try{const raw=Buffer.from(h.slice(6),'base64').toString(),i=raw.indexOf(':');if(i<0)return null;return {user:raw.slice(0,i),pass:raw.slice(i+1)}}catch{return null}
}
function accountFor(user,pass){
 const adminUser=process.env.APP_USER||'',adminPass=process.env.APP_PASSWORD||'';
 if(adminUser&&adminPass&&user===adminUser&&pass===adminPass)return {user,name:'Paulo',role:'admin'};
 const au=process.env.ALISSON_USER||'alisson',ap=process.env.ALISSON_PASSWORD||'';
 if(ap&&user===au&&pass===ap)return {user,name:'Alisson Santos',role:'operator'};
 return null;
}
function cookies(req){return Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim()).filter(Boolean).map(x=>{const i=x.indexOf('=');return i<0?[x,'']:[x.slice(0,i),decodeURIComponent(x.slice(i+1))]}));}
function credentials(req){
 if(!process.env.RAILWAY_ENVIRONMENT)return {user:'local',name:'Local',role:'admin'};
 const token=cookies(req).colafix_session;if(token&&sessions.has(token))return sessions.get(token).account;
 return null;
}
function authorized(req){return !!credentials(req);}
function actor(req){return credentials(req)?.name||'desconhecido';}
function isAdmin(req){return credentials(req)?.role==='admin';}
function audit(req,action,key,detail={}){return appendAudit(actor(req),action,key,detail).catch(e=>console.error('Falha auditoria:',e.message));}
function loginPage(message=''){return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colafix · Login</title><style>body{margin:0;font-family:Arial,sans-serif;background:#eef1f5;color:#202b3c;min-height:100vh;display:grid;place-items:center}.card{width:min(390px,calc(100% - 40px));background:#fff;border-radius:16px;box-shadow:0 12px 40px #1f293733;padding:32px}.brand{font-size:38px;font-weight:800;margin-bottom:8px}.brand span{color:#ef3340}.sub{color:#667085;margin:0 0 24px}label{display:block;font-size:13px;font-weight:700;margin:14px 0 6px}input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:8px;font-size:16px}button{width:100%;margin-top:22px;padding:12px;border:0;border-radius:8px;background:#1677ff;color:#fff;font-weight:700;font-size:15px;cursor:pointer}.err{background:#fff0f0;color:#b42318;padding:10px;border-radius:8px;margin-bottom:12px}</style></head><body><form class="card" id="login-form" method="post" action="/login" autocomplete="on"><div class="brand"><span>Cola</span>fix</div><p class="sub">Gestão de Suprimentos · Acesso ao sistema</p>${message?'<div class="err">'+message+'</div>':''}<label>Usuário</label><input name="username" id="login-user" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus><label>Senha</label><input name="password" id="login-password" type="password" autocomplete="current-password" required><label style="display:flex;align-items:center;gap:8px;font-weight:400"><input name="remember" id="login-remember" type="checkbox" value="1" style="width:auto"> Lembrar usuário neste computador</label><button type="submit">Entrar</button><p style="font-size:12px;color:#667085;margin:12px 0 0">A senha pode ser salva pelo gerenciador de senhas do navegador.</p></form><script>const u=localStorage.getItem("colafix_login_user");if(u){document.getElementById("login-user").value=u;document.getElementById("login-remember").checked=true;document.getElementById("login-password").focus()}document.querySelector("form").addEventListener("submit",()=>{const remember=document.getElementById("login-remember").checked,user=document.getElementById("login-user").value.trim();if(remember&&user)localStorage.setItem("colafix_login_user",user);else localStorage.removeItem("colafix_login_user")});</script></body></html>`;}
async function formBody(req){let size=0,chunks=[];for await(const c of req){size+=c.length;if(size>8192)throw Error('Requisição inválida.');chunks.push(c)}return new URLSearchParams(Buffer.concat(chunks).toString())}
function sessionCookie(token,remember=false){return `colafix_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=${remember?2592000:43200}`;}
function clearSessionCookie(){return 'colafix_session=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0';}
function askLogin(res){res.writeHead(302,{Location:'/login','Cache-Control':'no-store'});res.end();}
function allowedHost(value){if(!value)return false;if(!process.env.RAILWAY_ENVIRONMENT)return value==='127.0.0.1:4173'||value==='localhost:4173';if(publicOrigin){try{return value===new URL(publicOrigin).host}catch{return false}}return true;}
const names=['Necessidades de compra do dia.csv','PERFIL ITENS 27.04.pdf','SALDO ALMOXARIFADOS 27.04.pdf'];
function runPurchasePdf(file){return new Promise((resolve,reject)=>{const p=spawn(python,[join(root,'scripts/import_purchase_order.py'),file],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c?reject(Error(err.trim()||(()=>{try{return JSON.parse(out).error}catch{return 'Falha ao ler pedido PDF.'}})())):resolve(out));});}
function run(mode,folder){return new Promise((resolve,reject)=>{const p=spawn(python,[join(root,'scripts/import_erp.py'),mode,folder],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',c=>c?reject(Error(err.trim()||'Falha na importação.')):resolve(out));});}
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>40*1024*1024)throw Error('Limite de 30 MB por lote excedido.');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString());}
const reply=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
createServer(async(req,res)=>{try{
 if(!allowedHost(req.headers.host))return reply(res,403,{error:'Endereço não autorizado.'});
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/login'&&req.method==='GET'){if(authorized(req)){res.writeHead(302,{Location:'/', 'Cache-Control':'no-store'});return res.end()}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(loginPage())}
 if(path==='/login'&&req.method==='POST'){const f=await formBody(req),acc=accountFor(String(f.get('username')||f.get('user')||''),String(f.get('password')||''));if(!acc){res.writeHead(401,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(loginPage('Usuário ou senha inválidos.'))}const token=randomBytes(32).toString('hex'),remember=f.get('remember')==='1';sessions.set(token,{account:acc,createdAt:Date.now(),remember});res.writeHead(303,{Location:'/', 'Set-Cookie':sessionCookie(token,remember),'Cache-Control':'no-store'});return res.end()}
 if(path==='/logout'){const token=cookies(req).colafix_session;if(token)sessions.delete(token);res.writeHead(303,{Location:'/login','Set-Cookie':clearSessionCookie(),'Cache-Control':'no-store'});return res.end()}
 if(path!=='/api/health'&&!authorized(req))return askLogin(res);
 if(path==='/api/health'&&req.method==='GET')return reply(res,200,{app:'colafix-compras-mrp',version:2,database:!!process.env.DATABASE_URL});
 if(path==='/api/me'&&req.method==='GET'){const c=credentials(req);return reply(res,200,{ok:true,user:c?.user,name:c?.name,role:c?.role});}
 if(path==='/api/import/runtime'&&req.method==='GET')return reply(res,200,await pythonReady());
 if(path==='/api/external-summary'&&req.method==='GET'){
  const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error('HTTP '+r.status);return r.json()};
  let dollar=null,weather=[];
  const validRate=x=>Number.isFinite(Number(x))&&Number(x)>0;
  try{
   const j=await get('https://economia.awesomeapi.com.br/json/last/USD-BRL');
   const x=j.USDBRL;if(x&&validRate(x.bid))dollar={value:Number(x.bid),high:Number(x.high),low:Number(x.low),updated:x.create_date||'',source:'AwesomeAPI'};
  }catch{}
  if(!dollar)try{
   const j=await get('https://open.er-api.com/v6/latest/USD');
   if(validRate(j.rates?.BRL))dollar={value:Number(j.rates.BRL),updated:j.time_last_update_utc||'',source:'ExchangeRate-API'};
  }catch{}
  const history=[];
  const utcNow=new Date(),day=new Date(Date.UTC(utcNow.getUTCFullYear(),utcNow.getUTCMonth(),utcNow.getUTCDate()));
  for(let daysAgo=0;daysAgo<=4;daysAgo++){
   const d=new Date(day);d.setUTCDate(d.getUTCDate()-daysAgo);
   const date=d.toISOString().slice(0,10);
   try{
    const j=await get('https://api.frankfurter.dev/v1/'+date+'?base=USD&symbols=BRL');
    if(validRate(j.rates?.BRL))history.push({date:j.date||date,value:Number(j.rates.BRL)});
   }catch{}
  }
  if(dollar)dollar.history=history;
  try{
   const j=await get('https://api.open-meteo.com/v1/forecast?latitude=-29.9514&longitude=-51.0939&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=America%2FSao_Paulo&forecast_days=7');
   weather=(j.daily?.time||[]).map((date,i)=>({date,code:j.daily.weather_code[i],max:j.daily.temperature_2m_max[i],min:j.daily.temperature_2m_min[i],rain:j.daily.precipitation_probability_max[i]}));
  }catch{}
  return reply(res,200,{dollar,weather,updatedAt:new Date().toISOString()});
 }
 if(path==='/data.json'&&req.method==='GET'){const data=await readDocument('main-data',null);if(data!==null)return reply(res,200,data);}
 if(path==='/api/areia-amigos'&&req.method==='GET'){const records=await readDocument('areia-amigos',[]);return reply(res,200,{records:Array.isArray(records)?records:[]});}
 if(path==='/api/cement'&&req.method==='GET')return reply(res,200,await readLoads(root));
 if(path==='/api/diesel'&&req.method==='GET')return reply(res,200,await readDiesel(root));
 if(path==='/api/deadlines'&&req.method==='GET')return reply(res,200,await readDeliveryDeadlines(root));
 if(path==='/api/maintenance'&&req.method==='GET')return reply(res,200,await readMaintenance(root));
 if(path==='/api/audit'&&req.method==='GET'){if(!isAdmin(req))return reply(res,403,{error:'Somente o administrador pode consultar a auditoria.'});return reply(res,200,{ok:true,entries:await readAudit(300)});}
 if(path.startsWith('/api/maintenance/')&&req.method==='DELETE'){
  if(!isAdmin(req))return reply(res,403,{error:'Somente o administrador pode excluir solicitações.'});
  const id=decodeURIComponent(path.slice('/api/maintenance/'.length));
  const removed=await deleteMaintenance(root,id);
  await audit(req,'excluir','maintenance',{id:removed.id,number:removed.number||'',description:removed.description||'',category:removed.category||''});
  return reply(res,200,{ok:true,removed:{id:removed.id,number:removed.number||''}});
 }
 if(path==='/api/backup'&&req.method==='GET'){
  if(!isAdmin(req))return reply(res,403,{error:'Somente o administrador pode baixar o backup completo.'});
  const [main,cement,diesel,deadlines,maintenance]=await Promise.all([
   readDocument('main-data',null),readLoads(root),readDiesel(root),readDeliveryDeadlines(root),readMaintenance(root)
  ]);
  if(main===null)throw Error('Base principal não encontrada.');
  const stamp=new Date().toISOString().slice(0,10);
  const backup={format:'colafix-compras-backup',version:1,createdAt:new Date().toISOString(),documents:{main,cement,diesel,deadlines,maintenance}};
  const payload=JSON.stringify(backup,null,2);
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="backup-colafix-${stamp}.json"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  return res.end(payload);
 }
 if(path.startsWith('/api/')){
  if(req.method!=='POST')return reply(res,405,{error:'Método não permitido.'});
  if(!allowedOrigin(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json'))return reply(res,403,{error:'Operação não autorizada para esta origem.'});
  if(busy)return reply(res,409,{error:'Uma importação está em andamento. Aguarde.'});
  busy=true;try{const input=await body(req);
   if(path==='/api/admin/migrate'){
    if(!isAdmin(req))throw Error('Somente o administrador pode executar migração.');
    if(process.env.ALLOW_DATA_MIGRATION!=='true')throw Error('Migração desativada.');
    const docs=input.documents||{},map={main:'main-data',cement:'cement',diesel:'diesel',deadlines:'delivery-deadlines',maintenance:'maintenance'},result={};
    for(const [name,key] of Object.entries(map)){if(!(name in docs))continue;const current=await readDocument(key,null);if(current!==null){result[name]='preservado: já existe';continue;}await writeDocument(key,docs[name]);result[name]='migrado';}
    return reply(res,200,{ok:true,result,message:'Migração concluída sem sobrescrever documentos existentes.'});
   }
   if(path==='/api/health'&&req.method==='GET')return reply(res,200,{app:'colafix-compras-mrp',version:1});
 if(path==='/api/areia-amigos/extract'){
  if(!process.env.OPENAI_API_KEY)return reply(res,503,{error:'Configure OPENAI_API_KEY nas variáveis do Railway para ativar a leitura por IA.'});
  const image=String(input.image||'');
  if(!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(image)||image.length>7e6)return reply(res,400,{error:'Imagem inválida ou acima de 5 MB.'});
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),55000);
  try{
   const instruction='Leia somente este recibo Areia dos Amigos. Retorne JSON: receipt, date YYYY-MM-DD, time HH:MM, client, plate, quantities array de 5 valores na ordem Areia Fina Branca, Areia Fina Amarelinha, Areia Média, Aterro, Areia; total; warnings array. Use null se não conseguir ler. Número do recibo ao lado de Nº no cabeçalho, não o número da rua. Quantidade na coluna esquerda da tabela por linha. Total manuscrito no canto inferior direito, nunca o rodapé impresso. Não invente.';
   const response=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.OPENAI_VISION_MODEL||'gpt-4.1-mini',response_format:{type:'json_object'},messages:[{role:'system',content:instruction},{role:'user',content:[{type:'text',text:'Extraia os dados desta foto. Campos incertos devem ser null.'},{type:'image_url',image_url:{url:image,detail:'high'}}]}]}),signal:ctrl.signal});
   const j=await response.json();if(!response.ok)throw Error(j.error?.message||'Erro na IA: '+response.status);
   const d=JSON.parse(j.choices?.[0]?.message?.content||'{}');
   const clean={receipt:d.receipt==null?null:String(d.receipt).replace(/\D/g,''),date:/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')?d.date:null,time:/^\d{2}:\d{2}$/.test(d.time||'')?d.time:null,client:d.client==null?null:String(d.client).slice(0,150),plate:d.plate==null?null:String(d.plate).toUpperCase().replace(/[^A-Z0-9]/g,''),quantities:Array.from({length:5},(_,i)=>d.quantities?.[i]==null?null:Number(d.quantities[i])),total:d.total==null?null:Number(d.total),warnings:Array.isArray(d.warnings)?d.warnings.slice(0,5):[]};
   return reply(res,200,{ok:true,data:clean});
  }catch(e){return reply(res,502,{error:e.name==='AbortError'?'Tempo limite excedido.':e.message})}finally{clearTimeout(timer)}
 }
 if(path==='/api/areia-amigos'){if(!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image||'')||input.image.length>7e6)throw Error('Anexe uma imagem JPG, PNG ou WEBP de até 5 MB.');if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date||'')||!String(input.receipt||'').trim())throw Error('Informe a data e o número do recibo.');const previous=await readDocument('areia-amigos',[]),records=Array.isArray(previous)?previous:[];const entry={id:String(input.id||randomUUID()),receipt:String(input.receipt).slice(0,80),date:input.date,time:String(input.time||'').slice(0,5),client:String(input.client||'').slice(0,180),plate:String(input.plate||'').slice(0,32),total:Number(input.total)||0,quantities:Array.from({length:5},(_,i)=>Math.max(0,Number(input.quantities?.[i])||0)),image:input.image,updatedAt:new Date().toISOString()};const index=records.findIndex(x=>x.id===entry.id);if(index>=0)records[index]=entry;else records.unshift(entry);await writeDocument('areia-amigos',records);await audit(req,'salvar','areia-amigos',{id:entry.id,receipt:entry.receipt});return reply(res,200,{ok:true,records});}
 if(path==='/api/cement'){const load=await saveLoad(root,input);await audit(req,'salvar','cement',{id:load?.id||input.id||'',status:load?.status||input.status||''});return reply(res,200,{ok:true,load});}if(path==='/api/cement-bag-products'){const products=await saveBagProducts(root,input);await audit(req,'salvar','cement-bag-products',{count:products.length});return reply(res,200,{ok:true,products});}if(path==='/api/cement-bag-prices'){const bagPrices=await saveBagPrices(root,input);await audit(req,'salvar','cement-bag-prices',{period:bagPrices.period||'',updatedAt:bagPrices.updatedAt||''});return reply(res,200,{ok:true,bagPrices});}if(path==='/api/cement-monthly-order'){const orders=await saveMonthlyOrder(root,input);await audit(req,'salvar','cement-monthly-order',{supplier:input.supplier||''});return reply(res,200,{ok:true,orders});}
   if(path==='/api/diesel'){const load=await saveDiesel(root,input);await audit(req,'salvar','diesel',{id:load?.id||input.id||'',status:load?.status||input.status||''});return reply(res,200,{ok:true,load});}
   if(path==='/api/deadlines'){const order=await saveDeliveryDeadline(root,input);await audit(req,'salvar','delivery-deadlines',{id:order?.id||input.id||'',purchaseOrder:order?.purchaseOrder||input.purchaseOrder||'',code:order?.code||input.code||''});return reply(res,200,{ok:true,order});}
   if(path==='/api/maintenance'){const request=await saveMaintenance(root,input);await audit(req,'salvar','maintenance',{id:request?.id||input.id||'',status:request?.status||input.status||''});return reply(res,200,{ok:true,request});}
   if(path==='/api/parameters'){
    const target=join(root,'dist/data.json');let data,raw;
    if(process.env.DATABASE_URL){data=await readDocument('main-data',null);if(!data)throw Error('Base principal não encontrada no PostgreSQL.');raw=JSON.stringify(data);}else{raw=await readFile(target,'utf8');data=JSON.parse(raw);}
    if(!data.catalog.some(r=>r.id===input.id)||!/^\d{4}-\d{2}-\d{2}$/.test(input.date)||![...data.daily,...data.weekly,...(data.reportProfiles||[])].some(r=>r.id===input.id&&r.date===input.date))throw Error('Item ou data inválidos.');
    const allowed=['monthly','safety','min','multiple','lead','buffer'],values=input.values;
    if(!values||typeof values!=='object'||!Object.keys(values).length||Object.entries(values).some(([k,v])=>!allowed.includes(k)||typeof v!=='number'||!Number.isFinite(v)||v<0||v>1e12))throw Error('Informe números válidos e não negativos.');
    const edit={id:input.id,date:input.date,values,savedAt:new Date().toISOString(),knownDates:[...new Set((data.paramSnapshots||[]).map(r=>r.date))]};
    data.parameterEdits??=[];data.parameterEdits.push(edit);
    if(process.env.DATABASE_URL){await writeDocument('main-data',data);await audit(req,'alterar-parametros','main-data',{id:input.id,date:input.date,values});}else{const backup=join(root,'source-data/backups');await mkdir(backup,{recursive:true});await writeFile(join(backup,'parameters-'+randomUUID()+'.json'),raw);const temp=target+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(data));await rename(temp,target);}
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
    if(process.env.DATABASE_URL){const remote=await readDocument('main-data',null);if(remote){await mkdir(join(root,'dist'),{recursive:true});await writeFile(join(root,'dist/data.json'),JSON.stringify(remote));}}
    const id=randomUUID(),folder=join(root,'source-data/imports',id);await mkdir(folder,{recursive:true});
    for(let n=0;n<3;n++){const f=input.files[n];if(typeof f.content!=='string'||!f.content.length)throw Error('Arquivo vazio.');const bytes=Buffer.from(f.content,'base64');if(n>0&&bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Perfil e saldos devem ser arquivos PDF.');await writeFile(join(folder,names[n]),bytes);}
    await writeFile(join(folder,'originais.json'),JSON.stringify(input.files.map(f=>({name:String(f.name)}))));
    const result=JSON.parse(await run('preview',folder));let data={meta:{erpImports:[]}};try{data=JSON.parse(await readFile(join(root,'dist/data.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
    const same=data.meta?.erpImports?.find(r=>r.date===result.date);result.duplicate=!!same&&result.files.every((f,i)=>same.files[i]?.sha256===f.sha256);result.conflict=!!same&&!result.duplicate;
    pending.set(id,{folder,result});return reply(res,200,{id,...result});
   }
   if(path==='/api/import/commit'){
    const entry=pending.get(input.id);if(!entry)throw Error('Confira os arquivos novamente antes de importar.');if(entry.result.conflict)throw Error('Já existe um lote diferente nesta data; histórico preservado.');
    if(!entry.result.duplicate){await run('commit',entry.folder);if(process.env.DATABASE_URL){const updated=JSON.parse(await readFile(join(root,'dist/data.json'),'utf8'));await writeDocument('main-data',updated);await audit(req,'importar-erp','main-data',{date:entry.result.date});}}
    await writeFile(join(entry.folder,'resultado.json'),JSON.stringify({...entry.result,importedAt:new Date().toISOString()},null,2));pending.delete(input.id);
    return reply(res,200,{ok:true,duplicate:entry.result.duplicate,date:entry.result.date});
   }
   return reply(res,404,{error:'Rota não encontrada.'});
  }finally{busy=false;}
 }
 if(req.method!=='GET')return reply(res,405,{error:'Método não permitido.'});
 const file=files[path];if(!file)return reply(res,404,{error:'Não encontrado.'});const content=await readFile(join(root,'dist',file));res.writeHead(200,{'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-store'});res.end(content);
}catch(e){reply(res,400,{error:e.message});}}).listen(port,host,()=>console.log(`Monitoramento MRP: http://${host}:${port}`));
