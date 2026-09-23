# Lote ERP de 27/04/2026

Foram importados os três arquivos fornecidos pelo usuário: Necessidades de compra do dia.csv, PERFIL ITENS 27.04.pdf e SALDO ALMOXARIFADOS 27.04.pdf. Os PDFs identificam 27/04/2026 como data do relatório. O CSV não informa data de extração e foi associado ao mesmo lote; compra e entrega permanecem datas separadas.

## Conteúdo e conferência

- 6 necessidades: item, descrição, unidade, quantidade, ordem, tipo, empresa, data de compra, entrega e mensagem.
- 71 perfis: reposição, segurança, estoque de segurança, consumo médio, lote mínimo/múltiplo quando informado e estoque inicial.
- 484 movimentos: 408 DD, 36 OCL, 29 AVR, 6 OCP, 2 DC, 2 DE e 1 DP. Referências quebradas entre linhas foram reunidas. DE sem sinal mantém direção e quantidade assinada nulas, sem inventar entrada ou saída.
- 107 posições: saldo total e detalhamento por almoxarifado. Todas reconciliam com a soma dos almoxarifados, tolerância de 0,0002. A primeira linha sobreposta do PDF foi conferida visualmente e pela soma das três posições.
- MP0410 foi adicionado ao catálogo e aos perfis consultáveis.

## Aplicação das fontes

O lote substitui somente registros correspondentes de 27/04/2026. Snapshots anteriores e posteriores, inclusive estoque de 11/05/2026, foram preservados e comparados automaticamente com o backup. Os parâmetros têm vigência a partir da data do lote; os parâmetros históricos originais permanecem disponíveis. Precisão decimal segue o PDF, podendo diferir ligeiramente do Excel não arredondado.

Quantidade sugerida de compra vem diretamente do CSV. A aplicação não inventa outra fórmula de quantidade. Mensagens de cancelar/postergar são exibidas como recomendações do ERP, sem executar ações. Consumos OFA/OFP continuam usando quantidades positivas como no Power BI; o sinal original aparece nos movimentos. Estoque inicial do perfil não substitui o saldo total dos almoxarifados.

MP0408 está no CSV/perfil, mas ausente do PDF de saldos. E00043 também não aparece nesse PDF. Valores anteriores são identificados como não confirmados e não geram recomendação automática. MP0410 pode ser consultado com seus movimentos, porém não possui saldo confirmado no lote.

Alguns horizontes de consumo terminam antes da data do relatório. A importação preserva essa informação e mantém o aviso de período inválido.

## Repetição e rastreabilidade

Os originais foram copiados para `source-data/erp/`, sem alteração. O backup pré-importação está em `source-data/backups/`. SHA-256 identifica cada arquivo e impede reaplicar o mesmo lote. A auditoria detalhada está em `importacao-erp-2026-04-27.json` e os avisos em `qualidade-dados.json`.

Validação: 11 testes aprovados, incluindo reconciliação de estoque, necessidades do CSV, movimentos neutros, ausências de saldo e preservação do histórico. Reaplicação do lote confirmou ausência de duplicação.
