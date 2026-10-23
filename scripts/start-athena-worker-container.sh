#!/bin/sh
set -eu

coverage="${COVERAGE:-}"

is_truthy() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    true|1|yes|on) return 0 ;;
    *) return 1 ;;
  esac
}

npm run build:be

if is_truthy "$coverage"; then
  export COVERAGE="true"
  export NODE_OPTIONS="--loader @istanbuljs/esm-loader-hook"
  exec ./node_modules/.bin/nyc --silent --cwd . --reporter=json --temp-dir ./testing/results/.nyc_worker node dist/worker.js
fi

unset COVERAGE
exec node --enable-source-maps dist/worker.js
