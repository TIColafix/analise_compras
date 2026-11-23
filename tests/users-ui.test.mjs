import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('lista apresenta permissões, protege Diego e filtra contas por situação e busca',async()=>{
  const elements=new Map();
  function element(id){
    if(!elements.has(id))elements.set(id,{id,value:id==='#status-filter'?'all':'',textContent:'',innerHTML:'',hidden:false,dataset:{},listeners:{},addEventListener(type,fn){this.listeners[type]=fn;},querySelectorAll(){return [];},reset(){},scrollIntoView(){}});
    if(id==='#user-form'&&!elements.get(id).elements)elements.get(id).elements={profile:{value:'limited',addEventListener(){}}};
    return elements.get(id);
  }
  const records=[{user:'diego',name:'Diego',role:'admin',enabled:true,protected:true},{user:'ana',name:'Ana Teste',role:'limited',enabled:false,permissions:['diesel']},{user:'antigo',name:'Conta <teste>',role:'limited',enabled:true,source:'environment',permissions:['insumos']}];
  const document={querySelector:element,documentElement:{dataset:{}}};
  const fetch=async path=>({ok:true,status:200,json:async()=>path==='/api/users'?{users:records}:{users:[]}});
  const context={document,fetch,localStorage:{getItem:()=>null,setItem(){}},setInterval(){},location:{},confirm:()=>false,console};
  vm.runInNewContext(await readFile(new URL('../dist/users-admin.js',import.meta.url),'utf8'),context);
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(element('#stat-total').textContent,3);
  assert.equal(element('#stat-active').textContent,2);
  assert.equal(element('#stat-admin').textContent,1);
  assert.equal(element('#migration-wrap').hidden,false);
  assert.match(element('#users').innerHTML,/Conta protegida/);
  assert.match(element('#users').innerHTML,/Reativar/);
  assert.match(element('#users').innerHTML,/Conta &lt;teste&gt;/);
  assert.doesNotMatch(element('#users').innerHTML,/data-action="delete" data-user="diego"/);
  element('#status-filter').value='inactive';element('#status-filter').listeners.change();
  assert.match(element('#users').innerHTML,/Ana Teste/);
  assert.doesNotMatch(element('#users').innerHTML,/Diego/);
  element('#status-filter').value='all';element('#user-search').value='diego';element('#user-search').listeners.input();
  assert.match(element('#users').innerHTML,/Diego/);
  assert.doesNotMatch(element('#users').innerHTML,/Ana Teste/);
  assert.equal(element('#list-count').textContent,'1 conta');
});
