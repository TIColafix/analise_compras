#!/usr/bin/env bash
# Execute dentro da rede privada do Railway, com DATABASE_URL de ORIGEM.
# Exporta apenas DDL (sem linhas de dados).
set -Eeuo pipefail
umask 077
: "${DATABASE_URL:?Configure DATABASE_URL da origem (Railway)}"
command -v pg_dump >/dev/null || { echo 'pg_dump indisponivel no ambiente' >&2; exit 1; }
DEST="${1:-colafix_estrutura_vazia.sql}"
pg_dump --dbname="$DATABASE_URL" --schema-only --no-owner --no-acl --format=plain --encoding=UTF8 --file="$DEST"
test -s "$DEST"
chmod 600 "$DEST"
echo "Estrutura exportada para $DEST (nenhum registro copiado)."
