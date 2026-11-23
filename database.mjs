import pg from 'pg';
import {createMainDataReader} from './main-data-cache.mjs';

const {Pool}=pg;
let pool=null;
let initialization=null,mainDataReader=null;
function getPool(){
  if(!process.env.DATABASE_URL)return null;
  if(!pool)pool=new Pool({connectionString:process.env.DATABASE_URL,max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
  return pool;
}
export function databaseEnabled(){return !!process.env.DATABASE_URL;}
export async function initDatabase(){
  const p=getPool(); if(!p)return false;
  if(!initialization){
    initialization=(async()=>{
  await p.query(`create table if not exists app_documents (
    key text primary key,
    data jsonb not null,
    version bigint not null default 1,
    updated_at timestamptz not null default now()
  )`);
  await p.query(`create table if not exists app_audit (
    id bigserial primary key,
    created_at timestamptz not null default now(),
    actor text not null,
    action text not null,
    document_key text,
    detail jsonb not null default '{}'::jsonb
  )`);
  await p.query(`create table if not exists supplier_catalog_files (contact_id text primary key, filename text not null, content bytea not null, updated_at timestamptz not null default now())`);
  return true;
    })().catch(error=>{initialization=null;throw error;});
  }
  return initialization;
}
export async function readDocument(key,fallback){
  const p=getPool(); if(!p)return fallback;
  await initDatabase();
  if(key==='main-data'){
    if(!mainDataReader)mainDataReader=createMainDataReader((...args)=>p.query(...args));
    return mainDataReader(fallback);
  }
  const r=await p.query('select data from app_documents where key=$1',[key]);
  return r.rows.length?r.rows[0].data:fallback;
}
export async function writeDocument(key,data){
  const p=getPool(); if(!p)throw Error('Banco de dados online não configurado.');
  await initDatabase();
  await p.query(`insert into app_documents(key,data,version,updated_at) values($1,$2::jsonb,1,now())
    on conflict(key) do update set data=excluded.data,version=app_documents.version+1,updated_at=now()`,[key,JSON.stringify(data)]);
  return data;
}

// Serializa alterações da base principal entre processos e grava auditoria na
// mesma transação. O callback recebe o estado mais recente, não o da prévia.
export async function updateMainData(actor,transform){
  const p=getPool();if(!p)throw Error('Banco de dados online não configurado.');
  await initDatabase();
  const client=await p.connect();
  try{return await runMainDataTransaction(client,actor,transform);}
  finally{client.release();}
}

export async function runMainDataTransaction(client,actor,transform){
  try{
    await client.query('BEGIN');
    await client.query("select pg_advisory_xact_lock(hashtext('colafix-main-data'))");
    const current=await client.query("select data from app_documents where key='main-data' for update");
    const result=await transform(current.rows[0]?.data??null);
    if(result.changed){
      await client.query(`insert into app_documents(key,data,version,updated_at) values('main-data',$1::jsonb,1,now())
        on conflict(key) do update set data=excluded.data,version=app_documents.version+1,updated_at=now()`,[JSON.stringify(result.data)]);
      await client.query("insert into app_audit(actor,action,document_key,detail) values($1,$2,'main-data',$3::jsonb)",[actor,result.action,JSON.stringify(result.detail||{})]);
    }
    await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
}

// Serializa alterações de contas e registra auditoria sem expor senhas.
export async function updateManagedUsers(actor,transform){
  const p=getPool();if(!p)throw Error('Configure o banco de dados para administrar usuários.');
  await initDatabase();const client=await p.connect();
  try{return await runManagedUsersTransaction(client,actor,transform);}
  finally{client.release();}
}
export async function runManagedUsersTransaction(client,actor,transform){
  try{
    await client.query('BEGIN');
    await client.query("select pg_advisory_xact_lock(hashtext('colafix-app-users'))");
    const current=await client.query("select data from app_documents where key='app-users' for update");
    const users=current.rows[0]?.data??[];
    if(!Array.isArray(users))throw Error('Cadastro de usuários inválido.');
    const result=await transform(users);
    await client.query(`insert into app_documents(key,data,version,updated_at) values('app-users',$1::jsonb,1,now())
      on conflict(key) do update set data=excluded.data,version=app_documents.version+1,updated_at=now()`,[JSON.stringify(users)]);
    await client.query("insert into app_audit(actor,action,document_key,detail) values($1,$2,'app-users',$3::jsonb)",[actor,result.action,JSON.stringify(result.detail||{})]);
    await client.query('COMMIT');return result;
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}
}
export async function appendAudit(actor,action,documentKey=null,detail={}){
  const p=getPool();if(!p)return null;await initDatabase();
  await p.query('insert into app_audit(actor,action,document_key,detail) values($1,$2,$3,$4::jsonb)',[actor,action,documentKey,JSON.stringify(detail)]);
}
export async function readAudit(limit=200){
  const p=getPool();if(!p)return [];await initDatabase();
  const n=Math.max(1,Math.min(500,Number(limit)||200));
  const r=await p.query('select id,created_at,actor,action,document_key,detail from app_audit order by id desc limit $1',[n]);return r.rows;
}
export async function closeDatabase(){if(pool){await pool.end();pool=null;}initialization=null;mainDataReader=null;}

/* Exporta todos os documentos e todo o histórico em uma mesma visão consistente. */
export async function exportDatabaseSnapshot(){
  const p=getPool();
  if(!p)throw Error('PostgreSQL não configurado para exportação completa.');
  await initDatabase();
  const client=await p.connect();
  try{
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const documents=await client.query('select key,data,version,updated_at from app_documents order by key');
    const audit=await client.query('select id,created_at,actor,action,document_key,detail from app_audit order by id');
    await client.query('COMMIT');
    return {documents:documents.rows,audit:audit.rows};
  }catch(error){
    await client.query('ROLLBACK').catch(()=>{});
    throw error;
  }finally{client.release();}
}

export async function saveSupplierCatalog(id,name,buffer){const p=getPool();if(!p)throw Error('Banco não configurado');await initDatabase();await p.query('insert into supplier_catalog_files(contact_id,filename,content) values($1,$2,$3) on conflict(contact_id) do update set filename=excluded.filename,content=excluded.content,updated_at=now()',[id,name,buffer]);}
export async function getSupplierCatalog(id){const p=getPool();if(!p)return null;await initDatabase();const r=await p.query('select filename,content from supplier_catalog_files where contact_id=$1',[id]);return r.rows[0]||null;}
export async function deleteSupplierCatalog(id){const p=getPool();if(!p)return;await initDatabase();await p.query('delete from supplier_catalog_files where contact_id=$1',[id]);}
