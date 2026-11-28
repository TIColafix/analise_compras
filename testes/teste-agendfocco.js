/* Agendamentos × cargas do Focco (28/11/2026). Dados inventados.
   O robo-cargas grava cargasfocco/<dia> com as cargas da tela "Produtos por carga" do AvisoRecebimento; o cartão da carga
   nos Agendamentos mostra situação e atendido; carga atendida oferece "marcar Carregou"; carga fechada sem nada atendido avisa. */
const H=require('./harness'); const res=[]; const ok=(n,c,d)=>{ res.push({n,ok:!!c}); console.log((c?'PASSOU ':'FALHOU ')+n+(d?' — '+String(d).slice(0,300):'')); };
(async()=>{ const {d}=H.seed(); const D=d.docs, h=new Date(), HJ=h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0')+'-'+String(h.getDate()).padStart(2,'0');
 const ag=(id,carga,ped)=>({pedido:ped,cliente:'Cliente '+ped,data:HJ,status:'agendado',aberto:true,carga,itens:[{cod:'ZZ0001',desc:'ARGAMASSA TESTE AC3 20 KG',un:'SC',qtd:100,pend:100}],hist:[]});
 D['agendamentos/p800001']=ag('p800001','4112601','800001'); D['agendamentos/p800002']=ag('p800002','4112602','800002'); D['agendamentos/p800003']=ag('p800003','4112603','800003');
 D['cargasfocco/'+HJ]={dia:HJ,em:new Date().toISOString(),lido:new Date().toISOString(),cargas:{
   '4112601':{emp:'Empresa 1 - COLAFIX',sit:'Fechada',pl:2000,pb:2030,it:[{c:'ZZ0001',d:'ARGAMASSA TESTE',um:'SC',q:100,at:100,sd:0,ca:0,pl:2000,pb:2030}]},
   '4112602':{emp:'Empresa 1 - COLAFIX',sit:'Fechada',pl:2000,pb:2030,it:[{c:'ZZ0001',d:'ARGAMASSA TESTE',um:'SC',q:100,at:0,sd:100,ca:0,pl:2000,pb:2030}]},
   '4112603':{emp:'Empresa 1 - COLAFIX',sit:'Aberta',pl:2000,pb:2030,it:[{c:'ZZ0001',d:'ARGAMASSA TESTE',um:'SC',q:60,at:30,sd:30,ca:0,pl:1200,pb:1220},{c:'ZZ0001',d:'ARGAMASSA TESTE',um:'SC',q:40,at:null,sd:null,ca:0,pl:800,pb:810}]}}};
 const B=await H.abrir({viewport:{width:1440,height:950}}); const p=B.page; const erros=[]; p.on('pageerror',e=>erros.push(e.message)); p.on('dialog',g=>g.accept());
 await H.preparar(p,d); await p.goto(H.BASE); await H.entrar(p,'iasmyn','senha123'); await H.dorme(2600);
 await p.evaluate(()=>{ window.__agend.aba='agendado'; __T.go('agendamentos'); }); await H.dorme(900);
 const f=await p.evaluate(()=>[...document.querySelectorAll('.ag-cc')].map(c=>({t:c.querySelector('.ag-cct')?c.querySelector('.ag-cct').innerText:'',f:(c.querySelector('.ag-foc')||{}).className||'',ft:(c.querySelector('.ag-foc')||{}).innerText||''})));
 const de=n=>f.find(x=>x.t.includes(n))||{};
 ok('Cartão da carga mostra o Focco (situação e atendido)', /Fechada/.test(de('4112601').ft)&&/atendido 100 de 100/.test(de('4112601').ft), JSON.stringify(f).slice(0,300));
 ok('Carga atendida: verde e botão "marcar Carregou"', /\bok\b/.test(de('4112601').f)&&/marcar Carregou/.test(de('4112601').ft));
 ok('Carga fechada sem atendimento: vermelho e aviso', /crit/.test(de('4112602').f)&&/Fechada sem atendimento/.test(de('4112602').ft));
 ok('Mesmo produto duas vezes e item sem informação: soma o que tem e não diz que terminou', /atendido 30 de 100/.test(de('4112603').ft)&&!/marcar Carregou/.test(de('4112603').ft), de('4112603').ft);
 await p.click('.ag-cc .ag-foc [data-act="ag-cgcarregou"]'); await H.dorme(800);
 const s=await p.evaluate(()=>JSON.parse(localStorage.getItem('__srv')).docs['agendamentos/p800001']);
 ok('"marcar Carregou" fecha o pedido', s&&s.status==='carregado'&&!s.aberto, s&&s.status);
 await p.evaluate(()=>__T.go('meudia')); await H.dorme(700); const md=await p.evaluate(()=>document.getElementById('view').innerText);
 ok('Meu dia avisa a carga fechada no Focco sem nada atendido', /fechada no Focco sem nada atendido/.test(md));
 ok('Sem erros de programa', !erros.length, erros.join(' | '));
 await B.browser.close(); const fa=res.filter(r=>!r.ok).length; console.log(fa?`\n${fa} FALHOU de ${res.length}`:`\nTODOS PASSARAM (${res.length})`); process.exit(fa?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
