// Relatório visual de Matéria-prima — leitura dos dados atuais, sem mutações.
const el=document.getElementById('mp-relatorio-view');
let all=[],picked=new Set(),shown=false,query='',status='',reportDate='',pendingOrders=[],deliveryError='';
const number=v=>{if(typeof v==='number')return v;const x=String(v??'').trim().replace(/\s/g,'');return Number(x.includes(',')?x.replace(/\./g,'').replace(',','.'):x)||0};
const dateKey=v=>{const s=String(v||'').slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;const m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);return m?`${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`:''};
const formatDate=v=>{const d=dateKey(v);return d?d.split('-').reverse().join('/'):'—'};
const normalize=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().trim();
function deliveryFor(item){const code=normalize(item.id),matches=pendingOrders.filter(r=>normalize(r.code)===code&&normalize(r.status)!=='CANCELADO'&&normalize(r.status)!=='ENTREGUE').map(r=>({...r,remaining:Math.max(0,number(r.quantity)-number(r.deliveredQuantity)),date:dateKey(r.newDate)||dateKey(r.deliveryDate)})).filter(r=>r.remaining>0).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999'));return matches[0]||null}
async function refreshDeliveries(){try{const r=await fetch('/api/deadlines',{cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);const j=await r.json();pendingOrders=Array.isArray(j.orders)?j.orders:[];deliveryError='';}catch(e){deliveryError='Não foi possível consultar os pedidos: '+e.message;}if(all.length)draw()}

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null||!Number.isFinite(Number(v))?'—':new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2}).format(Number(v));
const pic=name=>{
 const n=String(name||'').toUpperCase();
 const photo=/FILME.*STRETCH|STRETCH/.test(n)?'/images/mp/Rolo%20de%20Filme%20Stretch%20Transl%C3%BAcido.png':/GESSO/.test(n)?'/images/mp/Saco%20de%20Gesso%2040%20kg%20em%20Destaque.png':/DOLOMITA.*(100|325)|DOLOMITA/.test(n)?'/images/mp/Big%20Bag%20Branco%20com%20Granulado%20Cinza.png':null;
 if(photo)return '<img class="mp-report-picture mp-report-photo" src="'+photo+'" alt="'+esc(name)+'" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'"><span class="mp-report-fallback" style="display:none">📦</span>';

 const kind=/PALETE|PALLET/.test(n)?'pallet':/FILME|STRETCH|BOBINA/.test(n)?'film':/SACARIA|SACO|CIMENTO|GESSO|CALCÁRIO|AREIA|ARGAMASSA/.test(n)?'bag':'box';
 const shapes={
 pallet:'<path d="M28 85h150v16H28zm10-22h130v20H38zm-6 38h18v15H32zm53 0h18v15H85zm62 0h18v15h-18z" fill="#b9804a" stroke="#e5b17d" stroke-width="3"/><path d="M38 63l24-30h86l20 30M62 33v30m43-30v30m43-30v30" fill="none" stroke="#f5c28a" stroke-width="6"/>',
 film:'<g transform="rotate(-16 105 80)"><rect x="28" y="45" width="155" height="31" rx="15" fill="#e1e9ef" stroke="#9bc4e3" stroke-width="4"/><rect x="25" y="76" width="155" height="31" rx="15" fill="#91d4ff" stroke="#d6efff" stroke-width="4"/><ellipse cx="25" cy="91" rx="12" ry="15" fill="#a2b7c6"/><ellipse cx="25" cy="91" rx="5" ry="8" fill="#41576b"/></g>',
 bag:'<path d="M59 26h90l-7 23 13 73H52l13-73z" fill="#e8d9bd" stroke="#f6ebd5" stroke-width="5"/><path d="M65 49h77m-74 15h70m-65 14h62" stroke="#bea789" stroke-width="3"/><path d="M78 26l-5 19m59-19l5 19" stroke="#fff0d7" stroke-width="4"/>',
 box:'<path d="M42 53l58-26 64 26v65l-64 26-58-26z" fill="#c9a77a" stroke="#f2d3a6" stroke-width="4"/><path d="M42 53l58 31 64-31M100 84v60" stroke="#f2d3a6" stroke-width="4" fill="none"/>'
 };
 return '<svg class="mp-report-picture" viewBox="0 0 210 155" role="img" aria-label="Ilustração de '+esc(kind==='pallet'?'palete':kind==='film'?'filme plástico':kind==='bag'?'sacaria':'material')+'"><defs><radialGradient id="mpglow"><stop stop-color="#21446a"/><stop offset="1" stop-color="#0c1b2b"/></radialGradient></defs><rect width="210" height="155" fill="url(#mpglow)"/>'+shapes[kind]+'</svg>';
};
function card(i){
 const st=String(i.status||'Revisar dados'),cl=st==='Crítico'?'critical':st==='Atenção'?'attention':st==='Ok'?'ok':'review';
 const cover=i.warehouseCoverage??i.coverage;const delivery=deliveryFor(i);const due=delivery?.date;const late=!!due&&due<new Date().toLocaleDateString('en-CA');const deliveryText=delivery?formatDate(due):deliveryError?'Indisponível':'—';const deliveryStatus=delivery?(late?'Atrasado':number(delivery.deliveredQuantity)>0?'Parcial':'Pendente'):deliveryError?'Consulta indisponível':'Sem pedido cadastrado';
 return '<article class="mp-report-card '+cl+'"><div class="mp-report-card-top"><b>'+esc(i.id)+'</b><span class="mp-report-pill '+cl+'">'+esc(st)+'</span></div>'+pic(i.name)+'<h3 title="'+esc(i.name)+'">'+esc(i.name)+'</h3><div class="mp-report-unit">'+esc(i.unit||'UN')+'</div><div class="mp-report-kpis"><div>Saldo atual<strong>'+fmt(i.stock)+'</strong></div><div>Estoque seg.<strong>'+fmt(i.safetyStock??i.safety??i.securityStock)+'</strong></div><div>Consumo médio<strong>'+fmt(i.monthly??i.monthlyConsumption??i.consumption??i.averageConsumption)+'</strong></div><div>Autonomia do estoque<strong class="'+cl+'">'+fmt(cover)+' dias</strong></div></div><div class="mp-report-card-foot"><span>🚚 Próxima entrega<br><strong>'+esc(deliveryText)+(delivery?' · '+fmt(delivery.remaining)+' '+esc(i.unit||'UN'):'')+'</strong></span><span>Situação<br><strong>'+esc(deliveryStatus)+'</strong></span></div></article>';
}
function draw(){
 if(!el)return;
 const available=all.filter(i=>(!query||(i.id+' '+i.name).toLocaleLowerCase('pt-BR').includes(query))&&(!status||i.status===status));
 const chosen=available.filter(i=>picked.has(i.id));
 el.innerHTML='<div class="mp-report-header"><div><h2>Relatório de Materiais</h2><p>Layout 1 · Cards estilo Netflix · '+esc(reportDate||'Última análise')+'</p></div><div class="mp-report-tools"><input id="mp-report-search" type="search" placeholder="Buscar item na lista..." value="'+esc(query)+'"><button id="mp-report-select">☷ Selecionar itens</button><button id="mp-report-generate" class="primary">▥ Gerar relatório</button><button id="mp-report-print">▣ Exportar PDF</button></div></div><div class="mp-report-selection"><label>Status <select id="mp-report-status"><option value="">Todos</option>'+['Crítico','Atenção','Ok','Revisar dados','Sem consumo'].map(x=>'<option '+(status===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label><span>'+picked.size+' selecionado(s) · '+all.length+' materiais disponíveis</span><button id="mp-report-all">Selecionar visíveis</button><button id="mp-report-clear">Limpar seleção</button></div><div id="mp-report-picklist" class="mp-report-picklist" '+(shown?'':'hidden')+'>'+available.map(i=>'<label><input type="checkbox" data-pick="'+esc(i.id)+'" '+(picked.has(i.id)?'checked':'')+'><span>'+esc(i.id)+' · '+esc(i.name)+'</span></label>').join('')+'</div><div id="mp-report-notice" class="mp-report-notice">'+(picked.size?'Exibindo os itens selecionados.':'Selecione os materiais e clique em Gerar relatório. Nenhum dado é alterado.')+'</div><div class="mp-report-grid">'+(chosen.length?chosen.map(card).join(''):'<p class="mp-report-empty">Nenhum item selecionado para o relatório.</p>')+'</div>';
 el.querySelector('#mp-report-search').oninput=e=>{query=e.target.value.toLocaleLowerCase('pt-BR');draw();const inp=el.querySelector('#mp-report-search');inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length)};
 el.querySelector('#mp-report-status').onchange=e=>{status=e.target.value;draw()};
 el.querySelector('#mp-report-select').onclick=()=>{shown=!shown;draw()};
 el.querySelector('#mp-report-all').onclick=()=>{available.forEach(i=>picked.add(i.id));draw()};
 el.querySelector('#mp-report-clear').onclick=()=>{picked.clear();draw()};
 el.querySelectorAll('[data-pick]').forEach(x=>x.onchange=e=>{if(e.target.checked)picked.add(x.dataset.pick);else picked.delete(x.dataset.pick);draw()});
 el.querySelector('#mp-report-generate').onclick=()=>{shown=false;draw();el.querySelector('#mp-report-notice').textContent= picked.size?'Relatório gerado com '+picked.size+' material(is) na data '+reportDate+'.':'Selecione pelo menos um material.'};
 el.querySelector('#mp-report-print').onclick=()=>{if(!picked.size){el.querySelector('#mp-report-notice').textContent='Selecione os materiais antes de exportar.';return}window.print()};
}
window.addEventListener('mp-report-data',e=>{const d=e.detail||{};all=Array.isArray(d.items)?d.items:[];reportDate=d.date||'';picked=new Set([...picked].filter(id=>all.some(i=>i.id===id)));draw()});
try{draw();window.dispatchEvent(new Event('mp-report-request'));}catch(error){console.error('Falha ao iniciar Relatório MP:',error);if(el)el.innerHTML='<div class="mp-report-notice">Não foi possível iniciar o relatório: '+String(error.message||error).replace(/[<>]/g,'')+'</div>';}

refreshDeliveries();window.addEventListener('focus',refreshDeliveries);
