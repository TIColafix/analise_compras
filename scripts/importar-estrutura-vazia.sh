#!/usr/bin/env bash
# Execute numa maquina com psql e acesso ao novo PostgreSQL.
# NUNCA use DATABASE_URL da origem como DEST_DATABASE_URL.
set -Eeuo pipefail
: "${DEST_DATABASE_URL:?Configure DEST_DATABASE_URL do novo banco}"
SQL="${1:-colafix_estrutura_vazia.sql}"
test -s "$SQL" || { echo 'Arquivo SQL da estrutura ausente/vazio' >&2; exit 1; }
command -v psql >/dev/null || { echo 'psql nao instalado' >&2; exit 1; }
if [[ "${DATABASE_URL:-}" == "$DEST_DATABASE_URL" ]]; then echo 'Origem e destino iguais: abortado' >&2; exit 1; fi
COUNT="$(psql "$DEST_DATABASE_URL" -X -qAt -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind IN ('r','p','v','m','S','f') AND n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%';")"
[[ "$COUNT" == "0" ]] || { echo "Destino nao esta vazio ($COUNT objetos encontrados). Abortado." >&2; exit 1; }
psql "$DEST_DATABASE_URL" -X -v ON_ERROR_STOP=1 --single-transaction -f "$SQL"
echo 'Estrutura criada no destino, sem copiar dados.'
