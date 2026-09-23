# Fórmulas extraídas do modelo Power BI

39 medidas; 16 colunas calculadas de negócio.

## AnaliseDiariaMRP · Consumo do Mês

```dax
CALCULATE(SUM(MovimentacoesMRP[Quantidade]),FILTER(MovimentacoesMRP,(LEFT(MovimentacoesMRP[Referência], 3) = "OFA"||LEFT(MovimentacoesMRP[Referência], 3) = "OFP")&&MONTH(MovimentacoesMRP[Data Fim]) = MONTH(TODAY())&&YEAR(MovimentacoesMRP[Data Fim]) = YEAR(TODAY())))
```

## AnaliseDiariaMRP · Consumo Ajustado

```dax
VAR _DataAnalise = SELECTEDVALUE(AnaliseDiariaMRP[Data de Análise], TODAY())RETURN CALCULATE(SUM(MovimentacoesMRP[Quantidade]),FILTER(MovimentacoesMRP,(LEFT(MovimentacoesMRP[Referência], 3) = "OFA"|| (LEFT(MovimentacoesMRP[Referência], 3) = "OFP"&& MovimentacoesMRP[Data Fim] >= _DataAnalise)) && MovimentacoesMRP[Data Relatório] = _DataAnalise ) )
```

## MovimentacoesMRP · EstoqueAtualFormatado

```dax
VAR valor = SUM(AnaliseDiariaMRP[Estoque Atual]) VAR unidade = SELECTEDVALUE(AnaliseDiariaMRP[UM])RETURN FORMAT(valor, "#,##0.00") & " " & unidade
```

## MovimentacoesMRP · ConsumoMesFormatado

```dax
VAR _DataAnalise =SELECTEDVALUE ( AnaliseDiariaMRP[Data de Análise] )VAR _Consumo =CALCULATE (SUM ( MovimentacoesMRP[Quantidade] ), FILTER (MovimentacoesMRP,LEFT ( MovimentacoesMRP[Referência], 3 ) IN { "OFA", "OFP" }&& MovimentacoesMRP[Data Relatório] = _DataAnalise))VAR _UM =SELECTEDVALUE ( AnaliseDiariaMRP[UM] )RETURN FORMAT ( _Consumo, "#,##0.00" ) & " " & _UM
```

## MovimentacoesMRP · ConsumoAjustadoformatado

```dax
VAR _DataAnalise = SELECTEDVALUE ( AnaliseDiariaMRP[Data de Análise] )VAR _Consumo =CALCULATE ( SUM ( MovimentacoesMRP[Quantidade] ),FILTER ( MovimentacoesMRP,(LEFT ( MovimentacoesMRP[Referência], 3 ) = "OFA"|| (LEFT ( MovimentacoesMRP[Referência], 3 ) = "OFP"&& MovimentacoesMRP[Data Fim] >= _DataAnalise))&& MovimentacoesMRP[Data Relatório] = _DataAnalise))VAR _Unidade =SELECTEDVALUE ( AnaliseDiariaMRP[UM], "und" )RETURN FORMAT ( _Consumo, "#,##0.00" ) & " " & _Unidade
```

## AnaliseDiariaMRP · DiasDeEstoque

```dax
DIVIDE([Estoque Almox 1 medida], [ConsumoDiario])
```

## ParametrosMRP · Consumo Medio medida

```dax
SELECTEDVALUE(ParametrosMRP[Consumo Médio])
```

## ParametrosMRP · ConsumoDiario

```dax
DIVIDE([Consumo Medio medida], 30)
```

## AnaliseDiariaMRP · Estoque Atual medida

```dax
SELECTEDVALUE(AnaliseDiariaMRP[Estoque Atual])
```

## AnaliseDiariaMRP · CorDiasDeEstoque

```dax
VAR dias = [DiasDeEstoque]VAR tempoReposicao = SELECTEDVALUE(ParametrosMRP[Tempo Reposição])RETURN IF(dias < tempoReposicao, "#C00000", "#007E33")  -- vermelho ou verde
```

## AnaliseDiariaMRP · MetaReposicao

```dax
SELECTEDVALUE(ParametrosMRP[Tempo Reposição])
```

## AnaliseDiariaMRP · Almox1Formatado_Novo

```dax
VAR valor = SUM(AnaliseDiariaMRP[Almox 1]) VAR unidade = SELECTEDVALUE(AnaliseDiariaMRP[UM])RETURN FORMAT(valor, "#,##0.00") & " " & unidade
```

## AnaliseDiariaMRP · Estoque Almox 1 medida

```dax
SELECTEDVALUE(AnaliseDiariaMRP[Almox 1])
```

## AnaliseDiariaMRP · Pedidos em Aberto

```dax
CALCULATE(SUM(MovimentacoesMRP[Quantidade]),MovimentacoesMRP[Tipo] = "OCL",MovimentacoesMRP[Data Fim] >= TODAY())
```

## AnaliseDiariaMRP · estoque de segurança medida

```dax
SELECTEDVALUE(ParametrosMRP[Estoque Segurança])
```

## ParametrosMRP · Lote minimo medida

```dax
SELECTEDVALUE(ParametrosMRP[Lote Mínimo])
```

## AnaliseDiariaMRP · MensagemDeCompra

```dax
VAR EstoqueAlmox1=[Estoque Almox 1 medida] VAR ConsumoAjustado=[Consumo Ajustado] VAR DataHoje=TODAY() VAR UltimoDiaFuturo=CALCULATE(MAX(MovimentacoesMRP[Data Fim]), REMOVEFILTERS(MovimentacoesMRP[Data Relatório])) VAR DiasConsiderados=DATEDIFF(DataHoje, UltimoDiaFuturo, DAY)+1 VAR ConsumoDiario=DIVIDE(ConsumoAjustado, DiasConsiderados) VAR MsgConsumo=" Consumo diário estimado: " & FORMAT(ConsumoDiario,"#,##0.00") & " kg/dia. " VAR MsgPedidos=" Observação: podem existir pedidos em andamento que ainda não impactaram o estoque disponível. " VAR MsgDias=" Período considerado no cálculo: " & DiasConsiderados & " dias. " VAR EstoqueSeguranca=COALESCE(SELECTEDVALUE(ParametrosMRP[Estoque Segurança]),0) VAR DiasReposicao=COALESCE(SELECTEDVALUE(ParametrosMRP[Tempo Reposição]),0) VAR DiasSeguranca=COALESCE(SELECTEDVALUE(ParametrosMRP[Tempo Segurança]),0) VAR DiasDoMes=DAY(EOMONTH(DataHoje,0)) VAR DiasCobertos=DIVIDE(EstoqueAlmox1, ConsumoDiario,0) VAR DataEstoqueAcaba=DataHoje+ROUNDUP(DiasCobertos,0) VAR EstoqueAposReposicao=EstoqueAlmox1-(ConsumoDiario*DiasReposicao) VAR DataCompraNecessaria=DataHoje+ROUNDUP(DiasCobertos-DiasReposicao-DiasSeguranca,0) RETURN SWITCH(TRUE(), ConsumoDiario=0, "⚠️ Sem consumo registrado. Não é possível calcular cobertura nem risco de ruptura. " & MsgDias & MsgPedidos, EstoqueAposReposicao<EstoqueSeguranca, "🔴 Compra urgente. Após o lead time o estoque ficará em " & FORMAT(EstoqueAposReposicao,"#,##0.0") & " kg, abaixo do estoque de segurança (" & FORMAT(EstoqueSeguranca,"#,##0") & " kg). Compra imediata necessária até " & FORMAT(DataCompraNecessaria,"dd/mm") & ". " & MsgConsumo & MsgDias & MsgPedidos, DiasCobertos<=DiasReposicao+DiasSeguranca+2, "🟠 Estoque crítico. Cobertura de " & FORMAT(DiasCobertos,"#,##0.0") & " dias, abaixo do mínimo necessário (" & (DiasReposicao+DiasSeguranca) & " dias). Compre até " & FORMAT(DataCompraNecessaria,"dd/mm") & ". Estoque de segurança: " & FORMAT(EstoqueSeguranca,"#,##0") & " kg. " & MsgConsumo & MsgDias & MsgPedidos, DiasCobertos<=DiasReposicao+DiasSeguranca+5, "🟡 Estoque baixo. Cobertura de " & FORMAT(DiasCobertos,"#,##0.0") & " dias, inferior aos " & DiasDoMes & " dias do mês, mas acima do mínimo operacional (" & (DiasReposicao+DiasSeguranca) & " dias). Planejar compra até " & FORMAT(DataCompraNecessaria,"dd/mm") & ". Estoque de segurança considerado: " & FORMAT(EstoqueSeguranca,"#,##0") & " kg. " & MsgConsumo & MsgDias & MsgPedidos, DiasCobertos>=DiasDoMes && DiasCobertos>(DiasReposicao+DiasSeguranca) && EstoqueAlmox1>EstoqueSeguranca, "🟢 Estoque adequado. O estoque atual de " & FORMAT(EstoqueAlmox1,"#,##0.0") & " kg cobre " & FORMAT(DiasCobertos,"#,##0.0") & " dias, acima dos " & DiasDoMes & " dias do mês e acima do estoque de segurança (" & FORMAT(EstoqueSeguranca,"#,##0") & " kg). " & MsgConsumo & MsgDias & MsgPedidos, "🟡 Estoque baixo. Cobertura insuficiente para o mês atual (" & FORMAT(DiasCobertos,"#,##0.0") & " dias vs " & DiasDoMes & " dias). Planejar reposição até " & FORMAT(DataCompraNecessaria,"dd/mm") & ". Estoque de segurança: " & FORMAT(EstoqueSeguranca,"#,##0") & " kg. " & MsgConsumo & MsgDias & MsgPedidos )
```

## AnaliseDiariaMRP · Legenda_Status_Estoque

```dax
"🟢:Estoque acima de 40 dias" & UNICHAR(10) &"  🟡:Estoque entre 30 e 40 dias" & UNICHAR(10) &" 🔴:Estoque abaixo de 30 dias" & UNICHAR(10) &"  🟠:Sem consumo para cálculo"
```

## MovimentacoesMRP · Data Relatório Ajustada

```dax
VAR DataSelecionada =SELECTEDVALUE ( 'AnaliseDiariaMRP'[Data de Análise] )VAR DataRelatorio =MAX ( 'MovimentacoesMRP'[Data Relatório] )RETURN  IF (NOT ISBLANK ( DataSelecionada )&& DataRelatorio = DataSelecionada,DataRelatorio,BLANK ())
```

## AnaliseDiariaMRP · Data Relatório Hoje

```dax
VAR DataRelatorio = MAX('MovimentacoesMRP'[Data Relatório])RETURN IF(DataRelatorio = TODAY(),DataRelatorio,BLANK())
```

## AnaliseDiariaMRP · PedidosEmAberto

```dax
CALCULATE(SUM(MovimentacoesMRP[Quantidade]),FILTER(MovimentacoesMRP,MovimentacoesMRP[Tipo] = "OCL" && MovimentacoesMRP[Data Fim] >=TODAY()))
```

## AnaliseDiariaMRP · ConsumoAjustadoNum

```dax
VAR _DataAnalise = SELECTEDVALUE(AnaliseDiariaMRP[Data de Análise]) VAR _Consumo = CALCULATE(SUM(MovimentacoesMRP[Quantidade]),FILTER(MovimentacoesMRP,(LEFT(MovimentacoesMRP[Referência],3)="OFA" || (LEFT(MovimentacoesMRP[Referência],3)="OFP" && MovimentacoesMRP[Data Fim]>=_DataAnalise)) && MovimentacoesMRP[Data Relatório]=_DataAnalise)) RETURN _Consumo
```

## AnaliseDiariaMRP · ConsumoDiarioReal

```dax
VAR _Hoje = TODAY() VAR _DataFimMax = MAX(MovimentacoesMRP[Data Fim]) VAR _DataFimValida = IF(NOT ISBLANK(_DataFimMax),_DataFimMax,_Hoje) VAR _DiasPeriodo = DATEDIFF(_Hoje,_DataFimValida,DAY)+1 VAR _ConsumoAjustado = [ConsumoAjustadoNum] RETURN DIVIDE(_ConsumoAjustado,_DiasPeriodo,0)
```

## Fornecedor_Preferencial · Fornecedor do Item (por dia)

```dax
VAR ItemSelecionado =SELECTEDVALUE ( AnaliseDiariaMRP[Cód. Item] )RETURN CALCULATE ( SELECTEDVALUE ( Fornecedor_Preferencial[Fornecedor preferencial] ),Fornecedor_Preferencial[Codigo] = ItemSelecionado )
```

## AnaliseDiariaMRP · Fornecedor Visível (por dia)

```dax
VAR ItensNoContexto = VALUES ( AnaliseDiariaMRP[Cód. Item] )VAR FornecedoresDosItens =CALCULATETABLE (VALUES ( Fornecedor_Preferencial[Fornecedor preferencial] ),TREATAS ( ItensNoContexto,Fornecedor_Preferencial[Codigo] ))RETURN IF (COUNTROWS ( ItensNoContexto ) > 0&& COUNTROWS ( FornecedoresDosItens ) = 1,1,0)
```

## Historico_Consumos · Consumo Real Histórico

```dax
CALCULATE(SUM ( Historico_Consumos[Quantidade] ),Historico_Consumos[Tipo Movimento] IN { "REP", "REQ" })
```

## Historico_Consumos · Consumo Mensal Histórico

```dax
CALCULATE(SUM ( Historico_Consumos[Quantidade] ),Historico_Consumos[Tipo Movimento] IN { "REP", "REQ" })
```

## Historico_Consumos · Ultima Movimentacao Historico

```dax
CALCULATE(MAX ( Historico_Consumos[Data Requisição] ),Historico_Consumos[Tipo Movimento] IN { "REP", "REQ" })
```

## Historico_Consumos · Dias sem Consumo Historico

```dax
DATEDIFF ([Ultima Movimentacao Historico],TODAY(),DAY)
```

## Monitoramento Semanal · Estoque Atual

```dax
SUM ( 'Monitoramento Semanal'[Saldo Total  ] )
```

## AnaliseDiariaMRP · Estoque Dia Anterior

```dax
CALCULATE([Estoque Atual],FILTER( ALL ( 'Monitoramento Semanal'[Data do Relatório] ),'Monitoramento Semanal'[Data do Relatório]= MAX ( 'Monitoramento Semanal'[Data do Relatório] ) - 1))
```

## Monitoramento Semanal · Proxima Data Entrega OCL

```dax
IF(SELECTEDVALUE('Monitoramento Semanal'[Data do Relatório]) <> TODAY(),BLANK(),CALCULATE(MINX(FILTER(ALL('MovimentacoesMRP'),'MovimentacoesMRP'[Item] = SELECTEDVALUE('Monitoramento Semanal'[Codigo]) && 'MovimentacoesMRP'[Tipo] = "OCL"&& 'MovimentacoesMRP'[Data Fim] > TODAY()),'MovimentacoesMRP'[Data Fim])))
```

## Monitoramento Semanal · Aviso Ruptura

```dax
IF(SELECTEDVALUE('Monitoramento Semanal'[Data do Relatório])<>TODAY(),BLANK(),VAR DataEntrega=[Proxima Data Entrega OCL]VAR DiasEstoque=SELECTEDVALUE('Monitoramento Semanal'[Dias_Estoque_Total])VAR DataLimite=TODAY()+DiasEstoque RETURN IF(ISBLANK(DiasEstoque),BLANK(),IF(DiasEstoque=0,"🟥 Ruptura",IF(ISBLANK(DataEntrega),"📦 Sem pedido",IF(DataEntrega>=DataLimite,"🟥 Risco de ruptura","🟩 Sem risco")))))
```

## AnaliseDiariaMRP · Status Ruptura Medida

```dax
VAR DataEntrega = [Proxima Data Entrega OCL]VAR DiasEstoque = SELECTEDVALUE('Monitoramento Semanal'[Dias_Estoque_Total])VAR DataLimite = TODAY() + DiasEstoque RETURN IF(SELECTEDVALUE('Monitoramento Semanal'[Data do Relatório]) <> TODAY(), BLANK(),IF(DiasEstoque = 0, "🟥 Ruptura", IF(ISBLANK(DataEntrega),"📦 Sem pedido",IF(DataEntrega >= DataLimite,"🟥 Risco de ruptura","🟩 Sem risco"))))
```

## AnaliseDiariaMRP · Filtro Ruptura

```dax
DATATABLE("Status", STRING, {{"🟥 Ruptura"}, {"🟥 Risco de ruptura"}, {"📦 Sem pedido"}, {"🟩 Sem risco"}})
```

## AnaliseDiariaMRP · Data Relatório Ajustada 2

```dax
VAR DataSelecionada =SELECTEDVALUE ( 'Monitoramento Semanal'[Data do Relatório] )VAR DataRelatorio = MAX ( 'MovimentacoesMRP'[Data Relatório] )RETURN IF (NOT ISBLANK ( DataSelecionada )&& DataRelatorio = DataSelecionada,DataRelatorio,BLANK ())
```

## AnaliseDiariaMRP · ConsumoAjustadoFormatado 2

```dax
VAR _DataRelatorio=SELECTEDVALUE('Monitoramento Semanal'[Data do Relatório])VAR _Consumo=CALCULATE(SUM(MovimentacoesMRP[Quantidade]),FILTER(MovimentacoesMRP,LEFT(MovimentacoesMRP[Referência],3)="OFA"||(LEFT(MovimentacoesMRP[Referência],3)="OFP"&&MovimentacoesMRP[Data Fim]>=_DataRelatorio)),MovimentacoesMRP[Data Relatório]=_DataRelatorio)VAR _Unidade=SELECTEDVALUE(AnaliseDiariaMRP[UM],"und")RETURN FORMAT(_Consumo,"#,##0.00")&" "&_Unidade
```

## AnaliseDiariaMRP · ConsumoMesFormatado 2

```dax
VAR _DataRelatorio=SELECTEDVALUE('Monitoramento Semanal'[Data do Relatório])VAR _Consumo=CALCULATE(SUM(MovimentacoesMRP[Quantidade]),FILTER(MovimentacoesMRP,LEFT(MovimentacoesMRP[Referência],3)IN{"OFA","OFP"}&&MovimentacoesMRP[Data Relatório]=_DataRelatorio))VAR _UM=SELECTEDVALUE(AnaliseDiariaMRP[UM])RETURN FORMAT(_Consumo,"#,##0.00")&" "&_UM
```

## AnaliseDiariaMRP · Filtro Ruptura Aplicado

```dax
VAR StatusSelecionado =SELECTEDVALUE('Filtro Ruptura'[Status])VAR StatusItem =[Status Ruptura Medida]RETURN IF(ISBLANK(StatusSelecionado),1,IF(StatusSelecionado = StatusItem, 1, 0)  )
```

## AnaliseDiariaMRP · ItemDescricao

```dax
'AnaliseDiariaMRP'[Cód. Item] & " - " & 'AnaliseDiariaMRP'[Descrição]
```

## Monitoramento Semanal · Consumo_Medio_Mensal

```dax
VAR MesAnoSemanal = FORMAT('Monitoramento Semanal'[Data do Relatório], "YYYYMM")RETURN CALCULATE( MAX('Monitoramento Mensal'[Consumo médio]),FILTER('Monitoramento Mensal','Monitoramento Mensal'[Codigo] = 'Monitoramento Semanal'[Codigo] &&FORMAT('Monitoramento Mensal'[Data do Relatório], "YYYYMM") = MesAnoSemanal))
```

## Monitoramento Semanal · Consumo_Medio_Diario

```dax
'Monitoramento Semanal'[Consumo_Medio_Mensal]/30
```

## Monitoramento Semanal · Dias_Estoque_Total

```dax
DIVIDE('Monitoramento Semanal'[Saldo Total  ], 'Monitoramento Semanal'[Consumo_Medio_Diario])
```

## Monitoramento Semanal · Dias_Estoque_Almox 1

```dax
DIVIDE('Monitoramento Semanal'[Saldo Almox 1], 'Monitoramento Semanal'[Consumo_Medio_Diario])
```

## Monitoramento Semanal · tempo_reposicao

```dax
VAR MesAnoSemanal = FORMAT('Monitoramento Semanal'[Data do Relatório], "YYYYMM")RETURN CALCULATE(MAX('ParametrosMRP'[Tempo Reposição]),FILTER('Monitoramento Mensal','Monitoramento Mensal'[Codigo] = 'Monitoramento Semanal'[Codigo] &&FORMAT('Monitoramento Mensal'[Data do Relatório], "YYYYMM") = MesAnoSemanal))
```

## Monitoramento Semanal · Status_Estoque_Almox1

```dax
SWITCH (TRUE(),ISBLANK ( 'Monitoramento Semanal'[Dias_Estoque_Total] ), "🟠 Sem consumo",IF ('Monitoramento Semanal'[Dias_Estoque_Almox 1] > 0,'Monitoramento Semanal'[Dias_Estoque_Almox 1],'Monitoramento Semanal'[Dias_Estoque_Total])< RELATED ( ParametrosMRP[Tempo Segurança] )+ RELATED ( ParametrosMRP[Tempo Reposição] ), "🔴 Crítico",IF ('Monitoramento Semanal'[Dias_Estoque_Almox 1] > 0,'Monitoramento Semanal'[Dias_Estoque_Almox 1],'Monitoramento Semanal'[Dias_Estoque_Total])< RELATED ( ParametrosMRP[Tempo Segurança] )+ RELATED ( ParametrosMRP[Tempo Reposição] ) + 10, "🟡 Atenção","🟢 Ok")
```

## Monitoramento Semanal · BuscaProduto

```dax
'Monitoramento Semanal'[Codigo] & " - " & 'Monitoramento Semanal'[Produto]
```

## Monitoramento Semanal · AnoMes

```dax
FORMAT('Monitoramento Semanal'[Data do Relatório], "YYYY-MM")
```

## Monitoramento Semanal · Estoque de Segurança

```dax
VAR MesAnoSemanal = FORMAT('Monitoramento Semanal'[Data do Relatório], "YYYYMM")RETURN CALCULATE(MAX('ParametrosMRP'[Estoque Segurança]),FILTER('Monitoramento Mensal','Monitoramento Mensal'[Codigo] = 'Monitoramento Semanal'[Codigo] &&FORMAT('Monitoramento Mensal'[Data do Relatório], "YYYYMM") = MesAnoSemanal))
```

## AnaliseDiariaMRP · MensagemDeCompracoluna

```dax
VAR EstoqueAlmox1=[Estoque Almox 1 medida] VAR ConsumoAjustado=[Consumo Ajustado] VAR DataHoje=TODAY() VAR UltimoDiaMes=EOMONTH(DataHoje,0) VAR DiasRestantesMes=DATEDIFF(DataHoje,UltimoDiaMes,DAY)+1 VAR ConsumoDiario=DIVIDE(ConsumoAjustado,DiasRestantesMes,0) VAR DiasReposicao=COALESCE(SELECTEDVALUE(ParametrosMRP[Tempo Reposição]),0) VAR DiasSeguranca=COALESCE(SELECTEDVALUE(ParametrosMRP[Tempo Segurança]),0) VAR EstoqueSeguranca=COALESCE(SELECTEDVALUE(ParametrosMRP[Estoque Segurança]),0) VAR EstoqueProjetado=EstoqueAlmox1 VAR DiasCobertos=DIVIDE(EstoqueProjetado,ConsumoDiario,0) VAR DataEstoqueAcaba=DataHoje+ROUNDUP(DiasCobertos,0) VAR EstoqueAposReposicao=EstoqueProjetado-(ConsumoDiario*DiasReposicao) RETURN SWITCH(TRUE(),ConsumoDiario=0,"⚠️ Sem consumo registrado",DataEstoqueAcaba>UltimoDiaMes,"🟢 Estoque suficiente até fim do mês",EstoqueAposReposicao<EstoqueSeguranca,"🔴 Comprar agora — risco de ruptura",DiasCobertos<=DiasReposicao+DiasSeguranca+2,"🟠 Estoque crítico — cobertura muito baixa",DiasCobertos<=DiasReposicao+DiasSeguranca+5,"🟡 Estoque baixo — planeje reposição",TRUE,"🟢 Estoque adequado")
```

## Historico_Consumos · Item_Descricao

```dax
Historico_Consumos[Item] & " - " & Historico_Consumos[Descrição]
```

## Monitoramento Semanal · Estoque Dia Anterior

```dax
VAR CodigoAtual = 'Monitoramento Semanal'[Codigo]VAR DataAtual = 'Monitoramento Semanal'[Data do Relatório]VAR DataAnteriorValida =CALCULATE(MAX('Monitoramento Semanal'[Data do Relatório]),FILTER('Monitoramento Semanal','Monitoramento Semanal'[Codigo] = CodigoAtual &&'Monitoramento Semanal'[Data do Relatório] < DataAtual))RETURN CALCULATE(SUM('Monitoramento Semanal'[Saldo Total  ]),FILTER( 'Monitoramento Semanal', 'Monitoramento Semanal'[Codigo] = CodigoAtual &&   'Monitoramento Semanal'[Data do Relatório] = DataAnteriorValida))
```

## Monitoramento Semanal · Variação %

```dax
VAR Atual = 'Monitoramento Semanal'[Saldo Total  ] VAR Anterior = 'Monitoramento Semanal'[Estoque Dia Anterior]RETURN IF(ISBLANK(Anterior), BLANK(), DIVIDE( Atual - Anterior, Anterior ))
```

## Monitoramento Semanal · Classificação Variação

```dax
VAR VarPct = 'Monitoramento Semanal'[Variação %]RETURN SWITCH(TRUE(), ISBLANK(VarPct), "🟩", VarPct < -0.30, "🟥",VarPct >= -0.05 && VarPct <= 0.05, "🟩","🟨")
```

## Monitoramento Semanal · Variação % Status

```dax
VAR VarPct = 'Monitoramento Semanal'[Variação %]RETURN IF( ISBLANK(VarPct),"🟩 0,0 %",SWITCH(TRUE(),VarPct < -0.30, "🟥 ",VarPct >= -0.05 && VarPct <= 0.05, "🟩 ",TRUE(), "🟨 ") &FORMAT(VarPct, "+0.0%;-0.0%;0.0%"))
```
