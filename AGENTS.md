# Orientações para continuar Compras/MRP no Codex

Leia CONTINUIDADE.md e README.md antes de alterar a aplicação. O usuário desenvolve alternadamente em casa e na empresa. Este repositório contém o código e a documentação; a conversa do Codex e os dados operacionais locais não são sincronizados pelo Git.

## Rotina entre computadores

- Antes de trabalhar, confira git status e a branch/remoto. Se houver alterações locais, preserve-as antes de atualizar. Não use reset --hard, clean ou push --force para resolver divergências.
- Com a árvore limpa e remoto configurado, atualize com git pull --ff-only. Se houver divergência, examine os commits e reconcilie sem descartar trabalho.
- Ao concluir, revise o diff, execute os testes pertinentes e atualize CONTINUIDADE.md com mudanças, validação e pendências. Faça commit e push quando solicitados pelo usuário.
- Não assuma que uma alteração está no outro PC antes de confirmar que o push terminou.

## Dados e execução

Node.js 18+, servidor local server.mjs na porta 4173. Python e scripts/requirements.txt para importar relatórios. A interface está em dist/ e não precisa de build.

Dados reais: dist/data.json e source-data/, incluindo cement-loads.json e backups. Permanecem fora do Git. Não inicialize, apague, reconstrua ou substitua esses dados para fazer testes. Se faltarem após clonar, explique que a cópia local precisa ser transferida separadamente; não invente uma base de produção.

Testes: node --test tests/*.test.mjs e python tests/import_daily_test.py. Os testes engine/import_daily exigem as fontes e base locais. cement.test.mjs usa diretório temporário. Diferencie testes aprovados de testes não executados por falta das fontes.

Preserve as regras documentadas: parâmetros manuais por campo cedem a valores não nulos de importações posteriores; zero é informado. Não misture snapshots de datas distintas. Nomes de PDF podem ocupar várias linhas. Não some unidades diferentes. Agendamentos de cimento são independentes das importações ERP.

Prefira repositório privado. Nunca inclua segredos, relatórios operacionais ou backups num commit sem instrução explícita para esses arquivos. Não publique a aplicação automaticamente ao enviar código ao GitHub.
