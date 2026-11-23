import {test} from 'node:test';
import assert from 'node:assert/strict';
import {gunzipSync} from 'node:zlib';
import {createMainDataReader} from '../main-data-cache.mjs';
import {sendDataJson} from '../data-response.mjs';

test('cache consulta revisão, acompanha alterações e não armazena ausência',async()=>{
  let record={revision:'10',data:{name:'original'}},full=0,checks=0;
  const read=createMainDataReader(async sql=>{
    if(sql.includes('select data,')){full++;return {rows:record?[structuredClone(record)]:[]};}
    checks++;return {rows:record?[{revision:record.revision}]:[]};
  });
  assert.deepEqual(await read(null),{name:'original'});
  assert.deepEqual(await read(null),{name:'original'});
  assert.equal(full,1);assert.equal(checks,1);
  record={revision:'11',data:{name:'atualizado'}};
  assert.deepEqual(await read(null),{name:'atualizado'});assert.equal(full,2);
  record=null;assert.equal(await read('ausente'),'ausente');
  record={revision:'12',data:{name:'recriado'}};
  assert.deepEqual(await read(null),{name:'recriado'});
});

test('leituras simultâneas compartilham carga inicial e falhas permitem nova tentativa',async()=>{
  let calls=0;
  const read=createMainDataReader(async()=>{calls++;await new Promise(r=>setTimeout(r,5));if(calls===1)throw Error('indisponível');return {rows:[{revision:'1',data:{ok:true}}]};});
  await assert.rejects(Promise.all([read(null),read(null)]),/indisponível/);
  assert.deepEqual(await Promise.all([read(null),read(null)]),[{ok:true},{ok:true}]);
  assert.equal(calls,2);
});

test('base comprimida preserva JSON e respeita negociação do navegador',async()=>{
  const data={rows:Array.from({length:1000},(_,i)=>({id:i,name:'Produto de teste'}))};
  async function response(accept){const r={writeHead(status,headers){this.status=status;this.headers=headers;},end(buffer){this.body=buffer;}};await sendDataJson({headers:{'accept-encoding':accept}},r,data);return r;}
  const compressed=await response('br, gzip');
  assert.equal(compressed.headers['Content-Encoding'],'gzip');
  assert.deepEqual(JSON.parse(gunzipSync(compressed.body)),data);
  assert.ok(compressed.body.length<Buffer.byteLength(JSON.stringify(data))/2);
  const plain=await response('gzip;q=0');
  assert.equal(plain.headers['Content-Encoding'],undefined);
  assert.deepEqual(JSON.parse(plain.body),data);
  assert.equal(plain.headers['Cache-Control'],'no-store');
});
