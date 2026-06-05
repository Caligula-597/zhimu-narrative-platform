# Railway API — build context is repo root (not backend/).
# docker-compose.staging still uses backend/Dockerfile with context backend/.
FROM node:22-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY backend/ .

RUN sed -i 's/\r$//' deploy/docker-entrypoint-api.sh && chmod +x deploy/docker-entrypoint-api.sh

ENV NODE_ENV=production
EXPOSE 4180

ENTRYPOINT ["sh", "./deploy/docker-entrypoint-api.sh"]
