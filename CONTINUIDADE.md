# Continuidade do projeto Compras/MRP

Aplicação local da Colafix. Executar node server.mjs, ou ABRIR-APLICACAO.cmd, porta 4173. Sem build e sem dependências npm. Python: scripts/requirements.txt.

- dist/app.js, engine.js, index.html, style.css: interface e regras MRP/estoque/dashboard.
- dist/imports.js e scripts/import_erp.py: importação diária CSV + dois PDFs, histórico por data, sem sobrescrever lote diferente no mesmo dia.
- dist/cement.js e cement-store.mjs: cargas a granel/ensacado, status e histórico, persistência separada em source-data/cement-loads.json.
- dist/data.json: dados reais, histórico e ajustes manuais de parâmetros. Não reconstruir pelos Excel apagando o histórico.
- source-data/: fontes e backups privados. Não publicar dados nem enviar ao GitHub sem autorização.
- docs/: regras extraídas do Power BI, importações e correção de 57 descrições multilinha de estoque.

Testes: node --test tests/*.test.mjs; python tests/import_daily_test.py. Testes usam fontes locais incluídas. Preservar dados de produção ao testar cadastros.

Parâmetros manuais cedem por campo a um arquivo posterior importado depois da edição; nulo não substitui, zero substitui. PDF: unir descrições multilinha; perfil preserva sequência e colunas da origem, valores com duas casas decimais. Dashboard abre resumido; cartão abre lista; item leva ao MRP filtrado na mesma data.

Último ajuste: histórico visual das cargas mostra somente eventos de status em ordem cronológica, com cores (Agendado amarelo, Carregado azul, Entregue verde, Cancelado vermelho). Novas cargas começam Agendado. Auditoria completa continua armazenada, sem apagar mudanças antigas.

O transporte entre PCs é uma cópia independente, não sincronização automática. Antes de definir compartilhamento, confirmar com usuário a forma de acesso e disponibilidade permitida pela empresa.

## Continuidade pelo GitHub

O usuário escolheu desenvolver alternadamente nos dois PCs pelo Codex usando GitHub. AGENTS.md define a rotina para a próxima tarefa: atualizar antes de trabalhar, preservar mudanças locais, registrar o estado e enviar commits ao encerrar. Remoto origin: https://github.com/PauloSaraivaCampos/analise_compras (privado). Confira sempre o envio antes de trocar de computador.

O Git transporta código e documentação, não os arquivos ignorados. Bases, ajustes e cargas continuam locais. A cópia completa já preparada permite levar o estado inicial para outro PC; alterações operacionais posteriores ainda exigem transferência separada ou futura base compartilhada. Não prometer sincronização desses dados por git pull.

Conexão GitHub autorizada para analise_compras. Código preparado para envio pela integração do Codex. Validado: 16 testes Node e 2 testes Python aprovados. Git HTTPS deste ambiente não conseguiu autenticar; usar integração quando necessário e manter histórico local alinhado ao remoto. Dados ignorados permanecem locais.


## Ajuste de inicialização sem base local

Corrigido em 24/09/2026: quando `dist/data.json` ainda não existe em um PC recém-clonado, a falha de carregamento não interrompe mais a navegação. A tela **Importações** e as áreas independentes continuam acessíveis para permitir carregar a base local. Dashboard, MRP, Estoque e Movimentações permanecem sem cálculo até existir uma base válida. A correção não cria, substitui nem apaga `data.json`, históricos, ajustes ou cargas locais.


## Programação semanal de cimento

Em 24/09/2026 a área de cimento ganhou uma visão **Programação semanal**, inspirada na planilha operacional `PROGRAMAÇÃO CIMENTO GRANEL.xlsx`. A agenda mostra segunda a sexta, quantidade de cargas por dia e cartões com fornecedor, pedido do sistema, pedido/contrato do fornecedor, NF, empresa, transportador, status e observações/avisos. A área **Todas as cargas** mantém cadastro, edição, filtros, status e histórico já existentes. Nenhum dado histórico foi importado automaticamente da planilha; a mudança é somente de interface e reaproveita `source-data/cement-loads.json`.

A programação semanal também possui navegação por semana (anterior, hoje e próxima), botão **+ Agendar carga** em cada dia útil que abre o cadastro com a data preenchida e não exibe o aviso da base Power BI nas telas de cimento, pois esse módulo é independente do MRP.

A agenda de cimento passou a separar visualmente as programações por empresa: **Cimento Colafix**, **Cimento Fixcol** e **Cimento Argamazza**. A empresa selecionada filtra tanto a programação semanal quanto a lista de cargas e é preenchida automaticamente ao iniciar um novo agendamento pelo dia. Os registros continuam na mesma persistência, preservando histórico e o campo `company`.

A pedido do usuário, a programação semanal de cimento a granel voltou a ser **uma agenda única**: Colafix, Fixcol e Argamazza aparecem juntas na mesma semana. Quando houver várias cargas no mesmo dia, os cartões ficam um abaixo do outro e cada cartão identifica claramente a empresa. A tela **Todas as cargas** continua permitindo filtrar por empresa. Isso altera apenas a visualização, sem mover ou apagar registros.

A agenda semanal única possui filtro rápido de empresa: **Todas / Colafix / Fixcol / Argamazza**. O padrão é Todas; selecionar uma empresa apenas filtra a visualização da semana, sem alterar, mover ou apagar os registros.

No cimento **a granel**, o cadastro passou a exigir **Quantidade do pedido** e **Descrição do cimento** (ex.: `32 t` e `CP II Z 40`). Os campos aparecem também nos cartões da programação semanal e na listagem de cargas. Foram adicionados somente ao granel; o ensacado mantém o fluxo anterior. Registros antigos sem esses campos continuam exibidos com `—` até serem editados.

## Cimento ensacado

Em 24/09/2026 o módulo **Cimento ensacado** passou a usar a mesma agenda semanal do granel, mas com os campos do controle operacional mostrado pelo usuário: **Data, Entrega/Empresa, Produto/Cimento, Quantidade em SC, Cidade, NF, OC, Freteiro/Transportador, OC Freteiro, Valor do frete, Status e Observações**. Na agenda, o cartão reproduz essa ordem de informações (CARGA/produto, entrega, quantidade, cidade, NF, OC, freteiro, OC freteiro e valor do frete). O filtro semanal por empresa e o histórico/status são mantidos. Campos novos são compatíveis com registros antigos, que podem permanecer vazios até edição.

Na conclusão desta etapa do **cimento ensacado**, os campos recorrentes foram convertidos em seleções conforme a planilha de referência: Produto/Cimento (`CPIV 50 KG`, `CPIV 25 KG`, `MP0026 - CPV 40 KG`, `MP0397 - CPIV 50 KG - PRODUÇÃO`), Cidade (`CACHOEIRINHA`, `PAROBÉ`, `NOVO HAMBURGO`, `PORTO ALEGRE`, `LAJEADO`, `TEUTONIA`, `MUÇUM`, `GRAVATAI`, `PROGRESSO`) e Freteiro (`CHAPELÃO`, `IVAN FREDERICO`). Revisar/expandir essas listas futuramente conforme surgirem novos cadastros.

O cimento ensacado agora aceita **1 a 4 produtos dentro da mesma carga/OC**, cada um com sua própria quantidade em sacos. O formulário possui **+ Adicionar produto** e remoção dos itens adicionais; a agenda semanal mostra todos os itens e o total de sacos. Para compatibilidade, registros antigos com apenas `bagProduct`/`bagQuantity` continuam sendo lidos como um pedido de um item. Os novos itens são persistidos em `bagItemsJson` e os campos legados recebem o primeiro item.

## Diesel

Em 24/09/2026 foi criada uma aba **Diesel**, separada dos módulos de cimento, usando a mesma lógica visual de programação semanal (segunda a sexta), navegação entre semanas, cadastro rápido pelo dia, filtros por empresa e acompanhamento em lista. Os campos foram baseados na planilha apresentada: **Data, Empresa, Combustível, Litros, Condição de pagamento, Preço por litro, NF, OC, Status e Observações**. Inicialmente o combustível vem como **DIESEL S500**, a empresa padrão como **Argamazza** e o pagamento como **boleto 5/10/15/20/25/30 dd**, todos editáveis/selecionáveis conforme o campo. Os dados ficam separados em `source-data/diesel-loads.json`, com backup antes de cada gravação e histórico por registro; não se misturam com `cement-loads.json`.

## Prazos de entrega

Em 24/09/2026 foi criada a aba **Prazos de entrega** para controle manual dos pedidos de compra. Campos: Código, Produto, Pedido de compra, Contato, Fornecedor, Status, Data de entrega prevista, Quantidade, Frete, UN, Nova data e Observação. A data original é preservada; reprogramações usam **Nova data** e todas as edições ficam no histórico do registro. A tela possui indicadores de atrasados, próximos 7 dias, aguardando entrega e entregues, além de filtros por fornecedor, status e busca. A tabela destaca atrasados em vermelho, próximos 7 dias em amarelo e entregues em verde. Persistência independente em `source-data/delivery-deadlines.json`, com backup antes de cada gravação; não alterar dados do MRP/ERP.


### Carga inicial dos prazos

Em 24/09/2026 o controle de Prazos de entrega recebeu uma carga inicial baseada nas linhas pendentes da planilha fornecida pelo usuário. Os registros iniciais ficam em dist/delivery-deadlines-initial.json e são mesclados com a persistência local sem sobrescrever registros locais com o mesmo ID. Linhas já entregues não fazem parte da carga inicial. Valores da coluna Nova data que não eram datas futuras coerentes foram preservados como observação para revisão, sem alterar a data efetiva do pedido.


### Correção do saldo FOCCO de 24/09/2026

O relatório REST0331.pdf revelou que o parser de saldos aceitava apenas as unidades KG, UN, SC, MT e PC. Quando encontrou AB0010 com unidade CX, a linha do item não era reconhecida e os almoxarifados desse item eram associados indevidamente ao item anterior AB0009, gerando o falso erro `Almoxarifado duplicado: AB0009`. O parser foi ampliado para as unidades observadas no relatório (incluindo CX, FD, L, TON, PCT, RL, BD e PAR) e a descrição passou a usar correspondência gulosa para não confundir palavras da descrição com a unidade. Validação direta no REST0331.pdf: 991 itens de saldo reconhecidos, nenhum item sem almoxarifado, nenhum almoxarifado duplicado e todos os 991 saldos reconciliados com a soma dos almoxarifados. O histórico não foi alterado por essa correção; ela atua somente na leitura de novos lotes.


### Primeira carga diária em computador novo

Em 24/09/2026 o fluxo de Importações foi ajustado para o uso operacional definido pelo usuário: todos os dias são enviados três relatórios do ERP (necessidades CSV, perfil PDF e saldos PDF). Se `dist/data.json` ainda não existir, **Conferir arquivos** não falha mais por ENOENT e **Salvar lote** cria a base local inicial diretamente a partir do primeiro lote válido. Os lotes seguintes acrescentam novas datas ao histórico, mantendo as anteriores e sem permitir substituição silenciosa de um lote diferente na mesma data. A criação inicial não inventa dados históricos de Excel: estruturas sem fonte no lote diário começam vazias e passam a ser preenchidas conforme os relatórios disponíveis.
