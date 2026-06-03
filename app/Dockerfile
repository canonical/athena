WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY tsconfig.json tsconfig.server.json ./
COPY src ./src
COPY scripts ./scripts

RUN chmod +x ./scripts/start-athena-container.sh

EXPOSE 8080

CMD ["./scripts/start-athena-container.sh"]