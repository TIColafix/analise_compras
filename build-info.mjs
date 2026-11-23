import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

function validSha(value){return typeof value==='string'&&/^[a-f0-9]{7,64}$/i.test(value)?value.toLowerCase():null;}
function validDate(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;}
export function createBuildInfo(sha,now=new Date()){return {sha:validSha(typeof sha==='string'?sha.trim():null),builtAt:now.toISOString()};}

export function loadBuildInfo({file=new URL('./build-info.json',import.meta.url),cwd,production=process.env.NODE_ENV==='production'}={}){
  try{
    const value=JSON.parse(readFileSync(file,'utf8'));
    return {sha:validSha(value.sha),builtAt:validDate(value.builtAt),commitDate:validDate(value.commitDate),local:false};
  }catch{}
  if(!production){
    try{
      const [sha,date]=execFileSync('git',['show','-s','--format=%H%n%cI','HEAD'],{cwd,encoding:'utf8',windowsHide:true,timeout:3000,stdio:['ignore','pipe','ignore']}).trim().split(/\r?\n/);
      return {sha:validSha(sha),builtAt:null,commitDate:validDate(date),local:true};
    }catch{}
  }
  return {sha:null,builtAt:null,commitDate:null,local:!production};
}

export function releaseLabel(info){
  const parts=[info.local?'Código local':'Versão publicada'];
  parts.push(info.sha?'commit '+info.sha.slice(0,12):'commit indisponível');
  const date=info.commitDate||info.builtAt;
  if(date){const when=new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(date));parts.push((info.commitDate?'data do commit: ':'imagem gerada: ')+when+' (Brasília)');}
  return parts.join(' · ');
}
