# Playwright E2E

Quatro jornadas contra uma origem só: `/manager`, `/aluno` e a landing, servidas pelo
gateway do `docker-compose.yml`.

```bash
cp .env.example .env      # e preencher JWT_SECRET — ver abaixo
npm run test:e2e
```

## Antes de correr: o `JWT_SECRET`

**Sem `JWT_SECRET` as três jornadas caem com `reason=session-expired`, e o erro não
diz porquê.** O `docker-compose.yml` tem `JWT_SECRET: ${JWT_SECRET:-}`, ou seja, vazio
por omissão; a sessão é então assinada com uma chave vazia e logo rejeitada. Parece um
bug de autenticação, e é uma variável de ambiente em falta.

A CI define-o por `env:` no workflow. Localmente, ninguém define — daí o `.env.example`.
Tem de ter 32 caracteres no mínimo, e ser o mesmo no gestor e no aluno.

## Como corre

Sem `E2E_BASE_URL`, o Playwright arranca o `docker compose up --build` por si, espera
pelo `/healthz` do gateway e desliga a stack no fim. Docker Compose e o Chromium são
precisos localmente:

```bash
npx playwright install chromium
```

Já com o compose de pé, o Playwright reutiliza-o (`reuseExistingServer` fora da CI) em
vez de reconstruir. Para recarregar a stack com uma variável nova:

```bash
JWT_SECRET=<32+ chars> docker compose up -d
```

## Apontar a outro ambiente

`E2E_BASE_URL`, `E2E_ADMIN_USERNAME`, `E2E_TEACHER_USERNAME` e `E2E_PASSWORD`. Com
`E2E_BASE_URL` posto, o Playwright não arranca nem desliga nada.

Um ambiente externo tem de permitir registo de conta, importação de OCR, revisão e
publicação, e criação de sala para essas credenciais.

## O estado do mock

O mock semeia uma vez por processo e o estado vive em `globalThis` — **não há reset**. A
jornada do aluno cria contas e a do professor publica provas, por isso a segunda
passagem sobre a mesma stack depende da ordem. Para uma corrida isolada de verdade,
`docker compose down && JWT_SECRET=... docker compose up -d`, ou deixar o Playwright
arrancar a stack.

## Relatório

`playwright-report/` em HTML, aberto com `npx playwright show-report`. A CI anexa-o como
artifact mesmo quando uma jornada falha.

## Estabilidade

Nada de `waitForTimeout`: esperar por estados com `expect(...).toBeVisible()`. Os
`retries` só existem na CI (`retries: 1`), com `trace: 'on-first-retry'` — quando um
teste é instável, o rasto fica gravado em vez de se perder. Um teste que só passa com
retry é um bug, e a issue trata esse como tal.