// Acesso automático só é permitido em um servidor restrito ao próprio computador,
// com origem local e sem sinais de proxy. Qualquer configuração ambígua exige login.
const loopback=new Set(['localhost','127.0.0.1','::1']);

export function allowLocalAdmin({host,publicOrigin,railway,headers}){
  if(railway||!loopback.has(String(host).toLowerCase()))return false;
  if(['forwarded','x-forwarded-for','x-forwarded-host','x-forwarded-proto','x-real-ip'].some(k=>headers[k]!==undefined))return false;
  try{
    const requestHost=new URL('http://'+headers.host).hostname.replace(/^\[|\]$/g,'').toLowerCase();
    if(!loopback.has(requestHost))return false;
    if(publicOrigin&&!loopback.has(new URL(publicOrigin).hostname.replace(/^\[|\]$/g,'').toLowerCase()))return false;
    return true;
  }catch{return false;}
}
