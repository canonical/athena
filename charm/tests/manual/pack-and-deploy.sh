#!/usr/bin/env bash
#
# Build and deploy Athena locally on MicroK8s.
#
# Mirrors the CI Release action: stage the app into app/, pack the rock, push it
# to the local MicroK8s registry, pack the charm, and deploy/refresh with Juju.
#
# Prerequisites: microk8s (registry + hostpath-storage + ingress), a bootstrapped
# juju controller, lxd, rockcraft, charmcraft.
set -euo pipefail

# This script lives in charm/tests/manual/, so the repo root is three levels up.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
cd "$REPO_ROOT"

# Derived variables.
APP_VERSION="$(jq -r .version package.json)"
APP_MODEL_NAME="athena"
APP_NAME="athena"
ROCK_NAME="$(grep '^name:' rockcraft.yaml | head -1 | cut -d':' -f2 | xargs)"
CHARM_NAME="$(grep '^name:' charm/charmcraft.yaml | head -1 | cut -d':' -f2 | xargs)"

export ROCKCRAFT_ENABLE_EXPERIMENTAL_EXTENSIONS=true
export CHARMCRAFT_ENABLE_EXPERIMENTAL_EXTENSIONS=true
# Baked into the Vite frontend bundle at build time.
export VITE_API_BASE_URL="${VITE_API_BASE_URL:-/api}"

REGISTRY="localhost:32000"
# Use a unique image tag per local build so Kubernetes always pulls the freshly built img
IMAGE_TAG="${IMAGE_TAG:-${APP_VERSION}-local-$(date +%Y%m%d%H%M%S)}"
IMAGE="${REGISTRY}/${ROCK_NAME}:${IMAGE_TAG}"

echo "== Staging app ============================================"
./scripts/stage-app.sh

echo "== Packing rock ==========================================="
rockcraft pack

echo "== Pushing rock to ${REGISTRY} ============================"
ROCK_FILE="$(ls -t "${ROCK_NAME}"_*.rock | head -1)"
rockcraft.skopeo --insecure-policy copy --dest-tls-verify=false \
  "oci-archive:${ROCK_FILE}" \
  "docker://${IMAGE}"

echo "== Packing charm =========================================="
(
  cd charm
  charmcraft fetch-libs
  charmcraft pack
)

echo "== Deploying / refreshing ================================="
if ! juju models --format=json | jq -e ".models[] | select(.\"short-name\" == \"${APP_MODEL_NAME}\")" >/dev/null 2>&1; then
  juju add-model "${APP_MODEL_NAME}"
fi
juju switch "${APP_MODEL_NAME}"

CHARM_FILE="./$(ls -t charm/"${CHARM_NAME}"_*.charm | head -1)"
if juju status --format=json | jq -e ".applications.\"${APP_NAME}\"" >/dev/null 2>&1; then
  juju refresh "${APP_NAME}" \
    --path "${CHARM_FILE}" \
    --resource "app-image=${IMAGE}"
else
  juju deploy "${CHARM_FILE}" "${APP_NAME}" \
    --resource "app-image=${IMAGE}"
fi

echo "Done. Watch with: juju status --watch 2s"
