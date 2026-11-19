#!/usr/bin/env bash
# Executar apenas dentro da rede privada do Railway, com DATABASE_URL configurada.
set -Eeuo pipefail
umask 077
: "${DATABASE_URL:?DATABASE_URL ausente}"
command -v pg_dump >/dev/null || { echo "pg_dump nao instalado" >&2; exit 1; }
OUT_DIR="${BACKUP_DIR:-/tmp}"
mkdir -p "$OUT_DIR"
TMP="$(mktemp "$OUT_DIR/.colafix.XXXXXXXX.sql")"
trap 'rm -f "$TMP"' EXIT
pg_dump --dbname="$DATABASE_URL" --format=plain --no-owner --no-acl --encoding=UTF8 --file="$TMP"
test -s "$TMP"
OUT="$OUT_DIR/colafix_backup_completo.sql"
mv -f "$TMP" "$OUT"
trap - EXIT
chmod 600 "$OUT"
printf 'Backup criado: %s\n' "$OUT"
sha256sum "$OUT"
