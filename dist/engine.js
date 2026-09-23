// Regras extraídas do modelo Power BI. Correções documentadas em docs/REGRAS.md.
export const divide=(a,b)=>a==null||b==null||b===0?null:a/b;
export const days=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/86400000)+1;
export const addDays=(date,n)=>new Date(Date.parse(date)+n*86400000).toISOString().slice(0,10);
export const sum=rows=>rows.some(r=>r.qty!=null)?rows.reduce((s,r)=>s+(r.qty??0),0):null;
const group=(rows,key)=>{const m=new Map();for(const r of rows){const k=key(r);if(!m.has(k))m.set(k,[]);m.get(k).push(r);}return m;};
function one(rows,key){const v=[...new Set(rows.map(r=>r[key]))];return v.length===1?v[0]:null;}
export function createEngine(data){
 const catalog=new Map(data.catalog.map(r=>[r.id,r])),params=new Map(data.params.map(r=>[r.id,r]));
 const daily=group(data.daily,r=>r.date),weekly=group(data.weekly,r=>r.date),moves=group(data.movements,r=>r.date+'|'+r.id),month=group(data.monthly,r=>r.id+'|'+r.date?.slice(0,7)),stockHistory=group(data.weekly,r=>r.id);
 const dates=kind=>[...new Set([...(kind==='mrp'?daily:weekly).keys(),...(kind==='mrp'?(data.reportProfiles||[]).map(r=>r.date):[])])].filter(Boolean).sort().reverse();
 const profile=(id,date)=>(moves.get(date+'|'+id)||[]).slice();
 function getParams(id,date){const snapshots=(data.paramSnapshots||[]).filter(r=>r.id===id&&r.date<=date).sort((a,b)=>b.date.localeCompare(a.date));let p=snapshots[0]||params.get(id);const edits=(data.parameterEdits||[]).filter(r=>r.id===id&&r.date<=date).sort((a,b)=>a.date.localeCompare(b.date)||a.savedAt.localeCompare(b.savedAt));if(!p&&!edits.length)return p;p={...p,manualFields:[],parameterOrigins:{}};
 for(const key of ['monthly','safety','min','multiple','lead','buffer']){const edit=edits.filter(e=>Object.hasOwn(e.values,key)).at(-1);if(!edit)continue;const imported=snapshots.find(r=>r.date>edit.date&&!edit.knownDates.includes(r.date)&&r[key]!=null);p[key]=imported?imported[key]:edit.values[key];p.parameterOrigins[key]=imported?'Arquivo de '+imported.date:'Ajuste manual de '+edit.date;if(!imported)p.manualFields.push(key);if(key==='monthly')p.editedMonthly=true;}
 return p;}
 function base(rs){const id=rs[0].id,c=catalog.get(id)||{id,name:id},p=getParams(id,rs[0].date),unit=one(rs,'unit')||c.unit||'';const problems=[];if(rs.some(r=>r.balanceUnverified))problems.push('Saldo não confirmado no PDF de almoxarifados desta data');
  if(!p)problems.push('Parâmetros não cadastrados');
  if(!unit)problems.push('Unidade não informada');
  if(p&&unit&&p.unit&&unit!==p.unit)problems.push('Unidade diverge dos parâmetros');
  const stock=one(rs,'stock'),warehouse=one(rs,'warehouse');
  if(stock==null||warehouse==null)problems.push('Saldo ausente ou conflitante nas linhas da fonte');
  if(p&&[p.lead,p.buffer,p.safety].some(v=>v==null||v<0))problems.push('Parâmetros de reposição/segurança incompletos');
  return {...c,...p,id,name:rs[0].name||c.name,unit,stock,warehouse,problems,sourceRows:rs.map(r=>r.row),warehouses:rs[0].warehouses||[],balanceSource:rs[0].balanceSource||rs[0].source||'Planilha',fromProfile:!!rs[0].fromProfile,requests:(data.requests||[]).filter(r=>r.date===rs[0].date&&r.id===id),parameterSource:p?.source||'ParametrosMRP (Excel)',parameterDate:p?.date||null,message:[...new Set(rs.map(r=>r.message).filter(Boolean))].join(' · ')};
 }
 function consumption(id,date){const rows=profile(id,date);const adjusted=rows.filter(r=>r.ref.startsWith('OFA')||(r.ref.startsWith('OFP')&&r.end&&r.end>=date));const projected=rows.filter(r=>/^OF[AP]/.test(r.ref));return {rows,adjusted:sum(adjusted),projected:sum(projected),invalid:rows.filter(r=>!r.end||r.qty==null).length};}
 function mrp(date,allProfiles=true,focusId=null){const original=daily.get(date)||[],hasProfile=(data.reportProfiles||[]).some(r=>r.date===date&&r.id===focusId),rows=focusId&&!original.some(r=>r.id===focusId)&&!hasProfile?[...original,...(weekly.get(date)||[]).filter(r=>r.id===focusId)]:original,ids=new Set(rows.map(r=>r.id)),profiles=allProfiles?(data.reportProfiles||[]).filter(r=>r.date===date&&!ids.has(r.id)):[];return [...group([...rows,...profiles],r=>r.id).values()].map(rs=>{const i=base(rs),c=consumption(i.id,date);if(c.invalid)i.problems.push('Movimentação com data/quantidade inválida');
  const end=c.rows.map(r=>r.end).filter(Boolean).sort().at(-1),period=end?days(date,end):null;
  const estimated=period>0?divide(c.adjusted,period):null,average=divide(i.monthly,30),coverage=divide(i.warehouse,average),messageCoverage=divide(i.warehouse,estimated),afterLead=estimated==null?null:i.warehouse-estimated*i.lead;
  let status='Estoque baixo';const monthDays=new Date(Date.UTC(+date.slice(0,4),+date.slice(5,7),0)).getUTCDate();
  if(i.problems.length)status='Revisar dados';else if(!period||period<=0)status='Período inválido';else if(!estimated)status='Sem consumo';else if(estimated<0)status='Revisar dados';else if(afterLead<i.safety)status='Compra urgente';else if(messageCoverage<=i.lead+i.buffer+2)status='Estoque crítico';else if(messageCoverage<=i.lead+i.buffer+5)status='Estoque baixo';else if(messageCoverage>=monthDays&&messageCoverage>i.lead+i.buffer&&i.warehouse>i.safety)status='Estoque adequado';
  const buyDate=estimated>0&&!i.problems.length?addDays(date,Math.sign(messageCoverage-i.lead-i.buffer)*Math.ceil(Math.abs(messageCoverage-i.lead-i.buffer))):null;
  return {...i,...c,date,period,end,estimated,coverage,messageCoverage,afterLead,status,buyDate,orders:c.rows.filter(r=>r.type==='OCL'),needs:['Compra urgente','Estoque crítico','Estoque baixo'].includes(status)};
 });}
 function stock(date){return [...group(weekly.get(date)||[],r=>r.id).values()].map(rs=>{const i=base(rs),c=consumption(i.id,date);const vals=(month.get(i.id+'|'+date.slice(0,7))||[]).map(r=>r.monthly).filter(v=>v!=null),monthly=i.editedMonthly?i.monthly:vals.length?Math.max(...vals):null,dailyMean=divide(monthly,30);const coverage=divide(i.stock,dailyMean),warehouseCoverage=divide(i.warehouse,dailyMean),chosen=warehouseCoverage>0?warehouseCoverage:coverage;
  let status=i.problems.length?'Revisar dados':coverage==null?'Sem consumo':chosen<i.lead+i.buffer?'Crítico':chosen<i.lead+i.buffer+10?'Atenção':'Ok';
  const prior=(stockHistory.get(i.id)||[]).filter(r=>r.date&&r.date<date),previousDate=prior.map(r=>r.date).sort().at(-1),previous=previousDate?one(prior.filter(r=>r.date===previousDate),'stock'):null,variation=divide(i.stock-previous,previous);
  const orders=c.rows.filter(r=>r.type==='OCL'||r.type==='AVR'),next=orders.filter(r=>r.type==='OCL'&&r.end>date).map(r=>r.end).sort()[0];const rupture=i.problems.length||coverage==null?'Não calculável':coverage<=0?'Ruptura':!next?'Sem pedido':Date.parse(next)>=Date.parse(date)+coverage*86400000?'Risco de ruptura':'Sem risco';
  return {...i,...c,date,monthly,coverage,warehouseCoverage,status,previousDate,previous,variation,orders,next,rupture,missingMonth:monthly==null};
 });}
 function dashboard(date){
  const inventory=stock(date),planning=mrp(date),seen=new Set(inventory.map(i=>i.id));
  const positions=[...inventory,...planning.filter(i=>!seen.has(i.id))];
  const below=positions.filter(i=>!i.problems.length&&i.warehouse!=null&&i.safety!=null&&i.warehouse<i.safety).sort((a,b)=>a.id.localeCompare(b.id));
  const critical=planning.filter(i=>['Compra urgente','Estoque crítico'].includes(i.status)).sort((a,b)=>(a.status==='Compra urgente'?0:1)-(b.status==='Compra urgente'?0:1)||a.id.localeCompare(b.id));
  const overdue=(data.movements||[]).filter(r=>r.date===date&&r.type==='OCL'&&r.end&&r.end<date&&r.qty>0).map(r=>({...r,name:catalog.get(r.id)?.name||r.id,unit:catalog.get(r.id)?.unit||'',lateDays:days(r.end,date)-1})).sort((a,b)=>b.lateDays-a.lateDays||a.id.localeCompare(b.id));
  return {below,critical,overdue,unverified:positions.filter(i=>i.problems.length).length};
 }
 return {dates,mrp,stock,profile,catalog,params,dashboard,history:data.history};
}

