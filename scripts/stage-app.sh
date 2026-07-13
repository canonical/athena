#!/usr/bin/env bash
#
# Stage the flat Athena repository into the `app/` layout that the Rockcraft
# `expressjs-framework` extension expects.
#
# The committed repository keeps the Node application at the root. This script
# assembles an ephemeral `app/` directory (git-ignored) that is only used at
# build time — on CI runners and before a local `rockcraft pack`. It never
# changes the tracked working tree.
#
# Usage: ./scripts/stage-app.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

APP_DIR="app"

# The files and directories that make up the Node application. Their internal
# paths are relative, so they keep working once relocated together as a block.
ITEMS=(
  src
  testing
  package.json
  package-lock.json
  .npmrc
  tsconfig.json
  tsconfig.server.json
  vite.config.ts
  nodemon.json
  playwright.config.ts
  biome.json
)

echo "Staging Athena application into ./${APP_DIR} ..."


rm -rf "${APP_DIR}"
mkdir -p "${APP_DIR}"

for item in "${ITEMS[@]}"; do
  if [ -e "${item}" ]; then
    cp -a --no-preserve=ownership "${item}" "${APP_DIR}/"
  else
    echo "  warning: '${item}' not found, skipping" >&2
  fi
done


cp -a --no-preserve=ownership migrations "${APP_DIR}/migrations"

echo "Done. Staged $(du -sh "${APP_DIR}" | cut -f1) into ./${APP_DIR}"
