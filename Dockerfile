FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY scripts/requirements.txt ./scripts/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r scripts/requirements.txt

COPY . .

ENV NODE_ENV=production
ENV MRP_PYTHON=python3

CMD ["node","server.mjs"]
