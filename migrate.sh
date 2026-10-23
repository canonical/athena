#!/usr/bin/env bash

set -euo pipefail

case "${APP_RUN_MIGRATIONS_ON_STARTUP:-true}" in
  false|FALSE|0)
    echo ">>> Athena startup migrations disabled"
    exit 0
    ;;
esac

: "${POSTGRESQL_DB_CONNECT_STRING:?POSTGRESQL_DB_CONNECT_STRING is required}"

app_role="$(psql "${POSTGRESQL_DB_CONNECT_STRING}" \
  -tAX \
  -v ON_ERROR_STOP=1 \
  -c 'SELECT current_user')"
: "${app_role:?Unable to determine the connected PostgreSQL role}"

echo ">>> Running Athena migrations as role: ${app_role}"
psql "${POSTGRESQL_DB_CONNECT_STRING}" \
  -v ON_ERROR_STOP=1 \
  -v APP_ROLE_NAME="${app_role}" \
  -f /app/migrations/pg/migrate.sql

background_job_schema="${APP_ATHENA_BACKGROUND_JOB_SCHEMA:-${APP_BACKGROUND_JOB_SCHEMA:-pgboss}}"
case "${background_job_schema}" in
  ""|[!a-z]*|*[!a-z0-9_]*)
    echo "BACKGROUND_JOB_SCHEMA must be a lowercase PostgreSQL identifier" >&2
    exit 1
    ;;
  *) ;;
esac

echo ">>> Running pg-boss migrations in schema: ${background_job_schema}"
PGBOSS_DATABASE_URL="${POSTGRESQL_DB_CONNECT_STRING}" \
  /app/node_modules/.bin/pg-boss migrate --schema "${background_job_schema}"
