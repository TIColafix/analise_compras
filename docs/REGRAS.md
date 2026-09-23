# Regras do Power BI e aplicação web

## O que foi analisado

Layout e filtros do arquivo `Monitoramento MRP.pbix` fornecido. As 39 medidas DAX, colunas calculadas, consultas Power Query e relações foram recuperadas do arquivo SQLite de metadados do modelo aberto no Power BI Desktop. O relatório tem as páginas MRP, ESTOQUE e MOVIMENTAÇÕES. Os resultados foram confrontados com as imagens fornecidas e com as planilhas identificadas pelas consultas. Não foi possível executar consultas ao modelo por ADOMD nesta sessão: a autenticação Windows local não disponibilizou credenciais. Portanto não se afirma equivalência completa de todos os contextos de filtro do motor DAX.

Fórmulas completas: `FORMULAS-DAX.md`. Consultas e relações: `modelo-extraido.json`.

## Fontes e campos

| Fonte / aba | Campos usados | Função |
|---|---|---|
| Monitoramento_mrp.xlsx / AnaliseDiariaMRP | Data de Análise, Cód. Item, Descrição, UM, Estoque Atual, Almox 1, Mensagem Usuário | Lista de itens por data, saldos e mensagem |
| MovimentacoesMRP | Data Relatório, Item, Data Fim, Tipo, Referência, Quantidade, Estoque Projetado | Perfil, consumo OFA/OFP e pedidos |
| ParametrosMRP | Item, UM, Consumo Médio, Estoque Segurança, Tempo Reposição, Tempo Segurança, Lote Mínimo, Lote Múltiplo | Cadastro de parâmetros |
| Monitoramento Mensal | Codigo, Data do Relatório, Consumo médio, Estoque segurança | Média por item e mês |
| Monitoramento Semanal | Codigo, Produto, Data do Relatório, Saldo Total, Saldo Almox 1, Pedido/Observações | Posição de estoque por data |
| Fornecedor_Preferencial | Codigo, Produto, Fornecedor preferencial | Cadastro de fornecedor |
| Consumos atualizado.xlsx / Movimentos | Item, Descrição, Tipo Movimento, Data Requisição, Quantidade | Histórico real de consumo |

A coluna Valor do histórico não é importada para o aplicativo: não é necessária aos cálculos solicitados. A unidade do histórico é obtida de ParametrosMRP; quando ausente, o app informa UM não cadastrada. Não há soma de materiais com unidades diferentes.

## O que coloca um item na lista de compra

O seletor da página MRP usa `AnaliseDiariaMRP[ItemDescricao]`, filtrado pela data e pelo fornecedor. Não foi encontrado filtro DAX de necessidade de compra nesse visual. Assim, a seleção inicial dos itens já está na planilha/rotina anterior ao relatório. O app mantém a lista original e oferece, separadamente, o filtro “Com alerta de compra”. Não se deve afirmar que o Power BI gera a lista de itens por uma fórmula de reposição.

## Consumos e cobertura

- Consumo ajustado: soma Quantidade de todas as referências OFA e das referências OFP com Data Fim maior ou igual à data selecionada. Somente movimentos com Data Relatório igual à data selecionada.
- Cartão chamado “Consumo projetado do mês” no PBIX: soma OFA + OFP no relatório selecionado, **sem filtrar o mês**. No app o nome é “Consumo projetado do relatório”. Não é média × dias do mês.
- DiasDeEstoque do MRP: Almox 1 ÷ (Consumo Médio de ParametrosMRP ÷ 30). O estoque total não substitui Almox 1 nessa regra.
- Estoque: Consumo_Medio_Mensal é o maior consumo médio do mesmo código no mesmo ano/mês em Monitoramento Mensal. Divide-se por 30 para obter a média diária. Coberturas = saldo total ou almox 1 ÷ média diária.
- Status estoque: sem cobertura → Sem consumo. Usa cobertura Almox 1 quando positiva, senão total. Abaixo de reposição + tempo segurança → Crítico; abaixo desse limite + 10 → Atenção; caso contrário → Ok.
- Variação: procura a última data anterior disponível do mesmo código (não exige dia consecutivo). (Saldo atual − anterior) ÷ anterior. Base ausente ou zero retorna indisponível.
- Histórico: soma Quantidade somente dos tipos REP e REQ, agrupados por item, ano e mês. O app mantém o sinal original.

## Mensagem de compra

A medida MensagemDeCompra usa outra média diária: Consumo Ajustado ÷ dias até a maior Data Fim. Essa média não é a mesma usada no cartão DiasDeEstoque.

Com a média diária projetada válida:

1. Saldo após reposição = Almox 1 − consumo diário projetado × tempo reposição.
2. Se saldo após reposição < estoque segurança → Compra urgente.
3. Caso contrário, cobertura projetada ≤ reposição + tempo segurança + 2 → Estoque crítico.
4. Caso contrário, cobertura ≤ reposição + tempo segurança + 5 → Estoque baixo.
5. Estoque adequado quando cobre o mês, excede reposição + segurança e Almox 1 supera estoque segurança; demais casos → Estoque baixo.
6. Data sugerida para iniciar compra = data base + arredondamento para longe de zero de (cobertura − reposição − tempo segurança), conforme ROUNDUP DAX.

Pedidos não são abatidos desta projeção no DAX original. Lote mínimo e lote múltiplo são exibidos, mas nenhuma fórmula de quantidade sugerida foi encontrada. O aplicativo não inventa quantidade recomendada nem emite pedidos de compra.

## Diferenças deliberadas e verificáveis

- TODAY() foi substituído pela data de análise selecionada. O horizonte usa o mesmo relatório/item, sem misturar snapshots antigos/futuros. Se o período terminar antes da análise, a recomendação é suspensa. Não corrigimos datas digitadas erradas por adivinhação.
- Parâmetros de reposição/segurança ausentes bloqueiam recomendação; o DAX usa COALESCE(...,0). Unidades divergentes e saldos conflitantes também bloqueiam.
- Saldos repetidos idênticos do mesmo item/data são considerados uma vez; conflitos não são somados. O cartão original usa SUM e pode duplicar esses saldos.
- Histórico REP/REQ: o DAX usa CALCULATE com filtro sobre Tipo Movimento, que substitui o filtro prévio da mesma coluna. No app, REP + REQ reproduz a medida; escolher REP ou REQ separadamente é uma análise adicional explícita. Referência: https://learn.microsoft.com/en-us/dax/calculate-function-dax
- Relações operacionais feitas pelo código do item; há relações no PBIX por Produto e algumas relações inativas/inconsistentes. Não reproduzimos ligações por descrição suscetíveis a grafia diferente.
- Aviso de ruptura pode ser consultado para a data selecionada; o DAX só mostra se data = TODAY(). Avalia OCL futuro do mesmo snapshot. Sem cobertura/parâmetros → Não calculável; cobertura ≤ 0 → Ruptura; sem OCL futuro → Sem pedido; entrega na data de esgotamento ou depois → Risco de ruptura; antes → Sem risco.
- Perfil MRP mostra todos os movimentos do item/relatório. Pedidos MRP: OCL; painel estoque: OCL ou AVR, como filtros dos visuais. Não se presume que OCP seja pedido aberto.

## Qualidade e atualização

Importação inicial: 1.130 registros de análise diária, 87.593 movimentos MRP, 109 parâmetros, 1.540 médias mensais, 10.179 posições de estoque, 108 fornecedores e 103.963 movimentos históricos. O histórico foi agregado por item/mês/tipo, preservando as somas.

Foram registradas 120 ocorrências: 16 chaves duplicadas na análise diária, 103 no estoque semanal e uma data inválida `06/03/0206`. Consulte `qualidade-dados.json`. Chaves duplicadas não significam necessariamente valores conflitantes.

Última análise MRP: 27/04/2026. Última posição de estoque: 11/05/2026. Médias mensais terminam em abril/2026. Histórico de movimentos termina em 30/01/2026. São fotografias dos arquivos locais, não estoques de hoje.

Em MP0023/27-04-2026, os cartões reconciliam: estoque 11.003,80 KG; Almox 1 2.500 KG; consumo ajustado 9.303,80 KG; projetado 10.603,80 KG; cobertura 8,98 dias. O último movimento do snapshot termina antes da data de análise; a mensagem fica bloqueada como Período inválido, em vez de usar consumo diário negativo.

Conferência adicional: cinco coberturas/status da imagem de estoque e os nove valores de janeiro a março de 2023–2025 para E00004 conferem. Ainda é necessária validação operacional das correções, principalmente horizonte, tratamento de saldos duplicados e parâmetros ausentes, antes de usar recomendações para emitir compras.

## Verificação final desta versão

Sete testes automatizados aprovados: cartões MP0023, cinco linhas de estoque, ausência de média mensal, duplicidade/conflito, OFA/OFP, nove valores históricos e consumo ausente. Navegador: filtros, seleção, datas históricas, quatro telas em 390 px sem transbordamento horizontal e seleção WebMCP válida/inválida. A conferência é por amostras e regras, não execução exaustiva do motor DAX.
