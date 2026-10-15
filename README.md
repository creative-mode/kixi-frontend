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
Atrás do gateway define `APP_ORIGIN` com o endereço público.

**`APP_ORIGIN` é obrigatório em produção.** Sem ele, `resolveOrigin` recusa, e o erro diz o
nome da variável: uma configuração em falta aparece no deploy, e não como um login que não
funciona. Fora de produção o pedido é acreditado, para o `npm run dev` funcionar sem `.env`.

A origem tem de trazer a porta quando a traz. Atrás do gateway o Next vê o host interno, com
a porta interna da app; se a origem não a trouxer, o redirect saía em
`https://kixi.ao:3002/...` e nenhuma visita sem sessão chegava ao gestor.

## Contra o backend real (sem mocks)

```bash
# no repositório do backend: sobe Postgres + API em :8081 (ver o README de lá)
export JWT_SECRET=<o mesmo APP_JWT_SECRET do backend>
export KIXI_MOCK=false BACKEND_API_URL=http://localhost:8081/api/v1 APP_ORIGIN=http://localhost:3000
npm run dev:all             # http://localhost:3000
```

- O login do gestor usa só `BACKEND_API_URL`; não há uma variável própria para o endereço de autenticação.
- Os dados vêm todos do backend: um professor só vê as turmas e disciplinas que lhe foram atribuídas, e
  precisa de estar afiliado à instituição. Um aluno só entra no ranking com simulações do ano letivo da sua turma.
- O tutor responde com `GROQ_API_KEY` no backend; sem ela o backend responde 503 e o ecrã diz que não consegue falar com o tutor.
- Em WSL com o repositório em `/mnt/c`, o `next dev` não vê as edições: reinicie o servidor depois de alterar ficheiros.

## Provas: enunciado, construtor e sala

A prova nasce no **construtor** (`/manager/exam-builder`) e é dada numa **sala**. O fluxo de um professor:

1. **Montar ou importar.** À mão, ou «Importar de imagem»: o OCR (`POST /api/v1/ocr/extract/exam`, sem guardar nada) lê a prova e o construtor fica preenchido: cabeçalho (título, duração, série, ano letivo), a disciplina (encontrada pelo nome ou pela sigla entre as da escola) e o tipo de cada questão. A conversão é `lib/exam/extraction.ts`, pura e testada.
2. **Rever.** Cada questão é dissertativa, de escolha múltipla, verdadeiro/falso ou **com alíneas** (a, b, c…, cada uma com o seu tipo, cotação e resposta). O OCR não adivinha o gabarito: as respostas de escolha múltipla e de verdadeiro/falso marcam-se aqui. Sem cotação no papel, «Distribuir 20 valores» reparte por igual sem tocar nas já preenchidas.
3. **Publicar** e **criar a sala** com essa prova (`/exam-rooms/new?statementId=…` abre com a turma e a prova escolhidas). Os alunos entram na sala e fazem a simulação.

Uma questão com alíneas é, no backend, uma questão `group` (só o enunciado comum) com uma questão por alínea (`parentId` e `label`). O número interno de uma alínea é `pai * 100 + índice` (301, 302…), só para ser único: **nunca se mostra**, mostra-se `3a`. A ordem das questões é a do servidor (cada alínea a seguir ao pai); o front não reordena por `number`. `lib/exam/display.ts` (manager) e `student/lib/question-number.ts` (aluno) tratam disso.

## Scripts úteis

```bash
npm run build && npm run lint   # raiz (gestor)
npm run ds:sync                 # sincroniza o design system para student/ e landing/
docker compose up --build           # tudo em contentores, http://localhost:3000
node .github/scripts/self-review.js DEV   # a auto-revisão, antes de abrir o PR
```

### Auto-revisão

`self-review.js` lê as linhas novas do diff contra `DEV` e aponta o que já custou um bug a
este repositório: o `basePath` written à mão num `redirect()` de server action (que é o que o
cliente do Next aplica, não o servidor), o `action` de um `<form>`, texto com caracteres de
outra escrita, `__html` que não é literal, segredos em literal, e lógica do mock que muda sem
um teste que a fixe. Corre no CI como check.

O que ela **não** apanha está escrito nos testes: letra dobrada numa palavra — o erro que eu
de facto commito — passa, porque letra dobrada é normal em português e a regra passaria a
gritar em texto correcto. E um problema que já estava no ficheiro não é blame da mudança; o
que está em falta no código de hoje é assunto de outra mudança, e `student/scripts/flow.mjs`
apanha o que estiver a correr mal.

Antes de mexer numa regra, lee `self-review.test.js`: cada uma tem um caso em que **não**
dispara, e é aí que um gate ganha ou perde a credibilidade.

## Docker

```bash
cp .env.example .env        # ajuste JWT_SECRET / KIXI_MOCK / BACKEND_API_URL
docker compose up --build   # http://localhost:3000
```

Cada app (landing, aluno, manager) corre no seu contentor e na sua porta interna (3004, 3003, 3002); só o **gateway** (`scripts/gateway.mjs`, porta 3000) é publicado. O browser vê uma origem única: `/` landing, `/aluno` app do aluno, `/manager` gestor. Para abrir cada app na sua porta (depuração): `docker compose -f docker-compose.yml -f docker-compose.debug.yml up`.

- `KIXI_MOCK=true` (por omissão) usa o backend simulado; com `false` é obrigatório `JWT_SECRET` (o mesmo do backend) e `BACKEND_API_URL`.
- Atrás de um proxy TLS (nginx, Caddy, Traefik) aponte-o para a porta 3000 e envie `X-Forwarded-Proto`/`X-Forwarded-Host`.
