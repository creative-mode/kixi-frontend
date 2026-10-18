// Testes do modo de avaliação (#192):  node --test student/lib/integrity.test.ts
//
// O que se fixa aqui é o que o cliente decide sozinho — e que, decidido mal, só se
// veria a correr: um evento duplicado por cada troca de separador, um tutor que
// prende o aluno numa prova já expirada, uma colagem bloqueada onde não há onde colar.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COALESCE_MS,
  INTEGRITY_KINDS,
  PASTE_NOTICE,
  integridadeAplica,
  isIntegrityKind,
  noticeFor,
  pasteBlocked,
  shouldRecord,
  tentativaViva,
  type IntegrityEvent,
} from './integrity.ts';

test('a lista de eventos é a mesma do gestor', () => {
  // A lista do gestor (`lib/exam-rooms/model.ts`) e o contrato do backend têm de
  // falar destes nomes. Este é o lado do aluno: se a lista mudar aqui sem mudar lá,
  // o backend e o ecrã do professor deixam de perceber o evento, sem erro nenhum.
  assert.deepEqual(
    [...INTEGRITY_KINDS].sort(),
    ['PASTE_BLOCKED', 'TAB_HIDDEN', 'TAB_VISIBLE', 'TUTOR_BLOCKED', 'WINDOW_BLUR', 'WINDOW_FOCUS'].sort(),
  );
  assert.equal(isIntegrityKind('TAB_HIDDEN'), true);
  assert.equal(isIntegrityKind('tab_hidden'), false);
  assert.equal(isIntegrityKind('QUALQUER_COISA'), false);
  assert.equal(isIntegrityKind(undefined), false);
});

test('só vigia uma tentativa a decorrer', () => {
  assert.equal(integridadeAplica('IN_PROGRESS'), true);
  assert.equal(integridadeAplica('in_progress'), true);
  assert.equal(integridadeAplica('FINISHED'), false);
  assert.equal(integridadeAplica('CANCELLED'), false);
  assert.equal(integridadeAplica(null), false);
});

test('esconder o separador e perder o foco são a mesma saída, e contam uma vez', () => {
  // Trocar de separador levanta `visibilitychange` (hidden) e `blur`. Registar os
  // dois contaria duas saídas onde só houve uma, e o professor leria o dobro.
  const recorded: IntegrityEvent[] = [];
  assert.equal(shouldRecord(recorded, 'TAB_HIDDEN', 1000), true);
  recorded.push({ kind: 'TAB_HIDDEN', at: 1000 });
  assert.equal(shouldRecord(recorded, 'WINDOW_BLUR', 1005), false);
});

test('voltar é uma marca, e o par seguinte já conta', () => {
  const recorded: IntegrityEvent[] = [{ kind: 'TAB_HIDDEN', at: 1000 }];
  assert.equal(shouldRecord(recorded, 'WINDOW_FOCUS', 3000), true);
  recorded.push({ kind: 'WINDOW_FOCUS', at: 3000 });
  assert.equal(shouldRecord(recorded, 'TAB_VISIBLE', 3001), false);
  // Uma segunda saída, já fora da janela, volta a contar.
  assert.equal(shouldRecord(recorded, 'TAB_HIDDEN', 3000 + COALESCE_MS), true);
});

test('eventos de grupos diferentes não se engolem', () => {
  // Bloquear uma colagem no meio de uma troca de separador é outra coisa, e tem de
  // aparecer: o professor quer ver as duas.
  const recorded: IntegrityEvent[] = [{ kind: 'TAB_HIDDEN', at: 1000 }];
  assert.equal(shouldRecord(recorded, 'PASTE_BLOCKED', 1100), true);
});

test('uma rajada de colagens recusadas é um evento, não dez', () => {
  const recorded: IntegrityEvent[] = [{ kind: 'PASTE_BLOCKED', at: 1000 }];
  assert.equal(shouldRecord(recorded, 'PASTE_BLOCKED', 1500), false);
  assert.equal(shouldRecord(recorded, 'PASTE_BLOCKED', 1000 + COALESCE_MS), true);
});

test('só as respostas abertas recusam colagem', () => {
  assert.equal(pasteBlocked({ options: [] }), true);
  assert.equal(pasteBlocked({ options: [{ id: 1 }] }), false);
});

test('o aluno é avisado ao voltar, e da colagem junto ao campo', () => {
  // Sair não se vê — o ecrã está noutro lado. O aviso tem de estar à espera ao voltar.
  assert.match(noticeFor('TAB_VISIBLE') ?? '', /Voltaste à prova/);
  assert.match(noticeFor('WINDOW_FOCUS') ?? '', /Voltaste à prova/);
  assert.match(PASTE_NOTICE, /Colar está desativado/);
  // A colagem tem o aviso dela, junto ao campo; o topo não repete.
  assert.equal(noticeFor('PASTE_BLOCKED'), null);
  assert.equal(noticeFor('TAB_HIDDEN'), null);
  assert.equal(noticeFor('WINDOW_BLUR'), null);
});

test('o tutor fecha numa tentativa viva e reabre quando o prazo passa', () => {
  const now = Date.parse('2026-10-18T08:00:00Z');
  const viva = [
    { id: 4, status: 'IN_PROGRESS', statement: { id: 7 }, deadline: '2026-10-18T10:00:00' },
    { id: 1, status: 'FINISHED', statement: { id: 7 } },
  ];
  assert.equal(tentativaViva(viva, 7, now)?.id, 4);

  // Expirou: o servidor ainda não fechou, mas o tutor não pode prender o aluno.
  const expirada = [
    { id: 4, status: 'IN_PROGRESS', statement: { id: 7 }, deadline: '2026-10-18T08:00:00' },
  ];
  assert.equal(tentativaViva(expirada, 7, now), null);

  // Sem tentativa desta prova, o tutor é livre.
  assert.equal(tentativaViva(viva, 99, now), null);
  assert.equal(tentativaViva([{ id: 1, status: 'FINISHED', statement: { id: 7 } }], 7, now), null);
});
