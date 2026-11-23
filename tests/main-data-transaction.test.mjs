import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runMainDataTransaction} from '../database.mjs';

function client({failAudit=false}={}){
  const calls=[];
  return {calls,async query(sql,values){
    calls.push({sql,values});
    if(sql.includes('select data from app_documents'))return {rows:[{data:{meta:{preferredDate:'2026-11-20'},parameterEdits:[]}}]};
    if(failAudit&&sql.includes('insert into app_audit'))throw Error('auditoria indisponível');
    return {rows:[]};
  }};
}

test('edição usa estado bloqueado e grava dados e auditoria na mesma transação',async()=>{
  const c=client();
  await runMainDataTransaction(c,'operador',data=>{
    data.parameterEdits.push({id:'X',values:{safety:0}});
    return {changed:true,data,action:'alterar-parametros',detail:{id:'X'}};
  });
  assert.equal(c.calls[0].sql,'BEGIN');
  assert.match(c.calls[1].sql,/pg_advisory_xact_lock/);
  assert.match(c.calls[2].sql,/for update/);
  assert.equal(JSON.parse(c.calls[3].values[0]).parameterEdits[0].values.safety,0);
  assert.match(c.calls[4].sql,/insert into app_audit/);
  assert.equal(c.calls[5].sql,'COMMIT');
});

test('falha da auditoria provoca rollback e lote duplicado não grava',async()=>{
  const failing=client({failAudit:true});
  await assert.rejects(runMainDataTransaction(failing,'operador',data=>({changed:true,data,action:'importar-erp'})),/auditoria indisponível/);
  assert.equal(failing.calls.at(-1).sql,'ROLLBACK');
  const duplicate=client();
  await runMainDataTransaction(duplicate,'operador',data=>({changed:false,data,duplicate:true}));
  assert.equal(duplicate.calls.at(-1).sql,'COMMIT');
  assert.ok(!duplicate.calls.some(c=>c.sql.includes('insert into')));
});
