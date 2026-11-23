import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isProtectedUser,userRole,validateModules,sanitizeUser,routeAllowed,hasModule,categoryModule,cementModule} from '../users-policy.mjs';

test('Diego é protegido e senhas não são expostas',()=>{
  assert.equal(isProtectedUser('DIEGO'),true);
  assert.equal(userRole({user:'diego',role:'limited'}),'admin');
  assert.deepEqual(sanitizeUser({user:'diego',name:'Diego',passwordHash:'segredo'}),{user:'diego',name:'Diego',role:'admin',protected:true});
  assert.throws(()=>validateModules(['inexistente']),/módulos válidos/);
  assert.throws(()=>validateModules(['areiaadmin']),/Areia Amigos/);
  assert.deepEqual(validateModules(['areiaamigos','areiaadmin']),['areiaamigos','areiaadmin']);
  assert.deepEqual(validateModules(['diesel','diesel']),['diesel']);
});

test('permissões são independentes e rotas desconhecidas são bloqueadas',()=>{
  const user={role:'limited',permissions:['diesel','cimento-granel']};
  assert.equal(routeAllowed(user,'/api/diesel'),true);
  assert.equal(routeAllowed(user,'/api/cement'),true);
  assert.equal(routeAllowed(user,'/api/cement-bag-prices'),false);
  assert.equal(routeAllowed(user,'/api/maintenance'),false);
  assert.equal(routeAllowed(user,'/data.json'),false);
  assert.equal(routeAllowed(user,'/api/users'),false);
  assert.equal(routeAllowed(user,'/api/desconhecida'),false);
  assert.equal(hasModule(user,cementModule('ensacado')),false);
  assert.equal(categoryModule('MP'),'materia-prima');
  assert.equal(categoryModule(''),'manutencao');
});
