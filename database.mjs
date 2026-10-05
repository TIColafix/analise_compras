import pg from 'pg';

const {Pool}=pg;
let pool=null;
function getPool(){
  if(!process.env.DATABASE_URL)return null;
  if(!pool)pool=new Pool({connectionString:process.env.DATABASE_URL,max:5,idleTimeoutMillis:30000,connectionTimeoutMillis:10000});
  return pool;
}
export function databaseEnabled(){return !!process.env.DATABASE_URL;}
export async function initDatabase(){
  const p=getPool(); if(!p)return false;
  await p.query(`create table if not exists app_documents (
    key text primary key,
    data jsonb not null,
    version bigint not null default 1,
    updated_at timestamptz not null default now()
  )`);
  return true;
}
export async function readDocument(key,fallback){
  const p=getPool(); if(!p)return fallback;
  await initDatabase();
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
export async function closeDatabase(){if(pool){await pool.end();pool=null;}}
