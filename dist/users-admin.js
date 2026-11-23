const labels={'materia-prima':'Matéria-prima',insumos:'Insumos / EPIs',manutencao:'Manutenção',diesel:'Diesel',areiaamigos:'Areia Amigos',areiaadmin:'Administrar Areia Amigos','cimento-granel':'Cimento a granel','cimento-ensacado':'Cimento ensacado',fornecedores:'Agenda de Fornecedores'};
const form=document.querySelector('#user-form'),messageBox=document.querySelector('#message'),list=document.querySelector('#users');
let users=[],editing=null,passwordOnly=false;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function message(text,error=false){messageBox.innerHTML='<p class="status '+(error?'error':'')+'">'+esc(text)+'</p>';}
async function api(path,method='GET',body){const r=await fetch(path,{method,headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,cache:'no-store'});const j=await r.json();if(r.status===401){location.href='/logout';throw Error('Sessão encerrada. Entre novamente.');}if(!r.ok)throw Error(j.error||'Falha na operação.');return j;}
document.querySelector('#modules').innerHTML=Object.entries(labels).map(([key,label])=>'<label class="module-choice"><input type="checkbox" name="permissions" value="'+esc(key)+'"> <span>'+esc(label)+'</span></label>').join('');
function reset(){editing=null;passwordOnly=false;form.reset();form.elements.name.readOnly=false;form.elements.user.readOnly=false;form.elements.password.required=true;document.querySelector('#form-title').textContent='Novo usuário';document.querySelector('#password-hint').textContent='mínimo 8 caracteres';document.querySelector('#cancel').hidden=true;document.querySelector('#module-fieldset').disabled=false;}
function edit(u,onlyPassword=false){editing=u;passwordOnly=onlyPassword;form.reset();form.elements.name.value=u.name;form.elements.name.readOnly=onlyPassword;form.elements.user.value=u.user;form.elements.user.readOnly=true;form.elements.password.required=onlyPassword;for(const box of form.querySelectorAll('[name=permissions]'))box.checked=(u.permissions||[]).includes(box.value);document.querySelector('#module-fieldset').disabled=onlyPassword||u.role==='admin';document.querySelector('#form-title').textContent=(onlyPassword?'Redefinir senha de ':'Editar ')+u.user;document.querySelector('#password-hint').textContent=onlyPassword?'mínimo 8 caracteres':'deixe vazia para manter';document.querySelector('#cancel').hidden=false;form.scrollIntoView({behavior:'smooth'});}
function renderUsers(){
  const query=document.querySelector('#user-search').value.trim().toLocaleLowerCase('pt-BR'),status=document.querySelector('#status-filter').value;
  const visible=users.filter(u=>{const matches=(String(u.name||'')+' '+String(u.user||'')).toLocaleLowerCase('pt-BR').includes(query);return matches&&(status==='all'||((status==='active')===!!u.enabled));});
  document.querySelector('#list-count').textContent=visible.length+' '+(visible.length===1?'conta':'contas');
  list.innerHTML=visible.length?visible.map(u=>{
    const initials=String(u.name||u.user||'?').trim().split(/\s+/).slice(0,2).map(x=>x[0]).join('').toLocaleUpperCase('pt-BR');
    const modules=u.role==='admin'?['Acesso completo']:u.role==='operator'?['Acesso operacional']:(u.permissions||[]).map(x=>labels[x]||x);
    const tags=(modules.length?modules:['Sem módulos']).map(x=>'<span class="module-tag">'+esc(x)+'</span>').join('');
    const action=(id,label,extra='')=>'<button type="button" class="btn '+extra+'" data-action="'+id+'" data-user="'+esc(u.user)+'" aria-label="'+esc(label+' — '+u.user)+'">'+label+'</button>';
    const buttons=u.source==='environment'?'<p class="environment-note">Migre esta conta para gerenciá-la aqui.</p>':'<div class="user-actions">'+action('edit','Editar')+action('password','Redefinir senha')+(u.protected?'':action('toggle',u.enabled?'Inativar':'Reativar')+action('delete','Excluir','danger'))+'</div>';
    return '<article class="user-row"><div class="avatar '+(u.role==='admin'?'admin':'')+'" aria-hidden="true">'+esc(initials)+'</div><div class="user-main"><div class="user-heading"><strong>'+esc(u.name)+'</strong><span class="username">@'+esc(u.user)+'</span></div><div class="badges"><span class="badge '+(u.enabled?'active':'inactive')+'">'+(u.enabled?'Ativo':'Inativo')+'</span>'+(u.role==='admin'?'<span class="badge protected">Administrador</span>':'')+(u.protected?'<span class="badge protected">Conta protegida</span>':'')+(u.source==='environment'?'<span class="badge environment">Ambiente</span>':'')+'</div><div class="module-tags">'+tags+'</div>'+buttons+'</div></article>';
  }).join(''):'<div class="empty">Nenhuma conta encontrada para os filtros selecionados.</div>';
}
async function load(){
  const data=await api('/api/users');users=data.users||[];
  document.querySelector('#create-diego').hidden=users.some(u=>String(u.user).toLowerCase()==='diego');
  document.querySelector('#migration-wrap').hidden=!users.some(u=>u.source==='environment');
  document.querySelector('#stat-total').textContent=users.length;
  document.querySelector('#stat-active').textContent=users.filter(u=>u.enabled).length;
  document.querySelector('#stat-admin').textContent=users.filter(u=>u.role==='admin').length;
  renderUsers();
}
document.querySelector('#user-search').addEventListener('input',renderUsers);
document.querySelector('#status-filter').addEventListener('change',renderUsers);
form.addEventListener('submit',async e=>{e.preventDefault();const f=new FormData(form),payload=passwordOnly?{}:{name:String(f.get('name')).trim()},password=String(f.get('password')||'');if(password)payload.password=password;if(!editing){payload.user=String(f.get('user')).trim().toLowerCase();payload.permissions=f.getAll('permissions');}else if(!passwordOnly&&editing.role!=='admin')payload.permissions=f.getAll('permissions');try{await api(editing?'/api/users/'+encodeURIComponent(editing.user):'/api/users',editing?'PATCH':'POST',payload);reset();message('Usuário salvo.');await load();}catch(error){message(error.message,true);}});
document.querySelector('#cancel').onclick=reset;
document.querySelector('#create-diego').onclick=()=>{reset();form.elements.user.value='diego';form.elements.user.readOnly=true;form.elements.name.value='Diego';document.querySelector('#module-fieldset').disabled=true;form.elements.password.focus();message('Defina a senha inicial para criar o administrador protegido Diego.');};
document.querySelector('#migrate').onclick=async()=>{if(!confirm('Migrar as contas do ambiente para o banco? Será necessário entrar novamente.'))return;try{const r=await api('/api/users/migrate-environment','POST',{});if(r.count){location.href='/logout';return;}message('Nenhuma conta pendente de migração.');await load();}catch(e){message(e.message,true);}};
list.onclick=async event=>{const b=event.target.closest('[data-action]');if(!b)return;const u=users.find(x=>x.user===b.dataset.user);if(!u)return;if(b.dataset.action==='edit')return edit(u);if(b.dataset.action==='password'){edit(u,true);form.elements.password.focus();return;}try{if(b.dataset.action==='delete'){if(!confirm('Excluir o usuário '+u.user+'?'))return;await api('/api/users/'+encodeURIComponent(u.user),'DELETE');message('Usuário excluído.');}else{await api('/api/users/'+encodeURIComponent(u.user),'PATCH',{enabled:!u.enabled});message(u.enabled?'Usuário inativado.':'Usuário reativado.');}await load();}catch(e){message(e.message,true);}};
load().catch(e=>message(e.message,true));
async function loadOnline(){try{const data=await api('/api/online');document.querySelector('#online').innerHTML=(data.users||[]).map(u=>'<div class="online-row"><span class="online-dot" aria-hidden="true"></span><strong>'+esc(u.name)+'</strong><small>@'+esc(u.user)+'</small></div>').join('')||'<p class="online-empty">Nenhum usuário ativo no momento.</p>';}catch(error){document.querySelector('#online').textContent='Não foi possível consultar as sessões.';}}
loadOnline();setInterval(loadOnline,30000);
function applyTheme(){document.documentElement.dataset.theme=localStorage.getItem('colafix-theme')==='dark'?'dark':'light';}
document.querySelector('#theme').onclick=()=>{localStorage.setItem('colafix-theme',document.documentElement.dataset.theme==='dark'?'light':'dark');applyTheme();};applyTheme();
