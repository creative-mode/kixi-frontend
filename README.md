This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Docker

```bash
cp .env.example .env        # ajuste JWT_SECRET / KIXI_MOCK / BACKEND_API_URL
docker compose up --build   # http://localhost:3000
```

Cada app (landing, aluno, manager) corre no seu contentor e na sua porta interna (3004, 3003, 3002); só o **gateway** (`scripts/gateway.mjs`, porta 3000) é publicado. O browser vê uma origem única: `/` landing, `/aluno` app do aluno, `/manager` gestor. Para abrir cada app na sua porta (depuração): `docker compose -f docker-compose.yml -f docker-compose.debug.yml up`.

- `KIXI_MOCK=true` (por omissão) usa o backend simulado; com `false` é obrigatório `JWT_SECRET` (o mesmo do backend) e `BACKEND_API_URL`.
- Atrás de um proxy TLS (nginx, Caddy, Traefik) aponte-o para a porta 3000 e envie `X-Forwarded-Proto`/`X-Forwarded-Host`.
