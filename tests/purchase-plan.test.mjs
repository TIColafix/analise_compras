import test from 'node:test';
import assert from 'node:assert/strict';
import {purchasePlan} from '../dist/engine.js';

const item={id:'MP0214',unit:'KG',date:'2026-09-25',warehouse:62.7,safety:60,estimated:1.1,monthly:4.4,lead:7,buffer:2,min:0,multiple:20,problems:[]};

test('recomenda compra agora e respeita multiplo do lote',()=>{
 const p=purchasePlan(item,[],'2026-09-25');
 assert.equal(p.action,'Comprar');
 assert.equal(p.needDate,'2026-09-27');
 assert.equal(p.recommendedQty,20);
});

test('pedido suficiente mas atrasado gera antecipacao',()=>{
 const p=purchasePlan(item,[{code:'MP0214',unit:'KG',status:'Aguardando entrega',quantity:20,deliveredQuantity:0,deliveryDate:'2026-10-01'}],'2026-09-25');
 assert.equal(p.action,'Antecipar entrega');
 assert.equal(p.recommendedArrival,'2026-09-27');
 assert.equal(p.additionalQty,0);
});

test('pedido atrasado e insuficiente gera antecipacao mais complemento',()=>{
 const p=purchasePlan(item,[{code:'MP0214',unit:'KG',status:'Aguardando entrega',quantity:5,deliveredQuantity:0,deliveryDate:'2026-10-01'}],'2026-09-25');
 assert.equal(p.action,'Antecipar + comprar complemento');
 assert.equal(p.additionalQty,20);
});

test('pedido suficiente e no prazo evita nova compra',()=>{
 const p=purchasePlan(item,[{code:'mp0214',unit:'kg',status:'Aguardando entrega',quantity:20,deliveredQuantity:0,newDate:'2026-09-26',deliveryDate:'2026-10-01'}],'2026-09-25');
 assert.equal(p.action,'Já comprado');
 assert.equal(p.onTimeQty,20);
});
