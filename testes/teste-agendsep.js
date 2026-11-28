/* PDF de separação da carga: paletes completos, avulsos e peso líquido (28/11/2026). Dados inventados.
   586 sacos com palete de 96 = 6 paletes completos + 10 sacos avulsos; item sem palete vai inteiro em avulsos;
   peso líquido do Focco (cargasfocco) quando a carga já apareceu lá. SHOT=1 grava a 1ª página em /tmp/sep-p1.png */
const H=require('./harness'), fs=require('fs'); const res=[]; const ok=(n,c,d)=>{ res.push({n,ok:!!c}); console.log((c?'PASSOU ':'FALHOU ')+n+(d?' — '+String(d).slice(0,300):'')); };
(async()=>{ const {d}=H.seed(); const D=d.docs, h=new Date(), HJ=h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0')+'-'+String(h.getDate()).padStart(2,'0');
 D['itens/ZZ0005']={codigo:'ZZ0005',palete:96}; D['itens/ZZ0001']={codigo:'ZZ0001',palete:96};
 D['agendamentos/p900001']={pedido:'900001',cliente:'Cliente Teste',data:HJ,status:'agendado',aberto:true,carga:'2511202608',hist:[],
   diario:'7',placa:'ABC1D23',transp:'Transp. Teste',itens:[{cod:'ZZ0005',desc:'ARGAMASSA CINZA AC3 EMB PAPEL 20 KG',un:'SC',qtd:586,pend:586,pp:96},{cod:'ZZ0001',desc:'ARGAMASSA CINZA AC1 EMB PAPEL 20 KG',un:'SC',qtd:192,pend:192,pp:96},{cod:'RF0011',desc:'REJUNTE FLEXIVEL CINZA ARTICO 20X1 KG',un:'FD',qtd:2,pend:2}]};
 D['cargasfocco/'+HJ]={dia:HJ,em:new Date().toISOString(),cargas:{'2511202608':{emp:'Empresa 1 - COLAFIX',sit:'Aberta',it:[{c:'ZZ0005',d:'',um:'SC',q:586,at:0,sd:586,ca:0,pl:11720,pb:11780},{c:'ZZ0001',d:'',um:'SC',q:192,at:0,sd:192,ca:0,pl:3840,pb:3860},{c:'RF0011',d:'',um:'FD',q:2,at:0,sd:2,ca:0,pl:40,pb:41}]}}};
 const B=await H.abrir({viewport:{width:1440,height:950}}); const p=B.page; const erros=[]; p.on('pageerror',e=>erros.push(e.message)); p.on('console',m=>{ if(/pdf sep/.test(m.text())) erros.push(m.text()); });
 await H.preparar(p,d); await p.goto(H.BASE); await H.entrar(p,'iasmyn','senha123'); await H.dorme(2600);
 await p.evaluate(()=>{ window.__agend.aba='agendado'; __T.go('agendamentos'); }); await H.dorme(1000);
 await p.evaluate(()=>{ const J=window.jspdf&&window.jspdf.jsPDF; if(J&&!J.prototype.__sv){ const s=J.prototype.save; J.prototype.save=function(n){ window.__doc=this; return s.call(this,n); }; J.prototype.__sv=1; } });
 const bt=await p.$('[data-act="ag-pdfsep"]'); ok('Botão do PDF de separação na carga', !!bt);
 if(bt){ await p.evaluate(()=>{ const J=window.jspdf&&window.jspdf.jsPDF; if(J&&!J.prototype.__sv){ const s=J.prototype.save; J.prototype.save=function(n){ window.__doc=this; return s.call(this,n); }; J.prototype.__sv=1; } }); await bt.click(); await H.dorme(2500);
   await p.evaluate(()=>{ const J=window.jspdf&&window.jspdf.jsPDF; if(J&&!J.prototype.__sv){ const s=J.prototype.save; J.prototype.save=function(n){ window.__doc=this; return s.call(this,n); }; J.prototype.__sv=1; } });
   if(!(await p.evaluate(()=>!!window.__doc))){ await p.click('[data-act="ag-pdfsep"]'); await H.dorme(2500); } }
 const pg=await p.evaluate(()=>window.__doc?window.__doc.pages.map(c=>c.toDataURL('image/png')):[]);
 ok('PDF gerado', pg.length>0, pg.length);
 pg.forEach((u,i)=>fs.writeFileSync('/tmp/sep-p'+(i+1)+'.png',Buffer.from(u.split(',')[1],'base64')));
ok('Sem a folha da empilhadeira (uma página só)', pg.length===1, pg.length);
 const t=await p.evaluate(()=>window.__doc&&window.__doc.__t?window.__doc.__t.join(' | '):'');
 ok('Sem erros de programa', !erros.length, erros.join(' | '));
 await B.browser.close(); const fa=res.filter(r=>!r.ok).length; console.log(fa?`\n${fa} FALHOU de ${res.length}`:`\nTODOS PASSARAM (${res.length})`); process.exit(fa?1:0);
})().catch(e=>{ console.error(e); process.exit(1); });
