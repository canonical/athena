FROM ubuntu:26.04

RUN apt-get update \
	&& DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends nodejs npm ca-certificates curl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY playwright.config.ts ./
COPY vite.config.ts ./
COPY tsconfig.json tsconfig.server.json ./
COPY src ./src
COPY scripts ./scripts
COPY testing ./testing

RUN chmod +x ./scripts/start-athena-container.sh

EXPOSE 8080

CMD ["./scripts/start-athena-container.sh"]