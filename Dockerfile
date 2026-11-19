FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-venv postgresql-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY scripts/requirements.txt /tmp/requirements.txt
RUN python3 -m venv /opt/colafix-venv \
    && /opt/colafix-venv/bin/pip install --no-cache-dir -r /tmp/requirements.txt

ENV MRP_PYTHON=/opt/colafix-venv/bin/python
ENV PORT=8080

COPY . .

EXPOSE 8080

CMD ["node", "server.mjs"]
