#!/bin/sh
set -eu

npm run build:be

case "${COVERAGE:-}" in
	true|TRUE|1|yes|YES|on|ON)
		exec env NODE_OPTIONS='--loader @istanbuljs/esm-loader-hook' ./node_modules/.bin/nyc --silent --cwd . --reporter=json --temp-dir "testing/results/.nyc_worker/${HOSTNAME:-worker}" node dist/worker.js
		;;
esac

exec npm run start:worker
