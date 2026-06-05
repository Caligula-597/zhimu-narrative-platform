# Works with either build context:
# - railway up backend --path-as-root   (context = backend/)
# - docker compose / dockerfilePath=backend/Dockerfile from repo root
FROM node:22-alpine

WORKDIR /app

COPY . /ctx

RUN set -eux; \
  if [ -f /ctx/backend/package.json ]; then \
    cp /ctx/backend/package.json /ctx/backend/package-lock.json /app/; \
  else \
    cp /ctx/package.json /ctx/package-lock.json /app/; \
  fi

RUN npm ci --omit=dev --ignore-scripts

RUN set -eux; \
  if [ -f /ctx/backend/package.json ]; then \
    cp -a /ctx/backend/. /app/; \
  else \
    cp -a /ctx/. /app/; \
  fi; \
  rm -rf /ctx; \
  test -f /app/deploy/docker-entrypoint-api.sh; \
  sed -i 's/\r$//' /app/deploy/docker-entrypoint-api.sh; \
  chmod +x /app/deploy/docker-entrypoint-api.sh

ENV NODE_ENV=production
EXPOSE 4180

ENTRYPOINT ["sh", "./deploy/docker-entrypoint-api.sh"]
