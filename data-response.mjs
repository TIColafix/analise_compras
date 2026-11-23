import {gzip} from 'node:zlib';
import {promisify} from 'node:util';

const compress=promisify(gzip);
function acceptsGzip(value){
  return String(value||'').split(',').some(part=>{
    const [encoding,...params]=part.trim().toLowerCase().split(';').map(s=>s.trim());
    if(encoding!=='gzip')return false;
    const q=params.find(p=>p.startsWith('q='));
    return !q||Number(q.slice(2))>0;
  });
}
export async function sendDataJson(req,res,data){
  const plain=Buffer.from(JSON.stringify(data));
  const compressed=plain.length>=1024&&acceptsGzip(req.headers['accept-encoding']);
  const bytes=compressed?await compress(plain,{level:4}):plain;
  res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Accept-Encoding',...(compressed?{'Content-Encoding':'gzip'}:{}),'Content-Length':bytes.length});
  res.end(bytes);
}
