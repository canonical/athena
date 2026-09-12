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

echo ">>> Running background job schema migrations"
exec npm run migrate:background-jobs
