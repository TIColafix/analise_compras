# Compras/MRP em outro computador Windows

## O que acompanha esta cópia

Código completo, base importada, parâmetros manuais, agendamentos de cimento e seus históricos, arquivos de origem, auditorias e backups existentes no momento da exportação. O arquivo PACOTE.json informa data e hashes da cópia. Nenhum dado é publicado na internet.

## Abrir no computador da empresa

1. Extraia o ZIP inteiro para uma pasta própria, por exemplo Documentos\Compras-MRP. Não execute de dentro do ZIP.
2. O computador precisa de Node.js (18 ou superior, requisito do projeto). Para importar PDFs/CSV, precisa também de Python 3 e dos pacotes de scripts\requirements.txt. Se a empresa exigir instalação pela TI, peça a instalação a ela.
3. Para preparar a importação, no terminal aberto nessa pasta, execute: `python -m pip install -r scripts/requirements.txt`. A instalação baixa bibliotecas da internet; não envia os relatórios. É necessária uma vez por computador. Se Python estiver em outro caminho, defina a variável MRP_PYTHON com o caminho completo do executável.
4. Dê dois cliques em ABRIR-APLICACAO.cmd. Ele abre o navegador. Mantenha a janela do iniciador aberta enquanto usa a aplicação.
5. Endereço: http://127.0.0.1:4173/#dashboard. É um endereço local: só funciona enquanto o servidor deste computador estiver ligado.

## Continuar desenvolvendo

Abra a pasta extraída como projeto no Codex do outro PC. CONTINUIDADE.md descreve a estrutura e os cuidados com os dados. O código, os arquivos e esse documento são transferidos; a conversa do Codex não está dentro do ZIP.

## Alternar entre computadores sem perder dados

Esta cópia NÃO cria sincronização automática.

- Use apenas um PC por vez como versão principal.
- Ao terminar, pare o servidor com Ctrl+C antes de copiar.
- Transfira a pasta completa atualizada, incluindo dist\data.json e source-data\ (onde ficam cargas de cimento, origens e backups).
- No outro PC, preserve a pasta anterior como backup e extraia a versão recebida em uma nova pasta. Abra a nova cópia.
- Não edite duas cópias em paralelo nem misture arquivos de pastas diferentes. Não há união automática de alterações conflitantes.
- Atualizar somente os arquivos de código não leva os dados. Git ignora intencionalmente as bases locais.

Para os dois PCs enxergarem os mesmos dados automaticamente, é necessário definir um servidor/banco compartilhado acessível a ambos. Esse serviço ainda não foi configurado. Uma pasta em nuvem sozinha não substitui o controle de concorrência de um servidor compartilhado.

## Gerar a próxima transferência

Feche o servidor e dê dois cliques em GERAR-TRANSFERENCIA.cmd. Um novo ZIP aparecerá na pasta transferencias, ao lado da pasta mrp-app. Ele contém o código e os dados daquele momento, com verificação dos arquivos. Leve esse ZIP para o outro PC. O pacote entregue inicialmente é uma fotografia da exportação, não recebe mudanças posteriores sozinho.
