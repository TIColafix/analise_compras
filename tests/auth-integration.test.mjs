import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {once} from 'node:events';
import {setTimeout as delay} from 'node:timers/promises';

test('ambiente de nuvem exige login, mantém sessão e encerra no logout',async()=>{
  const socket=createServer();socket.listen(0,'127.0.0.1');await once(socket,'listening');
  const port=socket.address().port;await new Promise(resolve=>socket.close(resolve));
  const env={...process.env,HOST:'0.0.0.0',PORT:String(port),APP_ORIGIN:`http://127.0.0.1:${port}`,APP_USER:'teste',APP_PASSWORD:'senha-teste'};
  delete env.DATABASE_URL;delete env.RAILWAY_ENVIRONMENT;delete env.ALISSON_PASSWORD;
  const child=spawn(process.execPath,['server.mjs'],{env,stdio:'ignore',windowsHide:true});
  const base=`http://127.0.0.1:${port}`,headers={};
  const request=(path,options={})=>fetch(base+path,{...options,headers:{...headers,...options.headers},redirect:'manual'});
  try{
    let ready=false;
    for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error('Servidor de teste encerrou');try{const r=await request('/api/health');if(r.ok){ready=true;break;}}catch{}await delay(50);}
    assert.ok(ready,'Servidor de teste não iniciou');
    let r=await request('/');assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/login');
    r=await request('/api/me');assert.equal(r.status,401);
    r=await request('/data.json');assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/login');
    r=await request('/login');assert.equal(r.status,200);
    r=await request('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'username=teste&password=errada'});assert.equal(r.status,401);
    r=await request('/login',{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body:'username=teste&password=senha-teste'});assert.equal(r.status,303);
    const cookie=r.headers.get('set-cookie').split(';')[0];
    r=await request('/api/me',{headers:{cookie}});assert.equal(r.status,200);assert.equal((await r.json()).role,'admin');
    r=await request('/logout',{headers:{cookie}});assert.equal(r.status,303);
    r=await request('/api/me',{headers:{cookie}});assert.equal(r.status,401);
  }finally{child.kill();}
});
