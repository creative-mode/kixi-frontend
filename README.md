# Kixi — frontend (admin)

App de **gestão do Kixi** (admin e professor), em Next.js. Vive na raiz do repo
juntamente com as apps do aluno (`student/`) e a landing (`landing/`); em dev,
o `scripts/gateway.mjs` serve as três numa só origem.

| App | Código | Dev | No gateway `:3000` |
| --- | --- | --- | --- |
| Admin / professor | `./` (`app/`) | `:3002` | `/manager` |
| Aluno | `student/` | `:3003` | `/aluno` |
| Landing | `landing/` | `:3004` | `/` |

## Arrancar em 5 minutos

```bash
npm install                  # raiz (admin)
npm --prefix student install # app do aluno
npm --prefix landing install # landing
npm run dev:all              # tudo em http://localhost:3000
```

Só o admin, na própria porta:

```bash
npm run dev                  # http://localhost:3002/manager
```

## Variáveis de ambiente

| Var | Obrigatória? | Notas |
| --- | --- | --- |
| `KIXI_MOCK` | não | `true` (omissão) = backend simulado local |
| `BACKEND_API_URL` | sim, em prod | ex.: `http://localhost:8080/api/v1` |
| `JWT_SECRET` | sim, quando `KIXI_MOCK=false` | tem de ser igual à do backend |

## Scripts

```bash
npm run dev     # dev (porta 3002, basePath /manager)
npm run build   # build de produção
npm run lint    # eslint
npm run ds:sync # sincroniza o design system para student/ e landing/
```

## Docker

```bash
cp .env.example .env        # ajuste JWT_SECRET / KIXI_MOCK / BACKEND_API_URL
docker compose up --build   # http://localhost:3000
```

Só o **gateway** (porta 3000) é publicado; cada app corre no seu contentor
(`manager` :3002, `student` :3003, `landing` :3004). Para depuração com as
portas expostas: `docker compose -f docker-compose.yml -f docker-compose.debug.yml up`.

## Auth

A sessão é um cookie `auth_token` (JWT) validado em `proxy.ts`: sem sessão
válida tudo redireciona para `/manager/login`; só `ADMIN` entra no painel,
`TEACHER` fica restrito ao exam builder. Atrás de um proxy TLS, envie
`X-Forwarded-Proto`/`X-Forwarded-Host`.
