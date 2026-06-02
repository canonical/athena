# Build stage: Install dependencies
# ===

FROM portal_base
WORKDIR /app

RUN apt-get update \
	&& apt-get install -y --no-install-recommends curl ca-certificates zstd \
	&& rm -rf /var/lib/apt/lists/* \
	&& curl -fsSL https://ollama.com/install.sh | sh

COPY agent/ agent/

RUN npm run build --workspace @portal/athena

RUN chmod +x /app/agent/scripts/start-athena-container.sh