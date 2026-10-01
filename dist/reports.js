(()=>{
const modules=[
 ['diesel-view','Diesel'],['granel-view','Cimento a granel'],['ensacado-view','Cimento ensacado'],
 ['prazos-view','Prazos de entrega'],['mpquotes-view','Cotações de MP'],['manutencao-view','Compras Manutenção']
];
const clean=s=>String(s??'').replace(/\s+/g,' ').trim();
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function visible(el){const st=getComputedStyle(el);return st.display!=='none'&&st.visibility!=='hidden'&&!el.hidden}
function filters(root){
 return [...root.querySelectorAll('select,input[type="date"],input[type="month"],input[type="search"]')]
 .filter(visible).map(x=>{const l=x.closest('label');return [clean(l?.childNodes?.[0]?.textContent||x.getAttribute('aria-label')||x.placeholder||x.name),clean(x.options?x.options[x.selectedIndex]?.text:x.value)]})
 .filter(x=>x[0]&&x[1]);
}
function tableRows(root){
 const tables=[...root.querySelectorAll('table')].filter(visible);
 if(tables.length){const t=tables.sort((a,b)=>b.rows.length-a.rows.length)[0];return [...t.rows].map(r=>[...r.cells].map(c=>clean(c.innerText))).filter(r=>r.some(Boolean))}
 const cards=[...root.querySelectorAll('article,.cement-card,.diesel-card,.maintenance-card,.mpq-card')].filter(visible);
 if(!cards.length)return [];
 const parsed=cards.map(c=>{const obj={};clean(c.innerText).split(/\n+/).forEach((line,i)=>{const p=line.indexOf(':');if(p>0)obj[clean(line.slice(0,p))]=clean(line.slice(p+1));else if(i<2)obj[i?'Descrição':'Registro']=line});return obj});
 const heads=[...new Set(parsed.flatMap(Object.keys))];return [heads,...parsed.map(o=>heads.map(h=>o[h]||''))];
}
function current(root){let rows=tableRows(root);if(!rows.length)rows=[['Informação'],['Nenhum registro visível com os filtros atuais.']];return rows}
function report(title,root){
 const rows=current(root),fs=filters(root),date=new Date().toLocaleString('pt-BR');
 const th=rows[0],body=rows.slice(1);
 const html='<!doctype html><html><head><meta charset="utf-8"><title>'+esc(title)+'</title><style>@page{size:A4 landscape;margin:10mm}body{font:11px Arial;color:#20252b}h1{margin:0;font-size:22px}h2{font-size:13px;color:#666;margin:4px 0 16px}.meta{display:flex;gap:18px;flex-wrap:wrap;margin:12px 0;padding:8px;background:#f3f4f6}.meta b{margin-right:4px}table{width:100%;border-collapse:collapse}th{background:#343a40;color:white}th,td{border:1px solid #cfd4da;padding:6px;text-align:left}tr:nth-child(even){background:#f7f7f7}.foot{margin-top:12px;color:#666}</style></head><body><h1>COLAFIX · '+esc(title)+'</h1><h2>Relatório operacional</h2><div class="meta">'+fs.map(x=>'<span><b>'+esc(x[0])+':</b>'+esc(x[1])+'</span>').join('')+'</div><table><thead><tr>'+th.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+body.map(r=>'<tr>'+th.map((_,i)=>'<td>'+esc(r[i]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table><div class="foot">Emitido em '+esc(date)+' · Registros: '+body.length+'</div></body></html>';
 const w=open('','_blank');w.document.write(html);w.document.close();setTimeout(()=>w.print(),250)
}
function excel(title,root){
 const rows=current(root),fs=filters(root);
 const all=[[title],['Relatório operacional'],...fs.map(x=>[x[0],x[1]]),[],...rows];
 const xml='<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Relatório"><Table>'+all.map(r=>'<Row>'+r.map(v=>'<Cell><Data ss:Type="String">'+esc(v)+'</Data></Cell>').join('')+'</Row>').join('')+'</Table></Worksheet></Workbook>';
 const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([xml],{type:'application/vnd.ms-excel'}));a.download=title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')+'.xls';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)
}
function mount(){
 modules.forEach(([id,title])=>{const root=document.getElementById(id);if(!root||root.querySelector('.report-actions'))return;const box=document.createElement('div');box.className='report-actions';box.innerHTML='<strong>Relatórios</strong><span>Usa os filtros visíveis desta tela</span><button type="button">🖨 Imprimir relatório</button><button type="button">📊 Baixar Excel</button>';box.children[2].onclick=()=>report(title,root);box.children[3].onclick=()=>excel(title,root);root.prepend(box)})
}
new MutationObserver(()=>mount()).observe(document.body,{childList:true,subtree:true});mount();
})();