#!/usr/bin/env bash
#
# Database migration hook run by paas_charm after PostgreSQL is integrated.
#
# paas_charm executes this from the application directory (/app) inside the
# workload container and provides the PostgreSQL connection details as
# environment variables (POSTGRESQL_DB_CONNECT_STRING, POSTGRESQL_DB_USERNAME, ...).
#
# The migrations are idempotent (see migrations/pg/migrate.sql), so re-running is safe.
set -euo pipefail

: "${POSTGRESQL_DB_CONNECT_STRING:?POSTGRESQL_DB_CONNECT_STRING is required to run migrations}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATE_SQL="${SCRIPT_DIR}/migrations/pg/migrate.sql"

# The migrations grant privileges to the application role. Default it to the
# database user paas_charm connected with, falling back to "athena".
APP_ROLE_NAME="${APP_ROLE_NAME:-${POSTGRESQL_DB_USERNAME:-athena}}"

echo "Running Athena migrations (role: ${APP_ROLE_NAME}) ..."
psql "${POSTGRESQL_DB_CONNECT_STRING}" \
  --set ON_ERROR_STOP=on \
  --set "APP_ROLE_NAME=${APP_ROLE_NAME}" \
  --file "${MIGRATE_SQL}"
echo "Athena migrations completed."
