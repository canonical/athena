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
	exec npm run coverage:start:worker
fi

unset COVERAGE
exec npm run start:worker