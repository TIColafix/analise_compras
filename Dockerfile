FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv postgresql-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY scripts/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/colafix-venv \
    && /opt/colafix-venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

COPY . .

# O EasyPanel fornece GIT_SHA na compilação; a data indica a geração da imagem.
ARG GIT_SHA
RUN GIT_SHA="$GIT_SHA" node scripts/write-build-info.mjs

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    MRP_PYTHON=/opt/colafix-venv/bin/python

EXPOSE 8080

CMD ["node", "server.mjs"]
