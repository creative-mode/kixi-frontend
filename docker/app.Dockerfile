# Imagem de um app Next (manager, aluno ou landing). Contexto de build: a raiz do repositório.
#   docker build -f docker/app.Dockerfile --build-arg APP_DIR=student --build-arg PORT=3003 .
ARG NODE=node:22-alpine

FROM ${NODE} AS deps
ARG APP_DIR=.
WORKDIR /app
COPY ${APP_DIR}/package.json ${APP_DIR}/package-lock.json ./
RUN npm ci

FROM ${NODE} AS build
ARG APP_DIR=.
ARG NEXT_PUBLIC_APP_URL=
ARG NEXT_PUBLIC_MANAGER_URL=
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} NEXT_PUBLIC_MANAGER_URL=${NEXT_PUBLIC_MANAGER_URL}
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY ${APP_DIR}/ ./
RUN npm run build

FROM ${NODE} AS run
ARG PORT=3000
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=${PORT} HOSTNAME=0.0.0.0
WORKDIR /app
RUN addgroup -S kixi && adduser -S kixi -G kixi
COPY --from=build --chown=kixi:kixi /app/.next/standalone ./
COPY --from=build --chown=kixi:kixi /app/.next/static ./.next/static
COPY --from=build --chown=kixi:kixi /app/public ./public
USER kixi
EXPOSE ${PORT}
CMD ["node", "server.js"]
