FROM node:22-alpine
WORKDIR /app
COPY scripts/gateway.mjs ./gateway.mjs
ENV PORT=3000
USER node
EXPOSE 3000
CMD ["node", "gateway.mjs"]
