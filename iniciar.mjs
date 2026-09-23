import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const url='http://127.0.0.1:4173',cwd=fileURLToPath(new URL('.',import.meta.url));
const open=()=>spawn('explorer.exe',[url+'/#dashboard'],{windowsHide:true,stdio:'ignore'}).on('error',()=>console.log('Abra no navegador: '+url));
let running=false;
try{const response=await fetch(url+'/api/health',{signal:AbortSignal.timeout(2000)});if(!response.ok||(await response.json()).app!=='colafix-compras-mrp')throw Error('Outra aplicação está usando a porta 4173. Feche-a antes de abrir este projeto.');running=true;}catch(e){if(e.message.startsWith('Outra aplicação')){console.error(e.message);process.exit(1);}if(e instanceof SyntaxError){console.error('Porta 4173 ocupada por outra aplicação.');process.exit(1);}}
if(running){console.log('A aplicação já está aberta neste PC.');open();}else{
 console.log('Compras/MRP — mantenha esta janela aberta durante o uso.\nPara encerrar: Ctrl+C.');
 const child=spawn(process.execPath,['server.mjs'],{cwd,stdio:['inherit','pipe','inherit'],windowsHide:true});let opened=false;
 child.stdout.on('data',chunk=>{process.stdout.write(chunk);if(!opened&&chunk.toString().includes('http://127.0.0.1:4173')){opened=true;open();}});
 child.on('error',e=>{console.error(e.message);process.exitCode=1;});child.on('exit',code=>process.exitCode=code||0);process.on('SIGINT',()=>child.kill());
}
