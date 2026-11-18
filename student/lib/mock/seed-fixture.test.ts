// Testes da semente do mock:  node --test student/lib/mock/seed-fixture.test.ts
//
// A #793 consolidou a tentativa 1 (a resposta aberta passou a AI_GRADED) e o mock
// ficou sem nenhuma resposta PENDING_REVIEW na semente. Duas suítes de E2E
// (#801 e #788) dependem desse estado para a nota provisional; estas asserções
// prendem a existência da tentativa 8 para que o `journeys.spec.ts` tenha a
// base de que precisa. Se a semente mudar, os testes querem uma actualização a sério.
// Não usa `./store.ts` de propósito: está marcado `import 'server-only'` e não
// carrega no node --test; a verificação é sobre o ficheiro tal como está em disco.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const SOURCE = readFileSync(new URL('./store.ts', import.meta.url), 'utf8');

test('a tentativa 8 aguarda correcção', () => {
  assert.match(SOURCE, /id: 8, accountId: 3, statementId: 1, status: 'FINISHED'/);
  assert.match(SOURCE, /PENDING_REVIEW/);
});

test('a simulação 1 está consolidada com a correcção como chegou pelo fluxo da #793', () => {
  assert.match(SOURCE, /id: 1, accountId: 3, statementId: 1, status: 'FINISHED'/);
  assert.match(SOURCE, /reviewStatus: 'AI_GRADED'/);
  assert.match(SOURCE, /correctedAt/);
});
