import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
export const companies=['Colafix','Fixcol','Argamazza'],suppliers=['Votorantim','Intercement'],carriers=['Itamar','Marielo','CHAPELÃO','IVAN FREDERICO'],statuses=['Agendado','Carregado','Entregue','Cancelado'];
export async function readLoads(root){try{return JSON.parse(await readFile(join(root,'source-data/cement-loads.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {loads:[]};throw e;}}
export async function saveLoad(root,input){const data=await readLoads(root),old=input.id?data.loads.find(r=>r.id===input.id):null;
 if(input.id&&!old)throw Error('Carga não encontrada.');if(old&&input.version!==old.version)throw Error('Esta carga foi alterada em outra janela. Recarregue antes de salvar.');
 const fields=['kind','company','supplier','carrier','scheduledDate','systemOrder','supplierOrder','orderQuantity','cementDescription','invoice','status','notes','bagProduct','bagQuantity','deliveryCity','purchaseOrder','freightOrder','freightValue'];const v={};
 for(const key of fields){const raw=input[key]??'';if(typeof raw!=='string')throw Error('Campo inválido: '+key);v[key]=raw.trim();if(v[key].length>(key==='notes'?2000:120))throw Error('Texto muito longo: '+key);}
 if(!['granel','ensacado'].includes(v.kind)||!companies.includes(v.company)||!carriers.includes(v.carrier)||!statuses.includes(v.status)||(v.kind==='granel'&&!suppliers.includes(v.supplier)))throw Error('Seleção inválida.');
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v.scheduledDate)||Number.isNaN(Date.parse(v.scheduledDate))||new Date(v.scheduledDate).toISOString().slice(0,10)!==v.scheduledDate)throw Error('Data agendada inválida.');
 if(!old)v.status='Agendado';
 if(v.kind==='granel'&&!v.systemOrder)throw Error('Informe o pedido do sistema.');if(v.kind==='granel'&&!v.orderQuantity)throw Error('Informe a quantidade do pedido.');if(v.kind==='granel'&&!v.cementDescription)throw Error('Informe a descrição do cimento.');if(v.kind==='ensacado'&&!v.bagProduct)throw Error('Informe o produto.');if(v.kind==='ensacado'&&!v.bagQuantity)throw Error('Informe a quantidade em sacos.');if(v.kind==='ensacado'&&!v.deliveryCity)throw Error('Informe a cidade.');if(v.kind==='ensacado'&&!v.purchaseOrder)throw Error('Informe a OC.');if(old&&old.kind!==v.kind)throw Error('O tipo de carga não pode ser alterado.');
 const now=new Date().toISOString(),changes=Object.fromEntries(fields.filter(k=>!old||old[k]!==v[k]).map(k=>[k,{before:old?.[k]??null,after:v[k]}]));
 if(old&&!Object.keys(changes).length)return old;
 const row={...v,id:old?.id||randomUUID(),version:(old?.version||0)+1,createdAt:old?.createdAt||now,updatedAt:now,history:[...(old?.history||[]),{at:now,changes}]};
 const dir=join(root,'source-data');await mkdir(join(dir,'backups'),{recursive:true});await writeFile(join(dir,'backups','cement-'+randomUUID()+'.json'),JSON.stringify(data));
 data.loads=old?data.loads.map(r=>r.id===old.id?row:r):[...data.loads,row];const target=join(dir,'cement-loads.json'),temp=target+'.tmp';await writeFile(temp,JSON.stringify(data));await rename(temp,target);return row;
}
