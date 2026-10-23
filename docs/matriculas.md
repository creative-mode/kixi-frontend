# Matrícula por código da escola

A decisão do kixi#255 foi **código ou convite da escola**, não aprovação pelo
professor. Não há, por isso, estado `PENDING`, fila de pendentes nem ecrã de
aprovação: o backend continua com `ACTIVE` e `CANCELLED`, e a issue #181 ficou
reduzida ao código no onboarding do aluno e à gestão de códigos no Manager.

## Aluno

O onboarding do aluno tem um único campo, o código. A turma e o ano letivo vêm do
código (`EnrollmentService.resolveBySelfEnrollCode`, kixi#255); o ecrã deixou de
pedir escola/curso/turma, escolhas que o servidor ignorava na auto-matrícula. Um
código inexistente, expirado, revogado ou esgotado devolve o mesmo `400` — o
backend não os distingue de propósito — e a app mostra uma mensagem que pede para
confirmar o código com a escola. `409` é uma matrícula ativa no mesmo ano letivo;
`429` são tentativas a mais.

O código de demonstração do mock é `TESTE1234`, da turma 12B (id 1). O fluxo do
aluno usa também `TESTE5678`, da 11A (id 5), para os estados de turma sem dados.

## Manager

A lista de **Turmas** tem um botão de códigos por turma (o ícone de bilhete).
Abre um diálogo para gerar, listar e revogar:

- `POST /api/v1/enrollment-codes` com `{ classId, maxUses?, expiresAt? }`;
  `maxUses` por omissão é 1 e `expiresAt` é opcional;
- `GET /api/v1/enrollment-codes?classId=...`;
- `DELETE /api/v1/enrollment-codes/{id}` revoga (idempotente).

Tudo é **ADMIN-only**, como no backend. O código gerado tem 8 caracteres e não
usa `O`, `0`, `I`, `1` nem `L`, para se poder ditar sem ambiguidade. O mock do
Manager implementa as mesmas rotas e regras, para o ecrã poder ser exercitado
sem a stack do backend.

## O que isto não resolve

O código prova que a escola autorizou aquela turma, não que a pessoa é quem diz
ser: continua a ser preciso o trabalho de verificação de email e o rate limit do
kixi#255. Um código partilhado dentro do limite de usos deixa entrar quem o
tiver; para um código individual, `maxUses = 1`.
