import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allowLocalAdmin} from '../auth-mode.mjs';

const local={host:'127.0.0.1',publicOrigin:'',railway:'',headers:{host:'127.0.0.1:4173'}};
test('acesso automático exige servidor e origem locais sem proxy',()=>{
  assert.equal(allowLocalAdmin(local),true);
  assert.equal(allowLocalAdmin({...local,publicOrigin:'http://localhost:4173'}),true);
  assert.equal(allowLocalAdmin({...local,host:'0.0.0.0'}),false);
  assert.equal(allowLocalAdmin({...local,publicOrigin:'https://cloud.example'}),false);
  assert.equal(allowLocalAdmin({...local,railway:'production'}),false);
  assert.equal(allowLocalAdmin({...local,headers:{host:'127.0.0.1:4173','x-forwarded-for':'198.51.100.4'}}),false);
  assert.equal(allowLocalAdmin({...local,headers:{host:'cloud.example'}}),false);
  assert.equal(allowLocalAdmin({...local,headers:{}}),false);
  assert.equal(allowLocalAdmin({...local,publicOrigin:'origem inválida'}),false);
});
