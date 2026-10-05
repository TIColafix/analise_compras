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


### Entregas parciais e reprogramação dos prazos

Em 25/09/2026 a aba **Prazos de entrega** foi ampliada para o controle operacional: o código do item ganhou largura mínima para não ser truncado; cada pedido passa a mostrar **quantidade pedida, quantidade já entregue e saldo pendente**. O botão **Entrega parcial** registra a quantidade recebida sem finalizar o pedido; enquanto houver saldo, o pedido permanece em `Aguardando entrega` e aparece visualmente como **Parcial**. **Entregar saldo** conclui o restante e muda para `Entregue`. Os eventos de recebimento são guardados em `deliveryEventsJson` e a quantidade acumulada em `deliveredQuantity`, preservando compatibilidade com registros antigos.

A coluna **Nova data** agora é editável diretamente na tabela. Salvar uma nova data preserva a data original e passa a usar a reprogramada para atraso/próxima semana; limpar a nova data volta a considerar a data original. Foi adicionado KPI/filtro de **Parciais**. Entregues continuam no fim da lista, em ordem de data.


### Cadastro de pedidos comprados

Em 25/09/2026 a aba **Prazos de entrega** ganhou o cadastro manual **+ Adicionar pedido comprado**. O cabeçalho do pedido registra pedido de compra, contato/comprador, fornecedor, entrega prevista, frete e observação. Um mesmo pedido aceita vários itens; cada item possui código, produto, quantidade e unidade e é salvo como registro independente para permitir acompanhamento individual de entrega parcial, saldo, entrega final e reprogramação. Novos itens entram como **Aguardando entrega** e usam a persistência existente em `source-data/delivery-deadlines.json`, sem alterar a base importada do MRP.


### Dashboard considera pedidos comprados pendentes

Em 25/09/2026 o Dashboard passou a cruzar **Itens de compra em situação crítica** com a aba **Prazos de entrega**. Para o mesmo código e unidade, pedidos em `Aguardando entrega` têm apenas o saldo ainda não recebido considerado. Se esse saldo comprado for suficiente para cobrir a necessidade calculada até o estoque de segurança, o item deixa de aparecer como compra crítica/urgente no Dashboard. Entregues e cancelados não entram como pendência; entregas parciais consideram somente o saldo restante. O MRP de origem continua preservado e o cruzamento afeta a priorização visual do Dashboard.


### Motor operacional de compra com Prazos de entrega

Em 25/09/2026 o MRP passou a tratar **Prazos de entrega** como fonte dos itens já comprados e aguardando chegada. O novo plano por item cruza código e unidade, usa somente saldo pendente de entregas parciais e respeita a data reprogramada quando houver. O motor diferencia **Comprar**, **Já comprado**, **Antecipar entrega**, **Comprar complemento** e **Antecipar + comprar complemento**.

A data recomendada de antecipação é o limite calculado para o saldo do Almox. 1 alcançar o estoque de segurança. A quantidade de reposição protege estoque de segurança + consumo durante lead time e tempo de segurança, abatendo pedidos pendentes e aplicando lote mínimo/múltiplo. A taxa de consumo usada na regra operacional é a maior entre a projeção diária OFA/OFP do snapshot e a média mensal/30, evitando somar as duas referências e duplicar consumo.

Também foi corrigida a data de início de compra para nunca sugerir uma data futura quando, pela segurança + lead time + buffer, a compra já deveria ter sido iniciada. O Dashboard só oculta um alerta como já comprado quando a quantidade pendente é suficiente **e chega a tempo**; pedido tardio permanece como prioridade de antecipação e pedido insuficiente permanece como necessidade de complemento.

Teste sintético adicionado em `tests/purchase-plan.test.mjs` cobrindo MP0214-like: compra com múltiplo de lote, pedido suficiente atrasado, pedido atrasado insuficiente e pedido suficiente no prazo. Os testes foram adicionados ao repositório, mas não foram executados por esta integração GitHub; executar `node --test tests/*.test.mjs` no PC antes da validação operacional.

### Status direto no card semanal de cimento

Em 25/09/2026 o selo de status dos cards da programação semanal passou a ser editável no próprio card. O usuário pode trocar diretamente entre **Agendado**, **Carregado**, **Descarregado** e **Cancelado**, sem abrir o formulário completo. A alteração usa a mesma API de cargas, preserva versionamento e histórico. Registros legados com status `Entregue` continuam com estilo de concluído, mas as novas opções operacionais usam `Descarregado`.


### Compras de manutenção

Em 25/09/2026 foi iniciado o módulo independente **Compras Manutenção** para centralizar solicitações que chegam por OC, WhatsApp ou outro meio. A persistência fica em `source-data/maintenance-orders.json`, com backup antes de cada gravação, numeração automática `MAN-0001` etc., versionamento e histórico de alterações. O módulo não altera dados do MRP/ERP.

A primeira interface operacional permite cadastrar material ou serviço, origem, solicitante, responsável pela compra, OC, prioridade, equipamento/setor, quantidade/UM, data necessária, status, fornecedor escolhido, pedido no sistema, entrega prometida e observações. O fluxo contempla Solicitado, Em cotação, Aguardando aprovação, Pedido emitido, Aguardando entrega, Recebido/Concluído, Cancelado e Duplicado. A tela possui indicadores de abertos, em cotação, aguardando entrega e urgentes, busca geral e edição clicando na linha. Durante a digitação da descrição, solicitações abertas com termos semelhantes são exibidas como possível duplicidade para reduzir compras repetidas entre compradores.

A estrutura de dados já reserva `quotesJson` para a próxima evolução de comparação estruturada de cotações por fornecedor. Validação automatizada deste novo módulo ainda deve ser adicionada/executada localmente antes do uso operacional.


### Kanban de manutenção

Em 25/09/2026 a visualização principal de **Compras Manutenção** foi transformada em um quadro Kanban/post-it, mantendo a lista como visualização alternativa. As colunas representam Solicitado, Em cotação, Aguardando aprovação, Pedido emitido, Aguardando entrega e Concluído/Cancelado. Cada card mostra número, descrição, solicitante, comprador responsável, origem/OC, prazo necessário, quantidade, equipamento, fornecedor e pedido. O status pode ser alterado diretamente no card e o registro muda de coluna após a gravação. Foram adicionados filtros de status e origem, busca geral e seis indicadores operacionais no topo. O formulário e o aviso de possível duplicidade continuam disponíveis ao clicar no card ou criar nova solicitação.


### Dados comerciais da manutenção

Em 25/09/2026 o cadastro de manutenção passou a registrar, sem alterar os registros existentes, valor total, condição de pagamento, data do pedido e data prevista de execução do serviço. Estes dados ficam no bloco comercial reservado em `quotesJson`, preservando compatibilidade com o arquivo local já existente. Valor e condição de pagamento aparecem no post-it. Solicitações em `Aguardando entrega` sem `promisedDate` recebem alerta visual de prazo não informado. A evolução seguinte continua sendo transformar `quotesJson` em comparação estruturada de múltiplos fornecedores/cotações.


## Dashboard operacional

Em 26/09/2026 o Dashboard inicial foi redesenhado no estilo visual aprovado pelo usuário: cartões coloridos, atalhos para todas as áreas operacionais e painéis resumidos clicáveis. A tela usa somente dados já disponíveis na aplicação: MRP/estoque, pedidos da semana, alertas, Prazos de entrega e acessos aos módulos de Cimento, Diesel, Movimentações, Importações e Compras Manutenção. Os detalhes de alertas continuam abrindo sem remover a navegação para o MRP. Não foram inventados dados para módulos que ainda não expõem resumo consolidado ao app principal; nesses casos o cartão funciona como acesso rápido.


### Dólar, diesel e clima no Dashboard

Em 26/09/2026 o Dashboard passou a carregar um resumo externo com cotação USD/BRL e previsão de 7 dias para Cachoeirinha/RS. A previsão usa Open-Meteo e é exibida com máxima, mínima, probabilidade de precipitação e ícone por dia. O bloco de Diesel S500 usa o último preço válido já registrado na própria aba Diesel, evitando inventar uma cotação externa diária. Se uma fonte externa falhar, o Dashboard mostra indisponibilidade sem impedir o restante da aplicação. A rota local é GET `/api/external-summary`.


### Recálculo após alterações manuais

Em 26/09/2026 foi adicionado recálculo do planejamento quando um pedido em Prazos de entrega é criado ou alterado. Após a gravação, o módulo emite um evento local e `app.js` recarrega os pedidos em aberto, fazendo MRP, cobertura, necessidade complementar e Dashboard usarem imediatamente os novos valores. O Dashboard também ganhou o botão `Recalcular planejamento`, que força a recarga dos pedidos e a renderização dos cálculos sem alterar os dados persistidos. Quantidade de compra pendente continua separada do saldo físico de estoque: alterar um pedido não simula recebimento no almoxarifado.


### Manutenção alinhada ao layout aprovado

Em 27/09/2026 a interface de Compras Manutenção foi redesenhada conforme o mockup aprovado, sem alterar ou recriar `source-data/maintenance-orders.json`. O Kanban ganhou KPIs coloridos, cards compactos, alertas de prazo e ações funcionais de visualizar, editar, compartilhar por WhatsApp e avançar etapa. A visualização detalhada mostra o fluxo da solicitação, dados gerais, cotações e histórico. Foi habilitado cadastro de múltiplas cotações dentro de `quotesJson` com `kind: "quote"`, preservando o bloco comercial legado `kind: "commercial"` e os registros existentes. A visualização em lista continua disponível. Não há exclusão automática de solicitações.


### Importação de pedido PDF em Prazos de entrega

Em 28/09/2026 a aba **Prazos de entrega** ganhou importação de pedido de compra em PDF no formato FoccoERP RPDC0250. O fluxo lê o PDF localmente pelo servidor da aplicação, extrai número do pedido, comprador/contato, fornecedor, frete, condição de pagamento e os itens (código, descrição, quantidade, unidade e data de entrega). A tela preenche uma prévia editável antes de salvar; nada é gravado automaticamente ao selecionar o PDF. Cada item passa a aceitar sua própria data de entrega, usando a data geral como fallback para cadastro manual. O parser inicial foi modelado pelo pedido 7429/Nova Chamfer fornecido pelo usuário. Se o cabeçalho e os itens trouxerem datas divergentes, o importador preserva a data de cada item e exibe aviso para conferência. PDFs importados para leitura ficam na área local ignorada `source-data/imports/purchase-orders`; não enviar dados operacionais ao Git.


## Cotações de Matéria Prima
- Nova aba `#mpquotes`, separada de Compras Manutenção.
- Registros usam a mesma persistência segura de manutenção com `category: MP`; registros antigos sem categoria continuam na Manutenção e não são migrados.
- Fluxo: Solicitado, Em cotação, Aguardando aprovação, Pedido emitido, Aguardando entrega, Recebido/Concluído e Cancelado.
- Cadastro contém empresa, solicitante, comprador, código do material, quantidade/UN, necessidade e observações.
- Cada solicitação aceita múltiplas cotações com fornecedor, valor, prazo de entrega, condição de pagamento e observação; permite editar e excluir.
- Análise compara preço 40%, entrega 30% e pagamento 30%, valorizando pagamentos com prazos maiores/parcelados e penalizando à vista.
- Dados operacionais continuam em `source-data/maintenance-orders.json`; nunca apagar/recriar para testes.


## Relatórios operacionais
Em 01/10/2026 foi criado `dist/reports.js` com painel padronizado de relatório para Diesel, Cimento a granel, Cimento ensacado, Prazos de entrega, Cotações de MP e Compras Manutenção. Cada módulo possui **Imprimir relatório** (A4 horizontal, sem menu da aplicação) e **Baixar Excel** (arquivo .xls com dados em colunas). A primeira versão usa os registros e filtros visíveis na própria tela, sem alterar dados operacionais. Ajustar posteriormente colunas/resumos específicos de cada módulo conforme validação do usuário.


## Migração web — 05/10/2026

A migração para web está sendo desenvolvida exclusivamente na branch `web-migration`; a branch `main` permanece como versão operacional local. Foi criado um projeto privado no Railway com PostgreSQL, mas os dados operacionais ainda não foram migrados e a aplicação não deve ser publicada para uso externo antes de autenticação e persistência online estarem prontas.

O servidor passou a aceitar `PORT` e `HOST` por ambiente. Localmente, sem variáveis de nuvem, continua em `127.0.0.1:4173` com as mesmas restrições de Host/Origin. Em ambiente Railway, usa `0.0.0.0` e a porta fornecida pela plataforma. `APP_ORIGIN` será usada para restringir a origem pública quando o domínio definitivo for configurado. Não colocar dados de `dist/data.json` ou `source-data/` no Git.

Regra operacional de estoque confirmada pelo usuário: análises de compras/MRP devem considerar exclusivamente o saldo do **Almoxarifado 1 (MATERIA PRIMA)** como disponível. Almoxarifado 2 representa material já em produção e não deve ser somado ao saldo disponível para compras.


### Persistência PostgreSQL operacional — 05/10/2026

Na branch `web-migration`, os módulos Cimento, Diesel, Prazos de entrega e Compras Manutenção/Cotações de MP passam a usar PostgreSQL quando `DATABASE_URL` estiver configurada. Sem essa variável, o comportamento local permanece nos JSON privados existentes, preservando a versão operacional.

A tabela `app_documents` guarda documentos JSONB versionados por chave nesta primeira etapa, reduzindo o risco de alterar o formato consumido pela interface durante a migração. O comando `npm run db:migrate-operational` copia os quatro arquivos operacionais locais para o banco somente quando a respectiva chave ainda não existe; dados já existentes no PostgreSQL nunca são sobrescritos pelo migrador. Não adicionar `source-data/` nem `dist/data.json` ao Git.

O MRP principal, snapshots ERP, ajustes de parâmetros e fluxo de importação diária ainda permanecem em `dist/data.json` nesta etapa e devem ser migrados separadamente antes do corte definitivo para web. A aplicação pública também continua sem autenticação e não deve ser liberada externamente até essa proteção estar implementada.


## Migração web segura (05/10/2026)

A branch `web-migration` passou a proteger o serviço Railway com autenticação HTTP Basic definida somente por variáveis `APP_USER` e `APP_PASSWORD`. Em Railway, sem essas duas variáveis o serviço fica bloqueado (exceto `/api/health`), evitando publicar dados operacionais por engano.

Foi criada a página temporária `/migration`, habilitada para gravação somente quando `ALLOW_DATA_MIGRATION=true`. Ela recebe os cinco documentos locais principais (base ERP `dist/data.json`, cimento, diesel, prazos e manutenção/MP) e grava no PostgreSQL em `app_documents` somente quando a chave ainda não existe; documentos remotos existentes são preservados e nunca sobrescritos. Após a carga inicial, definir `ALLOW_DATA_MIGRATION=false` ou remover a variável.

Quando existe `main-data` no PostgreSQL, GET `/data.json` passa a servi-lo; sem documento remoto, o comportamento local continua usando `dist/data.json`. Ainda falta migrar as rotas que alteram a base principal (parâmetros e importação ERP) para persistirem `main-data` no PostgreSQL antes do corte operacional definitivo. Não usar a web para novas importações/edições da base principal até essa etapa ser concluída.
