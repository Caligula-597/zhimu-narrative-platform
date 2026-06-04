FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN chmod +x deploy/docker-entrypoint-api.sh

ENV NODE_ENV=production
EXPOSE 4180

ENTRYPOINT ["./deploy/docker-entrypoint-api.sh"]
