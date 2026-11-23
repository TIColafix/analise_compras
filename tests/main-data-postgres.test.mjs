import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {runMainDataTransaction,runManagedUsersTransaction} from '../database.mjs';
import {createMainDataReader} from '../main-data-cache.mjs';

test('PostgreSQL: transação, duplicidade e rollback em tabelas temporárias', {skip:!process.env.MRP_TEST_DATABASE_URL}, async()=>{
  const c=new pg.Client({connectionString:process.env.MRP_TEST_DATABASE_URL,connectionTimeoutMillis:10000});
  await c.connect();
  try{
    await c.query('create temporary table app_documents (key text primary key, data jsonb not null, version bigint not null default 1, updated_at timestamptz not null default now())');
    await c.query('create temporary table app_audit (actor text not null, action text not null, document_key text, detail jsonb not null)');
    await c.query("insert into app_documents(key,data) values('main-data','{\"parameterEdits\":[]}'::jsonb)");
    await runMainDataTransaction(c,'teste',data=>{data.parameterEdits.push({id:'X',values:{safety:0}});return {changed:true,data,action:'alterar-parametros'};});
    let row=(await c.query("select data,version from app_documents where key='main-data'")).rows[0];
    assert.equal(row.data.parameterEdits[0].values.safety,0);
    assert.equal(row.version,'2');
    assert.equal((await c.query('select count(*)::int n from app_audit')).rows[0].n,1);
    await runMainDataTransaction(c,'teste',data=>({changed:false,data,duplicate:true}));
    await assert.rejects(runMainDataTransaction(c,'teste',data=>({changed:true,data,action:null})),/null value/);
    row=(await c.query("select version from app_documents where key='main-data'")).rows[0];
    assert.equal(row.version,'2');
    assert.equal((await c.query('select count(*)::int n from app_audit')).rows[0].n,1);
  }finally{await c.end();}
});

test('PostgreSQL: bloqueio compartilhado serializa duas conexões', {skip:!process.env.MRP_TEST_DATABASE_URL}, async()=>{
  const clients=[0,1].map(()=>new pg.Client({connectionString:process.env.MRP_TEST_DATABASE_URL,connectionTimeoutMillis:10000}));
  await Promise.all(clients.map(c=>c.connect()));
  try{
    for(const c of clients){
      await c.query('create temporary table app_documents (key text primary key, data jsonb not null, version bigint not null default 1, updated_at timestamptz not null default now())');
      await c.query('create temporary table app_audit (actor text not null, action text not null, document_key text, detail jsonb not null)');
    }
    let release,started;
    const hold=new Promise(r=>release=r),entered=new Promise(r=>started=r);
    const first=runMainDataTransaction(clients[0],'teste',async data=>{started();await hold;return {changed:false,data};});
    await entered;
    let secondEntered=false;
    const second=runMainDataTransaction(clients[1],'teste',data=>{secondEntered=true;return {changed:false,data};});
    try{
      await new Promise(r=>setTimeout(r,200));
      assert.equal(secondEntered,false);
    }finally{release();}
    await Promise.all([first,second]);
    assert.equal(secondEntered,true);
  }finally{await Promise.all(clients.map(c=>c.end().catch(()=>{})));}
});

test('PostgreSQL: cache detecta alteração mesmo sem incremento de versão', {skip:!process.env.MRP_TEST_DATABASE_URL}, async()=>{
  const c=new pg.Client({connectionString:process.env.MRP_TEST_DATABASE_URL,connectionTimeoutMillis:10000});
  await c.connect();
  try{
    await c.query('create temporary table app_documents (key text primary key, data jsonb not null, version bigint not null default 1)');
    await c.query("insert into app_documents(key,data) values('main-data','{\"value\":1}'::jsonb)");
    const read=createMainDataReader((...args)=>c.query(...args));
    assert.deepEqual(await read(null),{value:1});
    await c.query("update app_documents set data='{\"value\":2}'::jsonb where key='main-data'");
    assert.deepEqual(await read(null),{value:2});
  }finally{await c.end();}
});

test('PostgreSQL: usuários e auditoria são confirmados ou revertidos juntos', {skip:!process.env.MRP_TEST_DATABASE_URL}, async()=>{
  const c=new pg.Client({connectionString:process.env.MRP_TEST_DATABASE_URL,connectionTimeoutMillis:10000});
  await c.connect();
  try{
    await c.query('create temporary table app_documents (key text primary key, data jsonb not null, version bigint not null default 1, updated_at timestamptz not null default now())');
    await c.query('create temporary table app_audit (actor text not null, action text not null, document_key text, detail jsonb not null)');
    await runManagedUsersTransaction(c,'admin',users=>{users.push({user:'teste',passwordHash:'hash-sintetico'});return {action:'criar-usuario',detail:{user:'teste'}};});
    assert.equal((await c.query("select jsonb_array_length(data) n from app_documents where key='app-users'")).rows[0].n,1);
    await assert.rejects(runManagedUsersTransaction(c,'admin',users=>{users.push({user:'erro'});return {action:null};}),/null value/);
    assert.equal((await c.query("select jsonb_array_length(data) n from app_documents where key='app-users'")).rows[0].n,1);
    assert.equal((await c.query('select count(*)::int n from app_audit')).rows[0].n,1);
  }finally{await c.end();}
});
