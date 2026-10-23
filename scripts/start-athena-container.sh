#!/bin/sh
set -eu

dev_mode="${APP_ATHENA_DEV_MODE:-false}"
coverage="${COVERAGE:-}"

is_truthy() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    true|1|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

if is_truthy "$coverage"; then
  export COVERAGE="true"
  npm run build
  export NODE_OPTIONS="--loader @istanbuljs/esm-loader-hook"
  exec ./node_modules/.bin/nyc --silent --cwd . --reporter=json --temp-dir .nyc_output node dist/server.js
fi

unset COVERAGE

if is_truthy "$dev_mode"; then
  exec npm run watch
fi

npm run build
exec node --enable-source-maps dist/server.js
