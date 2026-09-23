# Colafix — Compras e MRP

Aplicativo local com Dashboard, MRP, Estoque e Movimentações. Agora usa dados das planilhas referenciadas pelo Power BI fornecido, com regras extraídas e diferenças documentadas em [docs/REGRAS.md](docs/REGRAS.md). O Dashboard resume estoque abaixo do mínimo, pedidos atrasados e compras críticas.

## Executar

Node.js 18 ou superior: `npm start` (ou `node server.mjs`). Abrir http://127.0.0.1:4173. O servidor escuta somente em 127.0.0.1. Sem dependências npm.

`npm test` verifica regras e exemplos conferidos contra as referências fornecidas. A suíte de integração usa a base local importada.

## Atualizar fontes

1. Colocar as versões autorizadas de `Monitoramento_mrp.xlsx` e `Consumos atualizado.xlsx` em `source-data/` (guardar backup antes de substituir).
2. Instalar os pacotes de `scripts/requirements.txt` e executar `python scripts/import_data.py`.
3. Recarregar a aplicação. O importador gera `dist/data.json` e o relatório `docs/qualidade-dados.json`.

Também pode usar `python scripts/import_data.py --source "caminho da pasta"`. Se a pasta contiver o lote `erp/`, os três relatórios serão aplicados após os Excel. Para reaplicar somente o lote sobre uma base existente: `python scripts/import_erp.py`. Arquivos idênticos não são duplicados. O importador não modifica as fontes nem consulta o ERP. Arquivos de fonte e base gerada estão excluídos do Git por padrão.

O lote de 27/04/2026 inclui 6 necessidades, 71 perfis, 484 movimentos e 107 posições de estoque. Consulte [o relatório de importação](docs/IMPORTACAO-ERP.md) para origem, conferências e ausências. A área MRP abre com todos os 71 itens do relatório, incluindo MP0410. Os filtros separam necessidades do CSV e alertas calculados sobre a lista completa.

## Uso

Escolher a área no menu lateral, data disponível no relatório, fornecedor/material e filtros. Estoque conserva filtro e seleção ao navegar. MRP permite visualizar a lista original ou somente alertas calculados. Perfil, pedidos e parâmetros refletem o item/data. Mensagem original é somente leitura; o campo de observação local é rascunho por item/data e se perde ao recarregar.

Não somamos quantidades de unidades diferentes. Datas inválidas e conflitos são sinalizados. Recomendação pode ficar bloqueada quando o horizonte é passado ou faltam parâmetros. Veja o diagnóstico no Dashboard e o relatório completo em docs.

## Arquitetura e continuidade

- `dist/engine.js`: regras numéricas, joins e proteções de dados.
- `dist/app.js`: navegação, filtros e visualização.
- `dist/index.html` e `dist/style.css`: estrutura e estilo compartilhado.
- `scripts/import_data.py`: importação reproduzível e relatório de qualidade.
- `docs/FORMULAS-DAX.md`: medidas e colunas extraídas.
- `docs/modelo-extraido.json`: consultas, relações e proveniência.
- `docs/REGRAS.md`: mapeamento de campos, equivalências, correções e limites.

Não há autenticação, emissão de pedidos, persistência de anotações ou atualização automática. Repositório de continuidade: https://github.com/PauloSaraivaCampos/analise_compras (privado). Antes de uso operacional, validar com o responsável as correções de data/horizonte e as lacunas da base. A implementação é independente do Frota System. GitHub poderá transportar código e documentação quando autorizado, não transfere automaticamente conversas.

## Importação diária pela aplicação

Abra Importações no menu lateral. Selecione o CSV de necessidades, o PDF do perfil e o PDF de saldos; clique Conferir arquivos e depois Salvar lote no histórico. Os nomes podem variar diariamente, mas os documentos precisam manter o formato FOCCO conhecido. Os dois PDFs devem indicar a mesma data; confirme que o CSV pertence a esse dia. Limite: 30 MB por lote.

Os lotes são arquivados em source-data/imports/ com nomes originais registrados. A base anterior é copiada para source-data/backups/ antes da gravação. Datas anteriores permanecem no seletor de análise, e a maior data de lote ERP torna-se a seleção inicial. Lotes idênticos não duplicam dados; um lote diferente na mesma data é bloqueado para preservar a versão existente. Ainda não há substituição/revisão de um dia pela interface.

Os PDFs de perfil representam planejamento, não lançamentos realizados REP/REQ. Por isso estas importações atualizam MRP, parâmetros e posições diárias de estoque; o gráfico mensal de movimentos realizados continua dependendo da fonte histórica de movimentos. A média mensal de estoque não é inventada para meses sem essa informação.

Validação adicional: python tests/import_daily_test.py testa inclusão de novo dia em base temporária, preservação integral do histórico, backup, duplicação e conflito de data. O importador Excel bloqueia reconstrução quando existem vários lotes, para evitar apagar o histórico diário.

## Dashboard de prioridades

O Dashboard usa a data selecionada e reúne três listas: saldo confirmado do Almoxarifado 1 estritamente abaixo do estoque de segurança (adotado como mínimo), linhas OCL com quantidade positiva e entrega anterior à data da análise e itens classificados no MRP como Compra urgente ou Estoque crítico. As linhas OCL refletem o relatório; recebimento e efetivação de recomendações de cancelar/postergar devem ser confirmados no ERP. Não se somam unidades diferentes nem se reaproveitam pedidos de outra data. Os cartões levam às respectivas listas. Dados incompletos são sinalizados e não entram como estoque confirmado ou compra crítica calculada.

## Ajustes manuais dos parâmetros

Em Estoque ou MRP, abrir Editar parâmetros e salvar apenas os campos alterados. Os seis campos aceitam números não negativos; zero é valor informado. O ajuste tem vigência na data de análise selecionada e fica salvo na base local, com data/hora e backup anterior. O histórico anterior à vigência permanece intacto.

Um perfil importado depois do ajuste, cuja data de relatório seja posterior à vigência, tem prioridade somente nos campos não nulos. Campos vazios e itens ausentes mantêm o ajuste manual; reimportação idêntica não o remove. Cada parâmetro ajustado exibe sua origem. Para consumo médio editado, a cobertura do estoque passa a usar o valor ajustado e as substituições posteriores do perfil; itens sem edição continuam seguindo a média mensal original.

## Cargas de cimento

As abas Cimento a granel e Cimento ensacado mantêm agendamentos separados. Cada carga registra data, empresa (Colafix/Fixcol/Argamazza), pedido interno, fornecedor (Votorantim/Intercement), pedido do fornecedor, transportador (Itamar/Marielo), NF, observações e status. Pedido do fornecedor e NF podem ser preenchidos posteriormente. Números são armazenados como texto, preservando zeros iniciais.

Status: Agendado, Carregado, Entregue e Cancelado. É possível corrigir o status e editar a carga; toda mudança fica no histórico, com data/hora e valores anteriores. Filtros por empresa, status e busca de pedido/NF/transportador. Não há exclusão de cargas; cancelamentos ficam disponíveis.

Persistência em source-data/cement-loads.json, independente dos relatórios ERP, com backup por gravação. Controle de versão impede salvar sobre uma alteração feita em outra janela. Teste: node --test tests/cement.test.mjs. Os cadastros não enviam pedidos ou mensagens a fornecedores/transportadores.
