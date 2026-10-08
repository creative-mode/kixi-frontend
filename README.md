# Kixi — frontend

Três apps Next.js no mesmo repo (gestão, aluno e landing), servidas por um gateway único.

| App | Pasta | Porta (dev) | No gateway `:3000` |
| --- | --- | --- | --- |
| Gestor (admin/professor) | `./` (raiz, `app/`) | 3002 | `/manager` |
| Aluno | `student/` | 3003 | `/aluno` |
| Landing | `landing/` | 3004 | `/` |

## Arranque rápido (5 min)

```bash
npm install
npm --prefix student install
npm --prefix landing install
npm run dev:all   # landing + aluno + gestor + gateway em http://localhost:3000
```

Ou cada app na sua porta:

```bash
npm run dev            # gestor :3002
npm --prefix student run dev   # aluno :3003
npm --prefix landing run dev   # landing :3004
```

## Variáveis de ambiente

| Var | Onde | Obrigatória? |
| --- | --- | --- |
| `BACKEND_API_URL` | raiz, student | sim em prod (ex.: `http://localhost:8080/api/v1`) |
| `JWT_SECRET` | raiz, student | sim quando `KIXI_MOCK=false` (igual à do backend) |
| `KIXI_MOCK` | raiz | não (`true` = backend simulado local) |
| `APP_ORIGIN` | raiz, student | sim em prod (ex.: `https://kixi.ao`) — endereço público do gateway |
| `NEXT_PUBLIC_MANAGER_URL` | student | não (fallback: `${APP_ORIGIN}/manager`) |
| `NEXT_PUBLIC_APP_URL` | landing | não |
| `PORT`, `*_HOST`, `*_PORT` | gateway | não (defeitos: 3000/3002/3003/3004) |

`APP_ORIGIN` é o que o gestor e o aluno usam para montar redireccionamentos para fora da
sua app — a landing e a `/403` canónica. Não se pode confiar em `Host` nem em
`x-forwarded-host` para isso: ambos vêm de quem fez o pedido, e um redireccionamento
construído a partir deles deixa o utilizador seguir para um domínio à escolha do atacante.
Atrás do gateway define `APP_ORIGIN` com o endereço público; sem isso, em produção, os
redireccionamentos saem construídos a partir do pedido e a app avisa no log.

## Scripts úteis

```bash
npm run build && npm run lint   # raiz (gestor)
npm run ds:sync                 # sincroniza o design system para student/ e landing/
docker compose up --build           # tudo em contentores, http://localhost:3000
```

## Docker

```bash
cp .env.example .env        # ajuste JWT_SECRET / KIXI_MOCK / BACKEND_API_URL
docker compose up --build   # http://localhost:3000
```

Cada app (landing, aluno, manager) corre no seu contentor e na sua porta interna (3004, 3003, 3002); só o **gateway** (`scripts/gateway.mjs`, porta 3000) é publicado. O browser vê uma origem única: `/` landing, `/aluno` app do aluno, `/manager` gestor. Para abrir cada app na sua porta (depuração): `docker compose -f docker-compose.yml -f docker-compose.debug.yml up`.

- `KIXI_MOCK=true` (por omissão) usa o backend simulado; com `false` é obrigatório `JWT_SECRET` (o mesmo do backend) e `BACKEND_API_URL`.
- Atrás de um proxy TLS (nginx, Caddy, Traefik) aponte-o para a porta 3000 e envie `X-Forwarded-Proto`/`X-Forwarded-Host`.
