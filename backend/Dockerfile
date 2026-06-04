FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN sed -i 's/\r$//' deploy/docker-entrypoint-api.sh && chmod +x deploy/docker-entrypoint-api.sh

ENV NODE_ENV=production
EXPOSE 4180

ENTRYPOINT ["sh", "./deploy/docker-entrypoint-api.sh"]
