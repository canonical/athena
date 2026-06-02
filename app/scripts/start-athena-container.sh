#!/bin/sh
set -eu

is_truthy() {
  value="${1:-}"
  value=$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')
  [ "$value" = "true" ] || [ "$value" = "1" ] || [ "$value" = "yes" ] || [ "$value" = "on" ]
}

mkdir -p "${HOME:-/home/node}/.ollama"

ollama serve &
ollama_pid=$!

cleanup() {
  kill "$ollama_pid" 2>/dev/null || true
}

trap cleanup EXIT INT TERM

for _ in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:11434/api/version >/dev/null; then
    break
  fi

  sleep 1
done

if is_truthy "${APP_ATHENA_DEV_MODE:-false}"; then
  exec npm run watch --workspace @portal/athena
fi

npm run build --workspace @portal/athena
exec npm run start --workspace @portal/athena