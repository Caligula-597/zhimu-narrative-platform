# Frontend static site + Node server (dist/). Build context = repo root.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY config ./config
COPY src ./src
COPY docs ./docs
COPY frontend ./frontend
COPY index.html app.js config.js dom.js state.js styles.css rule-visual.js server.js ./

RUN npm ci

ARG VITE_API_BASE=https://api.getzhimu.com/api
ARG VITE_REQUIRE_AUTH=true
ARG VITE_DEMO_MODE=false
ENV VITE_API_BASE=$VITE_API_BASE VITE_REQUIRE_AUTH=$VITE_REQUIRE_AUTH VITE_DEMO_MODE=$VITE_DEMO_MODE

RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./

EXPOSE 4173
CMD ["node", "server.js", "--dist"]
