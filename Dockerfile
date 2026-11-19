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

ENV NODE_ENV=production \
    PORT=8080 \
    HOST=0.0.0.0 \
    MRP_PYTHON=/opt/colafix-venv/bin/python

EXPOSE 8080

CMD ["node", "server.mjs"]
