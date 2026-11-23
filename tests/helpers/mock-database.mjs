import {scryptSync} from 'node:crypto';
const documents=new Map([
  ['app-users',[{user:'areia-admin',name:'Admin Areia',enabled:true,passwordHash:'scrypt:seed:'+scryptSync('senha-areia','seed',64).toString('hex'),permissions:['areiaamigos','areiaadmin'],sessionVersion:0}]],
  ['cement',{loads:[{id:'bulk',kind:'granel'},{id:'bag',kind:'ensacado'}],monthlyOrders:{},bagProducts:['Teste'],bagPrices:{products:[],freights:[],clientPrices:[]}}],
  ['maintenance',{requests:[{id:'mp',category:'MP'},{id:'work',category:''}]}]
]);
export function databaseEnabled(){return true;}
export async function initDatabase(){return true;}
export async function readDocument(key,fallback){return structuredClone(documents.get(key)??fallback);}
export async function writeDocument(key,data){documents.set(key,structuredClone(data));return data;}
export async function updateManagedUsers(actor,transform){const users=structuredClone(documents.get('app-users')||[]);const result=await transform(users);documents.set('app-users',users);return result;}
export async function updateMainData(){throw Error('Não utilizado no teste');}
export async function appendAudit(){}
export async function readAudit(){return [];}
export async function exportDatabaseSnapshot(){return {};}
export async function saveSupplierCatalog(){}
export async function getSupplierCatalog(){return null;}
export async function deleteSupplierCatalog(){}
