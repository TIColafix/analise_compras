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
