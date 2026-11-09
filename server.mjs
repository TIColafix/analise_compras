import {existsSync} from 'node:fs';
import {readLoads,saveLoad,deleteCementLoad,readDiesel,saveDiesel,readDeliveryDeadlines,saveDeliveryDeadline,saveMonthlyOrder,saveBagPrices,saveBagProducts} from './cement-store.mjs';
import {readMaintenance,saveMaintenance,deleteMaintenance} from './maintenance-store.mjs';
import {readMaintenanceDeadlines,saveMaintenanceDeadline} from './maintenance-deadlines-store.mjs';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,rename,mkdtemp,rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID,randomBytes,createHmac,timingSafeEqual,scryptSync} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readDocument,writeDocument,appendAudit,readAudit,exportDatabaseSnapshot,saveSupplierCatalog,getSupplierCatalog,deleteSupplierCatalog} from './database.mjs';
const root=fileURLToPath(new URL('.',import.meta.url));
const bundledPython=join(process.env.USERPROFILE||process.env.HOME||root,'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const python=process.env.MRP_PYTHON||(existsSync(bundledPython)?bundledPython:'python');
const files={'/':'index.html','/index.html':'index.html','/style.css':'style.css','/app.js':'app.js','/engine.js':'engine.js','/data.json':'data.json','/favicon.svg':'favicon.svg','/imports.js':'imports.js','/cement.js':'cement.js','/bulk-prices.js':'bulk-prices.js','/areia-amigos.js':'areia-amigos.js','/diesel.js':'diesel.js','/supplier-agenda.js':'supplier-agenda.js','/deadlines.js':'deadlines.js','/maintenance-deadlines.js':'maintenance-deadlines.js','/maintenance.js':'maintenance.js','/mpquotes.js':'mpquotes.js','/reports.js':'reports.js','/mp-report.js':'mp-report.js','/indirect-materials.js':'indirect-materials.js','/migration':'migration.html','/migration.html':'migration.html'};
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
async function managedUsers(){
 const users=await readDocument('app-users',[]);
 return Array.isArray(users)?users:[];
}
function hashPassword(password,salt=randomBytes(16).toString('hex')){
 return 'scrypt:'+salt+':'+scryptSync(password,salt,64).toString('hex');
}
function validPassword(password,stored){
 if(!stored||!stored.startsWith('scrypt:'))return false;
 const [,salt,hex]=stored.split(':');
 if(!salt||!hex||!/^[a-f0-9]{128}$/i.test(hex))return false;
 return timingSafeEqual(scryptSync(password,salt,64),Buffer.from(hex,'hex'));
}
async function accountFor(user,pass){
 const adminUser=process.env.APP_USER||'',adminPass=process.env.APP_PASSWORD||'';
 if(adminUser&&adminPass&&user===adminUser&&pass===adminPass)return {user,name:'Paulo',role:'admin'};
 const au=process.env.ALISSON_USER||'alisson',ap=process.env.ALISSON_PASSWORD||'';
 if(ap&&user===au&&pass===ap)return {user,name:'Alisson Santos',role:'operator'};
 const found=(await managedUsers()).find(x=>x.user===user&&x.enabled&&validPassword(pass,x.passwordHash));
 return found?{user:found.user,name:found.name,role:'limited',permissions:found.permissions||[],managed:true,sessionVersion:found.sessionVersion||0}:null;
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
async function refreshManagedSession(req){
 const token=cookies(req).colafix_session,session=token&&sessions.get(token);
 if(!session?.account?.managed)return;
 const user=(await managedUsers()).find(x=>x.user===session.account.user);
 if(!user?.enabled||!user.passwordHash||user.sessionVersion!==session.account.sessionVersion){sessions.delete(token);return;}
 session.account={...session.account,name:user.name,permissions:user.permissions||[]};
}
function isLimited(req){return credentials(req)?.role==='limited';}
function hasAccess(req,module){const acc=credentials(req);return acc?.role!=='limited'||acc.permissions?.includes(module);}

function audit(req,action,key,detail={}){return appendAudit(actor(req),action,key,detail).catch(e=>console.error('Falha auditoria:',e.message));}
function loginPage(message=''){return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colafix · Login</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:Arial,Helvetica,sans-serif;color:#fff;background:#0a1019;isolation:isolate;position:relative;display:flex;align-items:center;justify-content:center;padding:100px 20px 125px;overflow-x:hidden}
body:before{content:"";position:fixed;inset:0;background:linear-gradient(180deg,rgba(4,9,17,.32),rgba(4,9,17,.26) 35%,rgba(4,9,17,.78) 100%),linear-gradient(90deg,rgba(4,9,17,.36),transparent 65%),url('/images/colafix-banner.png.png') center center/cover no-repeat;filter:saturate(.92);z-index:0}
body:after{content:"";position:fixed;inset:0;background:radial-gradient(ellipse at 85% 50%,rgba(237,50,57,.17),transparent 48%);pointer-events:none;z-index:0}
.topbar{z-index:2;position:absolute;top:28px;left:clamp(24px,5vw,90px);right:clamp(24px,5vw,90px);display:flex;align-items:flex-start;justify-content:space-between;gap:20px}
.top-brand{font-size:clamp(29px,3.2vw,48px);font-weight:900;letter-spacing:-2px;text-shadow:0 2px 12px #0009}.top-brand span,.brand span{color:#ed2939}.top-brand small{display:block;font-size:11px;font-weight:700;letter-spacing:2.4px;color:#e5e7eb;margin-top:2px}
.top-motto{text-align:right;font-size:11px;letter-spacing:2px;line-height:1.8;font-weight:700;text-shadow:0 2px 10px #000}.top-motto:after{content:"";display:block;background:#ed2939;width:46px;height:3px;margin:9px 0 0 auto}
.card{position:relative;z-index:2;width:min(420px,100%);padding:34px 35px 29px;background:linear-gradient(145deg,rgba(12,17,24,.95),rgba(6,10,17,.91));border:1px solid rgba(255,255,255,.2);border-radius:16px;box-shadow:0 25px 75px #000a;backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px)}
.brand{font-size:41px;font-weight:900;letter-spacing:-2px;text-align:center}.sub{font-size:11px;letter-spacing:1.4px;text-transform:uppercase;text-align:center;color:#bfc8d4;margin:4px 0 29px}
label{display:block;font-size:13px;font-weight:700;margin:15px 0 8px;color:#e8edf5}input:not([type=checkbox]){display:block;width:100%;padding:13px 14px;background:#192633;border:1px solid #46566a;border-radius:9px;color:white;font-size:15px;outline:none}input:focus{border-color:#f34b57;box-shadow:0 0 0 3px #ed293929}input::placeholder{color:#aebccc}button[type=submit]{display:block;width:100%;margin-top:23px;padding:14px;border:0;border-radius:9px;background:#ed2939;color:white;font-weight:800;font-size:16px;cursor:pointer;transition:background .15s,transform .15s}button[type=submit]:hover{background:#ff3849;transform:translateY(-1px)}#toggle-password{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:42px;height:38px;margin:0;padding:0;background:transparent;color:#b8c7d8;border:0;cursor:pointer}#login-remember{accent-color:#ed2939;width:16px;height:16px;margin:0}.remember-label{display:flex;align-items:center;gap:9px;font-size:12px;font-weight:400;cursor:pointer;margin-top:17px}.err{background:#5d1821;color:#fff;padding:12px;border:1px solid #e44755;border-radius:8px;margin-bottom:12px;font-size:13px}.login-note{font-size:11px;color:#a8b4c4;margin:17px 0 0;text-align:center;line-height:1.5}
.departments{z-index:2;position:absolute;bottom:28px;left:50%;transform:translateX(-50%);display:flex;gap:10px;justify-content:center;width:min(750px,calc(100% - 32px))}.department{flex:1;min-width:0;background:#090d13c9;border:1px solid #ffffff30;border-radius:12px;padding:15px 6px 13px;text-align:center;backdrop-filter:blur(6px);font-size:11px;font-weight:700;line-height:1.3}.department b{display:block;font-size:25px;margin-bottom:7px}
@media(max-width:650px){body{padding:130px 15px 155px}.topbar{top:20px;left:18px;right:18px}.top-motto{font-size:8px;letter-spacing:1px}.top-brand{font-size:30px}.top-brand small{font-size:8px}.card{padding:25px 23px}.departments{bottom:18px;flex-wrap:wrap;gap:7px}.department{flex:1 1 28%;padding:8px 3px;font-size:9px}.department b{font-size:18px;margin-bottom:3px}}
</style></head><body><header class="topbar"><div class="top-brand"><span>Cola</span>fix<small>COMPRAS E SUPRIMENTOS</small></div><div class="top-motto">PESSOAS<br>PROCESSOS<br>SUPRIMENTOS<br>RESULTADOS</div></header><form class="card" id="login-form" method="post" action="/login" autocomplete="on"><div class="brand"><span>Cola</span>fix</div><p class="sub">Gestão de Suprimentos · Acesso ao sistema</p>${message?'<div class="err">'+message+'</div>':''}<label for="login-user">Usuário</label><input name="username" id="login-user" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus><label for="login-password">Senha</label><div style="position:relative"><input name="password" id="login-password" type="password" autocomplete="current-password" style="padding-right:54px" required><button type="button" id="toggle-password" aria-label="Mostrar senha" aria-pressed="false" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);width:42px;height:38px;margin:0;padding:0;background:transparent;color:#475569;border:0;font-size:21px" title="Mostrar senha"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button></div><label class="remember-label"><input name="remember" id="login-remember" type="checkbox" value="1" > Manter login neste dispositivo</label><button type="submit">Entrar →</button><p class="login-note">Ao marcar, sua sessão poderá permanecer ativa por até 30 dias. Para preencher a senha automaticamente, escolha Salvar senha quando o Chrome oferecer.</p></form><div class="departments" aria-label="Áreas do sistema"><div class="department"><b>▦</b>Matéria-prima</div><div class="department"><b>♙</b>Insumos/EPIs</div><div class="department"><b>⚒</b>Manutenção</div><div class="department"><b>⛽</b>Diesel</div><div class="department"><b>🚚</b>Areia Amigos</div></div><script>const pwd=document.getElementById("login-password"),toggle=document.getElementById("toggle-password");toggle.addEventListener("click",()=>{const visible=pwd.type==="password";pwd.type=visible?"text":"password";toggle.querySelector("svg").style.opacity=visible?".7":"1";toggle.querySelector("svg").style.textDecoration=visible?"line-through":"none";toggle.setAttribute("aria-label",visible?"Ocultar senha":"Mostrar senha");toggle.setAttribute("aria-pressed",String(visible))});const u=localStorage.getItem("colafix_login_user");if(u){const usernameInput=document.getElementById("login-user");if(!usernameInput.value)usernameInput.value=u;document.getElementById("login-remember").checked=true;}document.querySelector("form").addEventListener("submit",()=>{const remember=document.getElementById("login-remember").checked,user=document.getElementById("login-user").value.trim();if(remember&&user)localStorage.setItem("colafix_login_user",user);else localStorage.removeItem("colafix_login_user")});</script></body></html>`;}
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
function limitedAreiaPage(){return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colafix · Areia Amigos</title><link rel="icon" href="/favicon.svg"><link rel="stylesheet" href="/style.css"><style>
body{margin:0;background:#f1f5f9}
.limited-layout{display:contents}
.limited-layout .sidebar{position:fixed;inset:0 auto 0 0;width:224px;height:100vh;overflow-y:auto;flex:none}
.limited-layout main{width:100%;max-width:1800px;margin:0 auto;padding:28px;min-width:0;display:block}
.limited-layout main>header{padding:0;background:transparent;border:0;display:grid;grid-template-columns:minmax(0,1fr) 180px;gap:20px;min-height:70px;margin-bottom:20px}
.limited-layout .limited-main{padding:0;width:100%;max-width:none;margin:0}
.limited-layout .sidebar nav a.active{background:#404754;color:white}
.limited-layout #areiaamigos-view{display:block!important}
.limited-layout .aa-saved-overlay{z-index:9999}
@media(min-width:761px) and (max-width:1150px){.limited-layout .sidebar{width:200px}.limited-layout main{padding:22px}}
@media(max-width:760px){.limited-layout .sidebar{position:relative;width:100%;height:auto;overflow:visible}.limited-layout main{padding:14px}.limited-layout main>header{display:block;min-height:0}.limited-layout .limited-main{padding:0}}
</style></head><body><div class="limited-layout"><aside class="sidebar"><div class="brand" aria-label="Colafix"><span>Cola</span>fix<small>GESTÃO DE SUPRIMENTOS</small></div><p class="nav-caption">ÁREA DE TRABALHO</p><nav aria-label="Navegação principal"><a href="/areia" class="active" aria-current="page"><span aria-hidden="true">🚚</span>Areia Amigos</a><a href="/logout"><span aria-hidden="true">🚪</span>Sair</a></nav><div class="sidebar-foot">BASES LOCAIS<small>Compras e materiais</small></div></aside><main><header><div class="heading"><h1>Areia Amigos</h1><span>Controle de recebimento de cargas</span></div></header><div class="limited-main"><section id="areiaamigos-view"></section></div></main></div><script type="module" src="/areia-amigos.js"></script><script>fetch("/api/me",{cache:"no-store"});setInterval(()=>{if(!document.hidden)fetch("/api/me",{cache:"no-store"}).catch(()=>{});},30000);</script></body></html>`;}

function usersPage(){return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colafix · Usuários</title><style>body{margin:0;background:#f1f5f9;color:#142944;font:15px Arial,sans-serif}header{background:#242b36;color:white;padding:20px 28px;display:flex;justify-content:space-between;align-items:center}header a{color:white}main{max-width:1050px;margin:28px auto;padding:0 18px}section{background:white;border:1px solid #d8e1ee;border-radius:12px;padding:24px;margin-bottom:18px}h1{margin:0}h2{margin-top:0}label{display:block;font-weight:600;margin:12px 0 5px}input{box-sizing:border-box;width:100%;padding:11px;border:1px solid #b8c9dc;border-radius:7px;font-size:15px}button{padding:10px 14px;border:0;border-radius:7px;background:#0877e7;color:white;font-weight:600;cursor:pointer}button:disabled{opacity:.55}button.secondary{background:#52647c}button.danger{background:#b42332}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:end}.row{border-top:1px solid #e1e8f2;padding:18px 0;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap}.actions{display:flex;gap:8px;flex-wrap:wrap}.hint{color:#66778b;font-size:13px}.msg{padding:10px;margin:12px 0;border-radius:7px;background:#e4f5e8} .error{background:#ffe7e7;color:#a32121}@media(max-width:720px){.grid{grid-template-columns:1fr}}html{color-scheme:light}html[data-colafix-theme="dark"]{color-scheme:dark}html[data-colafix-theme="dark"] body{background:#101720;color:#e6edf5}html[data-colafix-theme="dark"] section{background:#1c293a;border-color:#3b506b;color:#edf3ff}html[data-colafix-theme="dark"] header{background:#080e17;border-bottom:1px solid #3b506b}html[data-colafix-theme="dark"] header a{color:#d5e6ff}html[data-colafix-theme="dark"] input{background:#142236;border-color:#526781;color:#f6f9ff}html[data-colafix-theme="dark"] input::placeholder{color:#a7bad3}html[data-colafix-theme="dark"] .hint{color:#b6c8e0}html[data-colafix-theme="dark"] .row{border-color:#3b506b}html[data-colafix-theme="dark"] .msg{background:#20422f;color:#d7ffe6}html[data-colafix-theme="dark"] .msg.error{background:#4a252b;color:#ffdde1}.theme-users-switch{position:fixed;bottom:20px;right:20px;z-index:1000;background:#eaf2ff;color:#14243a;border:1px solid #b7c9e0;border-radius:999px;padding:12px 17px;box-shadow:0 5px 18px #0003}html[data-colafix-theme="dark"] .theme-users-switch{background:#26394f;color:#f4f8ff;border-color:#506782}</style></head><body><header><strong>Colafix · Administração de usuários</strong><a href="/">← Voltar ao sistema</a></header><main><h1>Usuários</h1><p>Cadastre, libere ou bloqueie acessos. Senhas são armazenadas com hash seguro; não são exibidas novamente.</p><div id="message" aria-live="polite"></div><section><h2>Novo usuário</h2><form id="new"><div class="grid"><div><label>Nome completo</label><input name="name" required minlength="3" autocomplete="off"></div><div><label>Usuário de login</label><input name="user" required pattern="[a-zA-Z][a-zA-Z0-9._-]{2,39}" autocomplete="off"></div><div><label>Senha inicial (mínimo 6 caracteres)</label><input name="password" type="password" minlength="6" autocomplete="new-password" placeholder="Opcional: ativar depois"></div></div><p class="hint">Permissão inicial: apenas Areia Amigos. Se deixar a senha em branco, a conta fica bloqueada até você definir uma.</p><button>Criar usuário</button></form></section><section><h2>🟢 Conectados agora</h2><p class="hint">Usuários com atividade nos últimos 2 minutos. Atualização automática a cada 30 segundos.</p><div id="online">Carregando…</div></section><section><h2>Contas cadastradas</h2><div id="users">Carregando…</div></section></main><button type="button" class="theme-users-switch" id="theme-users-switch">🌙 Modo escuro</button><script>
(function(){const key='colafix-theme';const apply=()=>{const dark=localStorage.getItem(key)==='dark';document.documentElement.setAttribute('data-colafix-theme',dark?'dark':'light');document.getElementById('theme-users-switch').textContent=dark?'☀️ Modo claro':'🌙 Modo escuro'};document.getElementById('theme-users-switch').addEventListener('click',()=>{localStorage.setItem(key,localStorage.getItem(key)==='dark'?'light':'dark');apply()});apply()})();
const $=s=>document.querySelector(s),escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&#39;'}[c]));
async function api(path,method='GET',data){const r=await fetch(path,{method,headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,credentials:'same-origin'});const j=await r.json();if(!r.ok)throw Error(j.error||'Falha na operação.');return j;}
function message(t,error=false){$('#message').innerHTML='<div class="msg '+(error?'error':'')+'">'+escapeHtml(t)+'</div>';}
async function load(){try{const j=await api('/api/users');$('#users').innerHTML=j.users.length?j.users.map(u=>'<div class="row"><div><strong>'+escapeHtml(u.name)+'</strong> · <code>'+escapeHtml(u.user)+'</code><p class="hint">Permissões: '+(u.role==='admin'?'Administrador · todas as abas':u.role==='operator'?'Operacional':(u.permissions||[]).includes('areiaamigos')?'Areia Amigos':'Restrito')+' · '+(u.enabled?'🟢 Liberado':'🔴 Bloqueado')+'</p></div><div class="actions">'+(u.protected?'<span class="hint">🔐 Conta existente · gerenciada no Railway</span>':'<button data-user="'+escapeHtml(u.user)+'" data-action="password" class="secondary">🔑 Definir senha</button><button data-user="'+escapeHtml(u.user)+'" data-action="toggle" data-enabled="'+u.enabled+'" class="'+(u.enabled?'danger':'')+'">'+(u.enabled?'🔒 Bloquear':'🔓 Liberar')+'</button>')+'</div></div>').join(''):'<p>Nenhum usuário cadastrado.</p>';}catch(e){message(e.message,true)}}
$('#new').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);try{await api('/api/users','POST',{name:f.get('name'),user:f.get('user'),password:f.get('password')});e.target.reset();message('Usuário criado.');load()}catch(err){message(err.message,true)}};
function askPassword(user){return new Promise(resolve=>{const layer=document.createElement('div');layer.style.cssText='position:fixed;inset:0;background:#0008;display:grid;place-items:center;z-index:99999;padding:16px';layer.innerHTML='<form style="width:min(430px,100%);background:white;border-radius:12px;padding:24px;box-sizing:border-box"><h2>Definir senha de '+escapeHtml(user)+'</h2><label>Nova senha (mínimo 6 caracteres)</label><input type="password" required minlength="6" autocomplete="new-password" style="width:100%"><div style="display:flex;gap:8px;margin-top:18px"><button type="submit">Salvar senha</button><button type="button" class="secondary">Cancelar</button></div></form>';document.body.appendChild(layer);const form=layer.querySelector('form'),input=layer.querySelector('input');input.focus();form.onsubmit=e=>{e.preventDefault();const password=input.value;layer.remove();resolve(password)};layer.querySelector('button[type=button]').onclick=()=>{layer.remove();resolve(null)};layer.onkeydown=e=>{if(e.key==='Escape'){layer.remove();resolve(null)}};});}
$('#users').onclick=async e=>{const b=e.target.closest('button[data-user]');if(!b)return;const user=b.dataset.user;try{if(b.dataset.action==='password'){const password=await askPassword(user);if(password===null)return;await api('/api/users/'+encodeURIComponent(user),'PATCH',{password});message('Senha definida. Sessões anteriores foram encerradas.');}else{const enabled=b.dataset.enabled!=='true';if(!confirm((enabled?'Liberar':'Bloquear')+' o usuário '+user+'?'))return;await api('/api/users/'+encodeURIComponent(user),'PATCH',{enabled});message('Acesso atualizado.')}load()}catch(err){message(err.message,true)}};
async function loadOnline(){try{const j=await api('/api/online');$('#online').innerHTML=j.users.length?j.users.map(u=>'<div class="row"><strong>🟢 '+escapeHtml(u.name)+'</strong><span class="hint">'+escapeHtml(u.user)+' · Última atividade: '+new Date(u.lastSeen).toLocaleTimeString('pt-BR')+'</span></div>').join(''):'<p class="hint">Nenhum usuário ativo nos últimos 2 minutos.</p>';}catch(e){$('#online').textContent=e.message;}}
load();loadOnline();setInterval(loadOnline,30000);
</script></body></html>`;}
createServer(async(req,res)=>{try{
 if(!allowedHost(req.headers.host))return reply(res,403,{error:'Endereço não autorizado.'});
 const path=new URL(req.url,'http://localhost').pathname;
 if(path==='/login'&&req.method==='GET'){if(authorized(req)){res.writeHead(302,{Location:'/', 'Cache-Control':'no-store'});return res.end()}res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(loginPage())}
 if(path==='/login'&&req.method==='POST'){const f=await formBody(req),acc=await accountFor(String(f.get('username')||f.get('user')||''),String(f.get('password')||''));if(!acc){res.writeHead(401,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(loginPage('Usuário ou senha inválidos.'))}const token=randomBytes(32).toString('hex'),remember=f.get('remember')==='1';sessions.set(token,{account:acc,createdAt:Date.now(),lastSeen:Date.now(),remember});res.writeHead(303,{Location:'/', 'Set-Cookie':sessionCookie(token,remember),'Cache-Control':'no-store'});return res.end()}
 await refreshManagedSession(req);
 if(path==='/logout'){const token=cookies(req).colafix_session;if(token)sessions.delete(token);res.writeHead(303,{Location:'/login','Set-Cookie':clearSessionCookie(),'Cache-Control':'no-store'});return res.end()}
 // A imagem pública da tela de login deve carregar antes da verificação de sessão.
 if(path==='/images/colafix-banner.png.png'&&req.method==='GET'){
  const content=await readFile(join(root,'dist','images','colafix-banner.png.png'));
  res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=3600'});
  return res.end(content);
 }
 if(path!=='/api/health'&&!authorized(req)){if(path.startsWith('/api/'))return reply(res,401,{error:'Sessão expirada. Entre novamente para continuar.',loginRequired:true});return askLogin(res);}
 if(path==='/usuarios'&&req.method==='GET'){
  if(!isAdmin(req))return reply(res,403,{error:'Acesso exclusivo do administrador.'});
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  return res.end(usersPage());
 }
 if(path==='/areia'&&req.method==='GET'){
  if(!hasAccess(req,'areiaamigos'))return reply(res,403,{error:'Sem acesso a Areia Amigos.'});
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
  return res.end(limitedAreiaPage());
 }
 if(isLimited(req)){
  if(path==='/'||path==='/index.html'){res.writeHead(302,{Location:'/areia','Cache-Control':'no-store'});return res.end();}
  const allow=['/api/me','/api/areia-amigos','/api/areia-amigos/extract','/style.css','/areia-amigos.js','/favicon.svg'];
  if(!hasAccess(req,'areiaamigos')||!allow.includes(path)&&!path.startsWith('/api/areia-amigos/'))return reply(res,403,{error:'Você não tem permissão para acessar este módulo.'});
 }
 if(path==='/api/users'&&req.method==='GET'){
  if(!isAdmin(req))return reply(res,403,{error:'Acesso exclusivo do administrador.'});
  const users=await managedUsers();
  if(!users.some(u=>u.user==='gelson.osorio')){
   users.push({user:'gelson.osorio',name:'Gelson Osorio',enabled:false,permissions:['areiaamigos'],passwordHash:'',sessionVersion:0,createdAt:new Date().toISOString()});
   await writeDocument('app-users',users);
  }
  const builtin=[
   {user:process.env.APP_USER||'admin',name:'Paulo',enabled:true,role:'admin',permissions:['*'],source:'environment',protected:true},
   {user:process.env.ALISSON_USER||'alisson',name:'Alisson Santos',enabled:!!process.env.ALISSON_PASSWORD,role:'operator',permissions:['operacional'],source:'environment',protected:true}
  ];
  return reply(res,200,{users:[...builtin,...users.map(({passwordHash,...u})=>u)]});
 }
 if(path==='/api/users'&&req.method==='POST'){
  if(!isAdmin(req))return reply(res,403,{error:'Acesso exclusivo do administrador.'});
  if(!allowedOrigin(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json'))return reply(res,403,{error:'Origem não autorizada.'});
  const input=await body(req),users=await managedUsers();
  const user=String(input.user||'').trim().toLowerCase(),name=String(input.name||'').trim();
  if(!/^[a-z][a-z0-9._-]{2,39}$/.test(user)||name.length<3||name.length>100)return reply(res,400,{error:'Informe nome e usuário válido (3 a 40 caracteres).'});
  if(user===process.env.APP_USER||user===(process.env.ALISSON_USER||'alisson')||users.some(u=>u.user===user))return reply(res,409,{error:'Usuário já existe.'});
  const password=String(input.password||'');
  if(password&&password.length<6)return reply(res,400,{error:'A senha deve ter pelo menos 6 caracteres.'});
  users.push({user,name,enabled:!!password,permissions:['areiaamigos'],passwordHash:password?hashPassword(password):'',sessionVersion:0,createdAt:new Date().toISOString()});
  await writeDocument('app-users',users);
  await audit(req,'criar','usuarios',{user});
  return reply(res,201,{ok:true});
 }
 if(path.startsWith('/api/users/')&&req.method==='PATCH'){
  if(!isAdmin(req))return reply(res,403,{error:'Acesso exclusivo do administrador.'});
  if(!allowedOrigin(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json'))return reply(res,403,{error:'Origem não autorizada.'});
  const user=decodeURIComponent(path.slice('/api/users/'.length)),input=await body(req),users=await managedUsers(),found=users.find(x=>x.user===user);
  if(!found)return reply(res,404,{error:'Conta existente gerenciada pelas variáveis do Railway. Para alterar seu acesso ou senha, atualize as variáveis correspondentes.'});
  if(Object.hasOwn(input,'password')){
   if(typeof input.password!=='string'||input.password.length<6)return reply(res,400,{error:'Senha deve ter pelo menos 6 caracteres.'});
   found.passwordHash=hashPassword(input.password);found.sessionVersion=(found.sessionVersion||0)+1;
  }
  if(Object.hasOwn(input,'enabled')){
   if(typeof input.enabled!=='boolean')return reply(res,400,{error:'Status inválido.'});
   if(input.enabled&&!found.passwordHash)return reply(res,400,{error:'Defina uma senha antes de liberar o acesso.'});
   found.enabled=input.enabled;
   found.sessionVersion=(found.sessionVersion||0)+1;
  }
  if(Object.hasOwn(input,'name')){
   if(typeof input.name!=='string'||input.name.trim().length<3)return reply(res,400,{error:'Nome inválido.'});
   found.name=input.name.trim().slice(0,100);
  }
  await writeDocument('app-users',users);await audit(req,'alterar','usuarios',{user,enabled:found.enabled});
  return reply(res,200,{ok:true});
 }
 if(path==='/api/health'&&req.method==='GET')return reply(res,200,{app:'colafix-compras-mrp',version:2,database:!!process.env.DATABASE_URL});
 if(path==='/api/online'&&req.method==='GET'){if(!isAdmin(req))return reply(res,403,{error:'Acesso exclusivo do administrador.'});const now=Date.now(),active=new Map();for(const s of sessions.values()){if(now-(s.lastSeen||s.createdAt)>120000)continue;const key=s.account.user;const prev=active.get(key);if(!prev||prev.lastSeen<s.lastSeen)active.set(key,{user:key,name:s.account.name,role:s.account.role,lastSeen:s.lastSeen});}return reply(res,200,{users:[...active.values()].sort((a,b)=>b.lastSeen-a.lastSeen),checkedAt:now,windowSeconds:120});}
 if(path==='/api/me'&&req.method==='GET'){const token=cookies(req).colafix_session;if(token&&sessions.has(token))sessions.get(token).lastSeen=Date.now();const c=credentials(req);return reply(res,200,{ok:true,user:c?.user,name:c?.name,role:c?.role});}
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
 if(path.startsWith('/api/areia-amigos/')&&req.method==='DELETE'){
  if(!allowedOrigin(req.headers.origin))return reply(res,403,{error:'Origem não autorizada.'});
  const id=decodeURIComponent(path.slice('/api/areia-amigos/'.length));
  if(!id)return reply(res,400,{error:'Identificador obrigatório.'});
  if(busy)return reply(res,409,{error:'Outra operação está em andamento. Tente novamente.'});
  busy=true;
  try{const stored=await readDocument('areia-amigos',[]),records=Array.isArray(stored)?stored:[];const item=records.find(r=>r.id===id);
   if(!item)return reply(res,404,{error:'Recebimento não encontrado.'});
   const updated=records.filter(r=>r.id!==id);await writeDocument('areia-amigos',updated);
   await audit(req,'excluir','areia-amigos',{id,receipt:item.receipt});
   return reply(res,200,{ok:true,records:updated});
  }finally{busy=false}
 }
 if(path==='/api/areia-amigos'&&req.method==='GET'){const records=await readDocument('areia-amigos',[]);return reply(res,200,{records:Array.isArray(records)?records:[]});}
 if(path.startsWith('/api/cement/')&&req.method==='DELETE'){
  if(!isAdmin(req))return reply(res,403,{error:'Somente o administrador pode excluir cargas.'});
  if(!allowedOrigin(req.headers.origin))return reply(res,403,{error:'Origem não autorizada.'});
  const id=decodeURIComponent(path.slice('/api/cement/'.length));
  if(!id)return reply(res,400,{error:'Identificador obrigatório.'});
  const removed=await deleteCementLoad(root,id);
  await audit(req,'excluir','cement',{id:removed.id,kind:removed.kind,scheduledDate:removed.scheduledDate,systemOrder:removed.systemOrder});
  return reply(res,200,{ok:true});
 }
 if(path==='/api/supplier-catalog-search'&&req.method==='GET'){const q=String(new URL(req.url,'http://localhost').searchParams.get('q')||'').trim().toLocaleLowerCase('pt-BR');if(q.length<2)return reply(res,200,{ids:[]});const records=await readDocument('supplier-contacts',[]);const ids=[];for(const contact of Array.isArray(records)?records:[]){if(!(contact.hasCatalog||contact.catalog))continue;try{let file=await getSupplierCatalog(contact.id);let buffer=file?.content||(contact.catalog?Buffer.from(contact.catalog.split(',')[1]||'','base64'):null);if(!buffer)continue;const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');const task=getDocument({data:new Uint8Array(buffer),useSystemFonts:true,disableFontFace:true});const doc=await task.promise;let found=false;for(let i=1;i<=Math.min(doc.numPages,300);i++){const page=await doc.getPage(i);const content=await page.getTextContent();const pageText=content.items.map(x=>x.str||'').join(' ').toLocaleLowerCase('pt-BR');if(pageText.includes(q)){found=true;break}}await doc.destroy();if(found)ids.push(contact.id)}catch(error){console.warn('Catalog search skipped',contact.id,error.message)}}return reply(res,200,{ids});}
 if(path.startsWith('/api/supplier-catalog/')&&req.method==='GET'){const id=decodeURIComponent(path.slice('/api/supplier-catalog/'.length));const stored=await readDocument('supplier-contacts',[]);const contact=Array.isArray(stored)?stored.find(x=>x.id===id):null;if(!contact)return reply(res,404,{error:'Contato não encontrado'});const file=await getSupplierCatalog(id);if(file){res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="catalogo.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(file.content)}if(contact.catalog){const raw=Buffer.from(contact.catalog.split(',')[1]||'','base64');res.writeHead(200,{'Content-Type':'application/pdf','Content-Disposition':'inline; filename="catalogo.pdf"','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});return res.end(raw)}return reply(res,404,{error:'Catálogo não encontrado'});}
 if(path.startsWith('/api/supplier-catalog/')&&req.method==='POST'){if(!allowedOrigin(req.headers.origin))return reply(res,403,{error:'Origem não autorizada'});const id=decodeURIComponent(path.slice('/api/supplier-catalog/'.length));const stored=await readDocument('supplier-contacts',[]);const records=Array.isArray(stored)?stored:[];const contact=records.find(x=>x.id===id);if(!contact)return reply(res,404,{error:'Contato não encontrado'});let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>30*1024*1024)return reply(res,413,{error:'PDF excede o limite de 30 MB por arquivo'});chunks.push(chunk)}const buffer=Buffer.concat(chunks);if(buffer.subarray(0,5).toString()!=='%PDF-')return reply(res,400,{error:'Arquivo PDF inválido'});const name=String(req.headers['x-catalog-name']||'catalogo.pdf').slice(0,180);await saveSupplierCatalog(id,name,buffer);contact.catalog='';contact.catalogName=name;contact.hasCatalog=true;await writeDocument('supplier-contacts',records);return reply(res,200,{ok:true});}
 if(path.startsWith('/api/supplier-catalog/')&&req.method==='DELETE'){if(!allowedOrigin(req.headers.origin))return reply(res,403,{error:'Origem não autorizada'});const id=decodeURIComponent(path.slice('/api/supplier-catalog/'.length));const records=await readDocument('supplier-contacts',[]);const contact=Array.isArray(records)?records.find(x=>x.id===id):null;if(!contact)return reply(res,404,{error:'Contato não encontrado'});await deleteSupplierCatalog(id);contact.catalog='';contact.catalogName='';contact.hasCatalog=false;await writeDocument('supplier-contacts',records);return reply(res,200,{ok:true});}
 if(path==='/api/supplier-contacts'&&req.method==='GET'){
  const records=await readDocument('supplier-contacts',[]);
  return reply(res,200,{records:Array.isArray(records)?records:[]});
 }
 if(path==='/api/supplier-contacts'&&req.method==='POST'){
  if(!allowedOrigin(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json'))return reply(res,403,{error:'Origem não autorizada.'});
  const input=await body(req);
  const clean=(value,max=160)=>String(value??'').trim().slice(0,max);
  const company=clean(input.company),name=clean(input.name);
  if(!company||!name)return reply(res,400,{error:'Informe empresa e nome do contato.'});
  const phone=clean(input.phone,30),email=clean(input.email,180),category=clean(input.category,90)||'Outros';
  const materials=clean(input.materials,500),notes=clean(input.notes,1000),role=clean(input.role,100);const catalogUrl=clean(input.catalogUrl,1200);if(catalogUrl&&!/^https?:\/\/[^\s]+$/i.test(catalogUrl))return reply(res,400,{error:'Informe um link válido de catálogo online.'});
  const photo=clean(input.photo,200000);
  const catalog=clean(input.catalog,3000000),catalogName=clean(input.catalogName,180);if(catalog&&!/^data:application\/pdf;base64,[A-Za-z0-9+/=]+$/.test(catalog))return reply(res,400,{error:'Catálogo PDF inválido.'});
  if(photo&&!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(photo))return reply(res,400,{error:'Imagem inválida.'});
  const stored=await readDocument('supplier-contacts',[]),records=Array.isArray(stored)?stored:[];
  const id=clean(input.id,80),previous=id?records.find(r=>r.id===id):null;
  if(id&&!previous)return reply(res,404,{error:'Contato não encontrado.'});
  if(records.length>=1500&&!previous)return reply(res,400,{error:'Limite de contatos atingido.'});
  const now=new Date().toISOString();
  const record={id:previous?.id||randomUUID(),company,name,phone,email,category,materials,notes,role,photo,catalog,catalogName,catalogUrl,hasCatalog:!!(input.hasCatalog||catalog),favorite:!!input.favorite,createdAt:previous?.createdAt||now,updatedAt:now};
  const updated=previous?records.map(r=>r.id===id?record:r):[...records,record];
  await writeDocument('supplier-contacts',updated);
  await audit(req,previous?'editar':'salvar','supplier-contact',{id:record.id,company});
  return reply(res,200,{ok:true,record});
 }
 if(path.startsWith('/api/supplier-contacts/')&&req.method==='DELETE'){
  if(!allowedOrigin(req.headers.origin))return reply(res,403,{error:'Origem não autorizada.'});
  const id=decodeURIComponent(path.slice('/api/supplier-contacts/'.length));
  const stored=await readDocument('supplier-contacts',[]),records=Array.isArray(stored)?stored:[];
  if(!records.some(r=>r.id===id))return reply(res,404,{error:'Contato não encontrado.'});
  await writeDocument('supplier-contacts',records.filter(r=>r.id!==id));await deleteSupplierCatalog(id);
  await audit(req,'excluir','supplier-contact',{id});
  return reply(res,200,{ok:true});
 }
 if(path==='/api/cement'&&req.method==='GET')return reply(res,200,await readLoads(root));
 if(path==='/api/diesel'&&req.method==='GET')return reply(res,200,await readDiesel(root));
 if(path==='/api/diesel-prices'&&req.method==='GET')return reply(res,200,{prices:await readDocument('diesel-prices',[])});
 if(path==='/api/deadlines'&&req.method==='GET')return reply(res,200,await readDeliveryDeadlines(root));
 if(path==='/api/maintenance-deadlines'&&req.method==='GET')return reply(res,200,await readMaintenanceDeadlines(root));
 if(path==='/api/indirect-materials/parse-pdf'&&req.method==='POST'){
  if(!allowedOrigin(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json'))return reply(res,403,{error:'Origem não autorizada.'});
  const input=await body(req),kind=input.kind;
  if(!['profile','stock'].includes(kind)||typeof input.content!=='string'||input.content.length>18000000)return reply(res,400,{error:'PDF inválido ou muito grande.'});
  const bytes=Buffer.from(input.content,'base64');
  if(bytes.subarray(0,5).toString()!=='%PDF-')return reply(res,400,{error:'O arquivo não é PDF.'});
  const folder=await mkdtemp(join(tmpdir(),'indirect-pdf-')),target=join(folder,'report.pdf');
  try{
   await writeFile(target,bytes);
   const p=spawn(python,[join(root,'scripts/import_indirect_pdf.py'),target,kind],{windowsHide:true,env:{...process.env,PYTHONIOENCODING:'utf-8'}});
   let output='',errors='';
   p.stdout.on('data',d=>output+=d);p.stderr.on('data',d=>errors+=d);
   const exitCode=await new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',resolve)});
   let result;try{result=JSON.parse(output)}catch{throw Error(errors||'Falha na leitura do PDF.')}
   if(exitCode!==0||result.error)throw Error(result.error||errors||'Falha ao interpretar PDF.');
   return reply(res,200,result);
  }finally{await rm(folder,{recursive:true,force:true})}
 }
 if(path==='/api/indirect-materials'&&req.method==='GET')return reply(res,200,{items:await readDocument('indirect-materials',[]),history:await readDocument('indirect-materials-history',[])});
 if(path==='/api/indirect-materials'&&req.method==='POST'){
  if(!allowedOrigin(req.headers.origin)||!req.headers['content-type']?.startsWith('application/json'))return reply(res,403,{error:'Origem não autorizada.'});
  const payload=await body(req),items=payload.items;
  if(!Array.isArray(items)||items.length>10000||items.some(x=>!x||typeof x.id!=='string'||x.id.length>200||typeof x.code!=='string'||x.code.length>80))return reply(res,400,{error:'Dados inválidos.'});
  await writeDocument('indirect-materials',items);
  if(payload.history!==undefined){if(!Array.isArray(payload.history)||payload.history.length>1000)return reply(res,400,{error:'Histórico inválido.'});await writeDocument('indirect-materials-history',payload.history);}
  await audit(req,'atualizar','indirect-materials',{total:items.length});
  return reply(res,200,{ok:true,count:items.length});
 }
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
  // Mantém os campos anteriores e inclui TODOS os documentos e a auditoria do PostgreSQL.
  // A exportação é somente leitura: nenhum cadastro é alterado ou apagado.
  const snapshot=process.env.DATABASE_URL?await exportDatabaseSnapshot():null;
  const backup={format:'colafix-compras-backup',version:2,createdAt:new Date().toISOString(),
    documents:{main,cement,diesel,deadlines,maintenance},
    database:snapshot,
    warning:snapshot?null:'Banco PostgreSQL indisponível: backup parcial dos módulos legados; não é cópia completa.'
  };
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
  if(!process.env.GEMINI_API_KEY)return reply(res,503,{error:'Configure GEMINI_API_KEY no Railway para ativar a leitura por IA.'});
  const image=String(input.image||'');
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if(!match||image.length>7e6)return reply(res,400,{error:'Imagem inválida ou acima de 5 MB.'});
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),55000);
  try{
   const instruction='Leia apenas esta foto do recibo Areia dos Amigos. Extraia JSON com receipt, date (YYYY-MM-DD), time (HH:MM), client, plate, quantities (array de 5 valores na ordem Areia Fina Branca, Areia Fina Amarelinha, Areia Média, Aterro, Areia), total (valor numérico em reais), warnings (array de strings), uncertain_fields (array de nomes dos campos receipt, date, time, client, plate, total, qty0, qty1, qty2, qty3, qty4 com leitura duvidosa). Marque uncertain_fields para qualquer campo com rasura, ambiguidade, dígitos semelhantes ou data incerta, mesmo que tenha preenchido um valor. Use null se um campo manuscrito não estiver legível. O número do recibo está no cabeçalho ao lado de Nº e NÃO é o número da rua. Leia cliente, placa, data e hora nos respectivos campos. Leia as quantidades na coluna à esquerda de cada linha de material. O total é o valor manuscrito no canto inferior direito, NÃO valores do rodapé impresso. Não copie dados de outros recibos. Não invente. Atenção especial à DATA: leia separadamente DIA, MÊS e ANO manuscritos no campo Data, olhando atentamente os dois algarismos do mês. Não confunda 10 (outubro) com 01 (janeiro). Não use a data atual, a data de outros recibos nem uma suposição. Se o mês for ambíguo, retorne date:null e inclua date em uncertain_fields, explicando em warnings. Confira que o mês de date corresponde exatamente aos algarismos visíveis antes de responder.';
   const configured=process.env.GEMINI_MODEL;
   const headers={'x-goog-api-key':process.env.GEMINI_API_KEY,'Content-Type':'application/json'};
   const preferred=[configured,'gemini-3.8-flash','gemini-3.5-flash-lite'].filter(Boolean);
   let available=[];
   try{
    const listing=await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=100',{headers:{'x-goog-api-key':process.env.GEMINI_API_KEY},signal:ctrl.signal});
    if(listing.ok){const data=await listing.json();available=(data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')&&/gemini/i.test(m.name)&&/flash/i.test(m.name)).map(m=>m.name.replace(/^models\//,''))}
   }catch(e){if(e.name==='AbortError')throw e}
   const models=[...new Set([...preferred,...available])].filter(m=>!available.length||available.includes(m));
   if(!models.length)throw Error('A chave não retornou modelos Gemini Flash disponíveis. Confira o acesso no Google AI Studio.');
   let j=null;const failures=[];
   for(const model of models){
    try{
     const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent',{method:'POST',headers,body:JSON.stringify({contents:[{role:'user',parts:[{text:instruction},{inlineData:{mimeType:match[1],data:match[2]}}]}],generationConfig:{responseMimeType:'application/json',temperature:0}}),signal:ctrl.signal});
     const result=await response.json();
     if(response.ok){j=result;break}
     const reason=String(result.error?.message||'HTTP '+response.status).slice(0,130);
     failures.push(model+': HTTP '+response.status+' — '+reason);
     if(![404,429,500,502,503,504].includes(response.status))break;
    }catch(err){if(err.name==='AbortError')throw err;failures.push(model+': '+String(err.message).slice(0,130))}
   }
   if(!j)throw Error('Modelos Gemini sem resposta: '+failures.join(' | '));
   const raw=j.candidates?.[0]?.content?.parts?.filter(p=>typeof p.text==='string').map(p=>p.text).join('');if(!raw)throw Error('Gemini não retornou texto para o recibo.');
   const d=JSON.parse(raw);
   const numeric=v=>{if(v==null||v==='')return null;const n=Number(typeof v==='string'?v.replace(/\./g,'').replace(',','.'):v);return Number.isFinite(n)&&n>=0?n:null};
   const clean={receipt:d.receipt==null?null:String(d.receipt).replace(/\D/g,'').slice(0,10),date:/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')?d.date:null,time:/^\d{2}:\d{2}$/.test(d.time||'')?d.time:null,client:d.client==null?null:String(d.client).slice(0,150),plate:d.plate==null?null:String(d.plate).toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8),quantities:Array.from({length:5},(_,i)=>numeric(d.quantities?.[i])),total:numeric(d.total),warnings:Array.isArray(d.warnings)?d.warnings.slice(0,5).map(String):[],uncertain_fields:Array.isArray(d.uncertain_fields)?d.uncertain_fields.filter(x=>['receipt','date','time','client','plate','total','qty0','qty1','qty2','qty3','qty4'].includes(x)):[]};
   return reply(res,200,{ok:true,data:clean});
  }catch(e){return reply(res,502,{error:e.name==='AbortError'?'Tempo limite excedido ao consultar o Gemini.':e.message})}finally{clearTimeout(timer)}
 }
 if(path==='/api/areia-amigos'){if(!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(input.image||'')||input.image.length>7e6)throw Error('Anexe uma imagem JPG, PNG ou WEBP de até 5 MB.');if(!/^\d{4}-\d{2}-\d{2}$/.test(input.date||'')||!String(input.receipt||'').trim())throw Error('Informe a data e o número do recibo.');const previous=await readDocument('areia-amigos',[]),records=Array.isArray(previous)?previous:[];const duplicate=records.find(x=>String(x.receipt||'').trim()===String(input.receipt||'').trim()&&String(x.id)!==String(input.id||''));if(duplicate)return reply(res,409,{error:'Recibo nº '+String(input.receipt).trim()+' já está cadastrado. Não é permitido salvar recibos duplicados.'});const entry={id:String(input.id||randomUUID()),receipt:String(input.receipt).trim().slice(0,80),date:input.date,time:String(input.time||'').slice(0,5),client:String(input.client||'').slice(0,180),plate:String(input.plate||'').slice(0,32),total:Number(input.total)||0,quantities:Array.from({length:5},(_,i)=>Math.max(0,Number(input.quantities?.[i])||0)),image:input.image,updatedAt:new Date().toISOString()};const index=records.findIndex(x=>x.id===entry.id);if(index>=0)records[index]=entry;else records.unshift(entry);await writeDocument('areia-amigos',records);await audit(req,'salvar','areia-amigos',{id:entry.id,receipt:entry.receipt});return reply(res,200,{ok:true,records});}
 if(path==='/api/cement'){const load=await saveLoad(root,input);await audit(req,'salvar','cement',{id:load?.id||input.id||'',status:load?.status||input.status||''});return reply(res,200,{ok:true,load});}if(path==='/api/cement-bag-products'){const products=await saveBagProducts(root,input);await audit(req,'salvar','cement-bag-products',{count:products.length});return reply(res,200,{ok:true,products});}if(path==='/api/cement-bag-prices'){const bagPrices=await saveBagPrices(root,input);await audit(req,'salvar','cement-bag-prices',{period:bagPrices.period||'',updatedAt:bagPrices.updatedAt||''});return reply(res,200,{ok:true,bagPrices});}if(path==='/api/cement-monthly-order'){const orders=await saveMonthlyOrder(root,input);await audit(req,'salvar','cement-monthly-order',{supplier:input.supplier||''});return reply(res,200,{ok:true,orders});}
   if(path==='/api/diesel-prices'){const price=Number(input.price),date=String(input.date||''),company=String(input.company||'Todas');if(!Number.isFinite(price)||price<=0||price>1000||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!['Todas','Colafix','Fixcol','Argamazza'].includes(company))return reply(res,400,{error:'Informe uma data e um preço por litro válidos.'});const current=await readDocument('diesel-prices',[]);const record={id:randomUUID(),date,company,price,createdAt:new Date().toISOString()};const prices=[...current,record].slice(-1000);await writeDocument('diesel-prices',prices);await audit(req,'salvar','diesel-prices',{id:record.id,date,company,price});return reply(res,200,{ok:true,prices});}
   if(path==='/api/diesel'){const load=await saveDiesel(root,input);await audit(req,'salvar','diesel',{id:load?.id||input.id||'',status:load?.status||input.status||''});return reply(res,200,{ok:true,load});}
   if(path==='/api/maintenance-deadlines'){const order=await saveMaintenanceDeadline(root,input);await audit(req,'salvar','maintenance-deadlines',{id:order?.id||input.id||''});return reply(res,200,{ok:true,order});}
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
   if(path==='/api/deadlines/import-pdf'||path==='/api/maintenance-deadlines/import-pdf'){
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
 if(path.startsWith('/images/')){
  let imageName;
  try{imageName=decodeURIComponent(path.slice('/images/'.length));}catch{return reply(res,404,{error:'Imagem não encontrada.'});}
  if(!/^(?:mp\/)?[^/\\\\]+\.(?:png|jpg|jpeg|webp|svg)$/i.test(imageName)||imageName.includes('..'))return reply(res,404,{error:'Imagem não encontrada.'});
  const content=await readFile(join(root,'dist','images',...imageName.split('/')));
  const extension=imageName.split('.').pop().toLowerCase();
  const imageType={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'}[extension];
  res.writeHead(200,{'Content-Type':imageType,'Cache-Control':'public, max-age=3600'});res.end(content);return;
 }
 const file=files[path];if(!file)return reply(res,404,{error:'Não encontrado.'});const content=await readFile(join(root,'dist',file));res.writeHead(200,{'Content-Type':types[file.split('.').pop()],'Cache-Control':'no-store'});res.end(content);
}catch(e){reply(res,400,{error:e.message});}}).listen(port,host,()=>console.log(`Monitoramento MRP: http://${host}:${port}`));
