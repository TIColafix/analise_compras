# Análise da base MRP e proposta de migração relacional

Data da análise: 23/11/2026. Referência de código: branch `web-migration`, commit `d2155d5`. A revisão implantada no EasyPanel ainda precisa ser confirmada. A inspeção usou a cópia local de `dist/data.json` e consultas de leitura no PostgreSQL; na comparação, o conteúdo era igual ao documento `main-data`, versão 13. Os números abaixo são um retrato, não metas ou garantias para lotes futuros.

## Situação atual

O PostgreSQL já persiste a base como um único documento JSONB em `app_documents`, chave `main-data`. A tela consome `GET /data.json`, e `dist/engine.js` calcula os indicadores no navegador. Em modo local, sem `DATABASE_URL`, o servidor lê e altera `dist/data.json`; com banco, a API de parâmetros grava o documento inteiro no PostgreSQL. A prévia de importação web copia o documento para `dist/data.json`; o importador Python altera esse arquivo e o servidor grava o resultado inteiro no banco. Assim, a hospedagem já usa banco, mas não possui as informações da base principal organizadas em tabelas relacionais nem eliminou o arquivo intermediário.

Os outros módulos possuem documentos independentes em `app_documents`; por exemplo, cimento, diesel, prazos e manutenção não fazem parte do `data.json`. Existem também tabelas relacionais homônimas no banco, que estavam vazias na inspeção. Não inferir que estejam prontas para uso ou migrar dados para elas sem investigar a revisão implantada e seus fluxos.

## Inventário da base inspecionada

| Estrutura | Linhas | Conteúdo e uso |
| --- | ---: | --- |
| `meta` | 1 objeto | Arquivos e hashes, contagens de importação, instante de criação, lotes ERP e data preferencial; 15 lotes registrados. |
| `catalog` | 997 | Código, descrição, unidade e fornecedor preferencial; referência geral de materiais. |
| `daily` | 198 | Linhas diárias de necessidade/MRP, saldos e mensagens, com origem e posição na fonte. |
| `weekly` | 4.451 | Posições de estoque por data/material, saldo total, saldo de compra, almoxarifados, reconciliação e origem. |
| `requests` | 198 | Necessidades por empresa, pedido, material, quantidade, unidade, compra e entrega. |
| `movements` | 13.011 | Linhas do perfil de planejamento: tipo, referência, datas, quantidades, projeção e posição de origem. Não confundir com movimentos realizados. |
| `paramSnapshots` | 1.355 | Parâmetros importados por material/data: consumo, segurança, lote mínimo/múltiplo, reposição e buffer, entre outros. |
| `reportProfiles` | 1.355 | Materiais presentes no perfil, com saldo associado e marcação de saldo não confirmado. |
| `issues` | 80 | Avisos de qualidade, campo, origem e motivo; podem conter informações da fonte. |
| `params`, `monthly`, `history`, `parameterEdits` | 0 cada | Respectivamente parâmetros legados, consumo mensal, histórico de movimentos realizados e ajustes manuais. Estão vazios nesta cópia, mas são suportados pelo código e precisam ser preservados se existirem em outras bases. |

Os registros datados observados vão de 24/09/2026 a 17/11/2026. `daily` e `requests` têm oito pares material/data com mais de uma linha; `movements` tem 1.150 pares material/data com mais de uma linha. Portanto, impor unicidade apenas em material/data nessas estruturas causaria perda ou rejeição indevida. A ausência de ajustes manuais nesta cópia não elimina a necessidade de migrar e testar essa funcionalidade.

## Regras e dependências a preservar

- Uma importação ERP usa CSV de necessidades e PDFs de perfil e saldos. O lote registra data, assinatura dos arquivos, hashes, contagens e origem. Lote idêntico é idempotente; outro lote para a mesma data deve ser bloqueado, sem substituir histórico silenciosamente.
- O parser mantém linhas de origem, páginas e descrições que podem ocupar várias linhas. Saldos por almoxarifado devem continuar disponíveis para reconciliação; o planejamento de compras usa somente o Almoxarifado 1. Não confundir saldo total com saldo disponível.
- Snapshots de datas diferentes não podem ser combinados como se fossem um único relatório. Pedidos e necessidades têm suas próprias datas de compra e entrega, distintas da data do snapshot.
- Ajustes manuais valem por campo: uma importação posterior prevalece somente quando tem valor não nulo e sua data não constava em `knownDates` no momento da edição. Zero é informado; ausência e nulo não equivalem a zero. Preservar `savedAt`, vigência, campos presentes e conjunto de datas conhecidas, inclusive quando não houver edições nesta amostra.
- Não agregar unidades diferentes. Preservar conflitos, avisos, valores nulos, ordenação de linhas do perfil e proveniência em vez de descartar informações inválidas ou presumir que uma linha representa o item inteiro.
- O cálculo de compras também consulta pedidos pendentes do módulo Prazos de entrega; migrar apenas `main-data` não migra esse módulo. Movimentos do perfil de planejamento e histórico de movimentos realizados são conjuntos distintos.

## Modelo relacional proposto

Usar tabelas específicas para materiais, lotes/arquivos importados, necessidades, saldos de snapshot, saldos por almoxarifado, linhas do perfil, parâmetros por snapshot, itens do perfil, edições manuais por evento/campo, datas conhecidas por edição, consumo mensal, movimentos históricos, avisos e metadados legados. Associar cada linha importada ao lote e à sua posição original, com identificadores internos próprios. Preservar valores e campos de origem sem perda, inclusive campos adicionais de versões antigas; JSONB de detalhes pode ser usado para dados variáveis, enquanto chaves, datas, unidades e valores consultados ficam em colunas tipadas.

Identificadores internos não devem pressupor unicidade de material/data para necessidades ou movimentos. As restrições naturais devem ser introduzidas somente após testar os dados históricos e as regras reais; lotes devem ter controle transacional para impedir duas importações diferentes da mesma data. Valores numéricos requerem escolha explícita de precisão e testes comparativos com os cálculos JavaScript atuais. Campos ausentes, nulos, zero e ordem dos arrays devem continuar distinguíveis onde influenciam o comportamento.

Para manter compatibilidade na transição, uma camada de leitura pode reconstruir a resposta hoje fornecida por `/data.json` a partir de uma visão consistente do banco. O formato HTTP em JSON não implica persistir dados em arquivos: é apenas transporte. Em seguida, substituir gradualmente a leitura integral por endpoints filtrados por data/material. O banco deve ser a fonte única de verdade no modo configurado para banco; uma cópia local em arquivo não deve entrar automaticamente no fluxo de produção.

## Riscos atuais

1. A prévia web grava `dist/data.json`, e o commit Python o usa depois. Entre prévia e confirmação, outra alteração pode tornar essa cópia antiga; o salvamento integral sem verificação de versão pode sobrescrever ajustes ou outro lote. `busy` é apenas uma variável em memória do processo, não um bloqueio compartilhado entre instâncias nem uma proteção entre as duas requisições.
2. A gravação de `main-data` usa `ON CONFLICT` e incrementa versão, mas não exige que a versão lida ainda seja a atual. Operações concorrentes de leitura e gravação do documento inteiro podem perder alterações.
3. O fluxo Python escreve relatórios e backups no filesystem. Na hospedagem, arquivos locais podem não ser duráveis; arquivos recebidos e metadados precisam de estratégia de armazenamento e retenção separada do conteúdo relacional. Não presumir que a transferência do documento incluiu os PDFs/CSVs originais.
4. A auditoria atual é escrita separadamente da alteração e sua falha é capturada pelo servidor; a mudança pode ocorrer sem evento de auditoria. A operação e sua auditoria devem compartilhar transação quando aplicável.
5. O código local e a revisão de produção podem divergir após a migração relatada. Antes do corte, identificar a imagem/commit e confirmar o banco e ambiente de destino. A ausência de login local é intencional no código analisado; o comportamento de autenticação da hospedagem exige verificação própria.

## Etapas e critérios de aceitação

1. Confirmar a versão em produção e obter backup recuperável, incluindo documentos, auditoria, catálogos e arquivos originais necessários. Trabalhar primeiro em banco de teste isolado, com dados sintéticos e, quando autorizado, cópia protegida para reconciliação.
2. Criar migrações versionadas e reversíveis que acrescentem tabelas sem remover `main-data`. Importar uma versão congelada com hashes e contagens, em transação; preservar o original e falhar sem alterar destino se a versão de origem mudar. Não reexecutar em cima de dados existentes sem política explícita.
3. Comparar por lote, data, material e linha: contagem, valores, unidades, nulos, ordem, origem e hashes; reconstruir o documento e comparar semanticamente. Validar resultados de Dashboard, MRP, estoque, perfis, pedidos, avisos e histórico em várias datas, incluindo casos duplicados e conflitos.
4. Adaptar parâmetros e importação para gravações transacionais no banco, com controle de versão ou bloqueios apropriados, importação idempotente, integridade referencial e auditoria na mesma transação. O parser deve operar sobre dados recebidos ou área temporária isolada, sem depender de `dist/data.json`; arquivos originais precisam de destino durável definido.
5. Testar concorrência entre importação e ajustes, dois lotes na mesma data, duplicidade idêntica, falhas e rollback, zero/nulo, prioridade por campo, descrição multilinha, Almoxarifado 1, unidades diferentes e manutenção do histórico. Usar testes sem tocar dados reais.
6. Homologar com usuários e definir janela de corte, reconciliação final, ponto de retorno e restauração. Só após validação e autorização executar migração/corte na produção. Manter o documento original e backups conforme a política aprovada; não apagar dados nem habilitar escrita dupla indefinidamente.

Nenhuma tabela foi criada nem dado de produção foi modificado nesta análise. As quantidades mostram estrutura e volume observados, mas não comprovam que a cópia esteja completa em relação à origem anterior.
