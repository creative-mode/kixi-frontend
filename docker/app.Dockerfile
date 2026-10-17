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
# Só a landing os usa: endereço público (canonical, Open Graph, sitemap) e contacto.
# A morada e o telefone entram no `Organization` do JSON-LD (#218); sem eles o schema
# vai sem `PostalAddress` e sem `telephone`, que é como fica hoje em produção.
ARG NEXT_PUBLIC_SITE_URL=
ARG NEXT_PUBLIC_CONTACT_EMAIL=
ARG NEXT_PUBLIC_CONTACT_PHONE=
ARG NEXT_PUBLIC_CONTACT_STREET=
ARG NEXT_PUBLIC_CONTACT_LOCALITY=
ARG NEXT_PUBLIC_CONTACT_POSTAL_CODE=
ARG NEXT_PUBLIC_CONTACT_COUNTRY=
ARG NEXT_PUBLIC_GA_ID=
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL} NEXT_PUBLIC_MANAGER_URL=${NEXT_PUBLIC_MANAGER_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} NEXT_PUBLIC_CONTACT_EMAIL=${NEXT_PUBLIC_CONTACT_EMAIL} \
    NEXT_PUBLIC_CONTACT_PHONE=${NEXT_PUBLIC_CONTACT_PHONE} NEXT_PUBLIC_CONTACT_STREET=${NEXT_PUBLIC_CONTACT_STREET} \
    NEXT_PUBLIC_CONTACT_LOCALITY=${NEXT_PUBLIC_CONTACT_LOCALITY} NEXT_PUBLIC_CONTACT_POSTAL_CODE=${NEXT_PUBLIC_CONTACT_POSTAL_CODE} \
    NEXT_PUBLIC_CONTACT_COUNTRY=${NEXT_PUBLIC_CONTACT_COUNTRY} NEXT_PUBLIC_GA_ID=${NEXT_PUBLIC_GA_ID}
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
