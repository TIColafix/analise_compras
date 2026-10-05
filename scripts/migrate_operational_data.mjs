import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {initDatabase,readDocument,writeDocument} from '../database.mjs';

const root=fileURLToPath(new URL('..',import.meta.url));
if(!process.env.DATABASE_URL){console.error('DATABASE_URL não configurada.');process.exit(1);}
const sources=[
 ['cement','source-data/cement-loads.json',{loads:[],monthlyOrders:{}}],
 ['diesel','source-data/diesel-loads.json',{loads:[]}],
 ['delivery-deadlines','source-data/delivery-deadlines.json',{orders:[]}],
 ['maintenance','source-data/maintenance-orders.json',{requests:[]}],
];
await initDatabase();
for(const [key,path,fallback] of sources){
 let local;try{local=JSON.parse(await readFile(join(root,path),'utf8'));}catch(e){if(e.code==='ENOENT'){console.log(path+': ausente, ignorado.');continue;}throw e;}
 const remote=await readDocument(key,null);
 if(remote!==null){console.log(key+': já existe no banco; preservado, nada sobrescrito.');continue;}
 await writeDocument(key,local??fallback);
 console.log(key+': migrado com sucesso.');
}
console.log('Migração operacional concluída sem sobrescrever documentos existentes.');
