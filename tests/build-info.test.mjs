import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createBuildInfo,loadBuildInfo,releaseLabel} from '../build-info.mjs';

test('imagem registra commit recebido e data de geração sem inventar data de commit',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'colafix-build-')),file=join(dir,'build-info.json');
  try{
    await writeFile(file,JSON.stringify(createBuildInfo('abcdef0123456789abcdef0123456789abcdef01')));
    const raw=JSON.parse(await readFile(file,'utf8'));
    assert.equal(raw.sha,'abcdef0123456789abcdef0123456789abcdef01');
    const info=loadBuildInfo({file,production:true}),label=releaseLabel(info);
    assert.match(label,/commit abcdef012345/);assert.match(label,/imagem gerada:/);assert.doesNotMatch(label,/data do commit:/);
    assert.ok(Number.isFinite(Date.parse(info.builtAt)));
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('ausência ou informação inválida não apresenta commit falso',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'colafix-build-')),file=join(dir,'build-info.json');
  try{
    assert.match(releaseLabel(loadBuildInfo({file,production:true})),/commit indisponível/);
    await writeFile(file,JSON.stringify({sha:'<script>bad</script>',builtAt:'inválido'}));
    const label=releaseLabel(loadBuildInfo({file,production:true}));
    assert.match(label,/commit indisponível/);assert.doesNotMatch(label,/<script>/);
  }finally{await rm(dir,{recursive:true,force:true});}
});
