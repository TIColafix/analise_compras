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
