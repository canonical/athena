#!/bin/sh
set -eu

mode="${APP_ATHENA_RUN_MODE:-production}"
coverage="${COVERAGE:-}"

case "$mode" in
  dev|development)
    exec npm run watch
    ;;
  test|testing)
    exec npm run test
    ;;
  prod|production)
    npm run build:be
    if [ -n "$coverage" ]; then
      exec npm run coverage:start
    fi
    exec npm run start
    ;;
  *)
    echo "Unsupported APP_ATHENA_RUN_MODE: $mode" >&2
    echo "Expected one of: dev, test, production" >&2
    exit 1
    ;;
esac