// Testes das regras da sala de prova:  node --test student/lib/exam-rules.test.ts
//
// Cada teste aqui fixa uma decisão que o backend já tomou e que o cliente repetiria
// errado sem o contrato à vista. As referências são ao backend (creative-mode/kixi),
// não ao frontend, porque é de lá que vem a regra.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptsAnswers,
  answerRequest,
  answeredQuestionIds,
  attemptFor,
  cellState,
  formatClock,
  isChoice,
  isGroup,
  orderQuestions,
  backoffMs,
  isTransient,
  parseServerTime,
  remainingMs,
  translateError,
  savedAnswerFor,
  timer,
  type ExamQuestion,
  type SavedAnswer,
} from './exam-rules.ts';

function choice(id: number, number: number, options: { id: number }[]): ExamQuestion {
  return {
    id,
    number,
    text: `Q${number}`,
    questionType: 'multiple_choice',
    options: options.map((o) => ({ id: o.id, optionText: `Opção ${o.id}` })),
  };
}

function open(id: number, number: number, questionType = 'short_answer'): ExamQuestion {
  return { id, number, text: `Q${number}`, questionType, options: [] };
}

test('uma questão é de escolha quando tem opções, não quando o tipo diz "multiple_choice"', () => {
  // Question.questionType é uma coluna String livre, sem enum nem validação
  // (Question.java:50), e a correção ramifica por `!options.isEmpty()`
  // (SimulationSubmissionService.java:98). Confiar na palavra dá uma questão de
  // texto com grupo de rádio, que o servidor corrige como aberta.
  const mistyped = open(1, 1, 'multiple_choice');
  assert.equal(isChoice(mistyped), false);

  const wrongText = choice(2, 2, [{ id: 1 }]);
  wrongText.questionType = 'development';
  assert.equal(isChoice(wrongText), true);
});

test('ordena por número, e pelo índice quando o número não serve', () => {
  const unordered = [choice(3, 3, [{ id: 1 }]), choice(1, 1, [{ id: 1 }]), open(2, 2)];
  assert.deepEqual(orderQuestions(unordered).map((q) => q.number), [1, 2, 3]);

  const noNumber = [
    { id: 9, number: Number.NaN, orderIndex: 2, text: 'b', options: [] },
    { id: 8, number: Number.NaN, orderIndex: 1, text: 'a', options: [] },
  ];
  assert.deepEqual(orderQuestions(noNumber).map((q) => q.id), [8, 9]);

  // Nem número nem índice: a ordem do enunciado é a do servidor, não uma reordenação.
  const bare = [
    { id: 7, number: Number.NaN, orderIndex: null, text: 'segunda', options: [] },
    { id: 6, number: Number.NaN, orderIndex: null, text: 'primeira', options: [] },
  ];
  assert.deepEqual(orderQuestions(bare).map((q) => q.text), ['segunda', 'primeira']);
});

test('escolha envia a opção e nunca texto', () => {
  const question = choice(1, 1, [{ id: 10 }, { id: 11 }]);
  assert.deepEqual(answerRequest(5, question, { optionId: 11 }), {
    simulationId: 5,
    questionId: 1,
    selectedOptionId: 11,
    answerText: null,
  });
});

test('aberta envia o texto e nunca a opção', () => {
  const question = open(1, 1);
  assert.deepEqual(answerRequest(5, question, { text: '  subnetting  ' }), {
    simulationId: 5,
    questionId: 1,
    selectedOptionId: null,
    answerText: 'subnetting',
  });
});

test('desmarcar uma escolha e apagar o texto deixam a questão por responder', () => {
  // Uma string vazia guardada como resposta seria corrigida pelo professor como
  // PENDING_REVIEW, e o mapa diria "respondida" a uma pergunta que não está.
  const choiceBody = answerRequest(5, choice(1, 1, [{ id: 10 }]), { optionId: null });
  assert.equal(choiceBody.selectedOptionId, null);

  const textBody = answerRequest(5, open(1, 1), { text: '   ' });
  assert.equal(textBody.answerText, null);
});

test('uma opção que não existe não vira resposta', () => {
  // selectedOptionId vem do formulário; um id de outra questão, ou lixo, tem de
  // chegar como null e não como um id que o servidor aceitaria.
  const body = answerRequest(5, choice(1, 1, [{ id: 10 }]), { optionId: 999 });
  assert.equal(body.selectedOptionId, null);
  assert.equal(answerRequest(5, choice(1, 1, [{ id: 10 }]), { optionId: 0 }).selectedOptionId, null);
});

test('o corpo do pedido não leva answeredAt', () => {
  // O servidor ignora-o ao decidir se o tempo acabou (SimulationAnswerService.java:118)
  // e é um LocalDateTime: mandar 'Z' faria o Jackson falhar a desserialização.
  const body = answerRequest(5, open(1, 1), { text: 'ok' });
  assert.equal('answeredAt' in body, false);
});

const answers: SavedAnswer[] = [
  { id: 100, simulationId: 5, questionId: 1, selectedOptionId: 11 },
  { id: 101, simulationId: 5, questionId: 2, answerText: 'par' },
  { id: 102, simulationId: 5, questionId: 3, selectedOptionId: null, answerText: '  ' },
  { id: 103, simulationId: 6, questionId: 4, selectedOptionId: 12 },
];

test('conta como respondida o que tem opção ou texto com conteúdo', () => {
  const ids = answeredQuestionIds(answers, 5);
  assert.deepEqual([...ids].sort(), [1, 2]);
});

test('uma resposta de outra simulação não acende o mapa', () => {
  // As respostas de todas as tentativas vêm no mesmo GET /simulation-answers.
  const ids = answeredQuestionIds(answers, 5);
  assert.equal(ids.has(4), false);
  assert.equal(answeredQuestionIds(answers, 6).has(4), true);
});

test('recupera a resposta guardada ao retomar', () => {
  assert.equal(savedAnswerFor(answers, 5, 2)?.answerText, 'par');
  assert.equal(savedAnswerFor(answers, 5, 2)?.id, 101);
  assert.equal(savedAnswerFor(answers, 5, 99), undefined);
});

test('a marcada ganha à respondida no mapa', () => {
  const answered = new Set([1, 2]);
  assert.equal(cellState(1, answered, new Set()), 'done');
  assert.equal(cellState(1, answered, new Set([1])), 'flag');
  assert.equal(cellState(3, answered, new Set()), 'empty');
});

test('sem deadline não há cronómetro, e um deadline ilegível também não', () => {
  // SimulationDeadlineService.java:89 devolve null quando não há startedAt ou não há
  // durationMinutes: essa simulação nunca expira. Inventar um prazo seria mentira.
  assert.equal(remainingMs(null, parseServerTime('2026-10-11T10:00:00')), null);
  assert.equal(remainingMs('não é uma data', parseServerTime('2026-10-11T10:00:00')), null);

  const now = parseServerTime('2026-10-11T10:00:00');
  assert.equal(remainingMs('2026-10-11T10:30:00', now), 30 * 60 * 1000);
  assert.equal(remainingMs('2026-10-11T09:00:00', now), -60 * 60 * 1000);
});

test('o cronómetro conta minutos e, a partir da hora, horas', () => {
  assert.equal(formatClock(42 * 60 * 1000 + 10 * 1000), '42:10');
  assert.equal(formatClock(9 * 1000), '00:09');
  assert.equal(formatClock(62 * 60 * 1000), '1:02:00');
});

test('antes de o relógio arrancar o cronómetro ainda não sabe o que falta', () => {
  // A sala é um componente de cliente mas o servidor também a renderiza, e o
  // `Date.now()` dele não é o do aluno. Sem este estado, o primeiro render
  // diria "Sem tempo" numa prova que está a contar.
  const agora = parseServerTime('2026-10-11T10:00:00');
  assert.equal(timer('2026-10-11T10:30:00', null), 'a-contar');
  assert.equal(timer('2026-10-11T10:30:00', agora), 'restante');
});

test('sem deadline é "sem limite", não "a contar"', () => {
  // São coisas diferentes: uma prova sem `durationMinutes` nunca expira
  // (SimulationDeadlineService.java:89), e dizer que está a contar seria falso.
  const agora = parseServerTime('2026-10-11T10:00:00');
  assert.equal(timer(null, agora), 'sem-limite');
  assert.equal(timer('não é uma data', agora), 'sem-limite');
  assert.notEqual(timer(null, agora), timer(null, null));
});

test('passado o prazo o cronómetro fica a zero, não negativo', () => {
  // O servidor fecha a simulação; mostrar -0:01 pareceria o ecrã partido.
  assert.equal(formatClock(-5000), '00:00');
});

test('retoma a tentativa em curso, mesmo havendo uma terminada mais recente', () => {
  const simulations = [
    { id: 1, status: 'FINISHED', statement: { id: 7 } },
    { id: 9, status: 'FINISHED', statement: { id: 7 } },
    { id: 4, status: 'IN_PROGRESS', statement: { id: 7 } },
    { id: 2, status: 'IN_PROGRESS', statement: { id: 8 } },
  ];
  assert.equal(attemptFor(simulations, 7)?.id, 4);
  assert.equal(attemptFor(simulations, 8)?.id, 2);
  assert.equal(attemptFor(simulations, 99), null);
});

test('sem tentativa em curso, a mais recente é a que se mostra', () => {
  const simulations = [
    { id: 1, status: 'FINISHED', statement: { id: 7 } },
    { id: 9, status: 'FINISHED', statement: { id: 7 } },
  ];
  assert.equal(attemptFor(simulations, 7)?.id, 9);
});

test('o estado vem em maiúsculas ou minúsculas, consoxe o servidor', () => {
  assert.equal(attemptFor([{ id: 3, status: 'in_progress', statement: { id: 7 } }], 7)?.id, 3);
});

test('aceita respostas só em curso e antes do prazo', () => {
  const now = parseServerTime('2026-10-11T10:00:00');
  assert.equal(acceptsAnswers({ id: 1, status: 'IN_PROGRESS' }, now), true);
  assert.equal(
    acceptsAnswers({ id: 1, status: 'IN_PROGRESS', deadline: '2026-10-11T10:30:00' }, now),
    true,
  );
  assert.equal(acceptsAnswers({ id: 1, status: 'FINISHED' }, now), false);
  assert.equal(
    acceptsAnswers({ id: 1, status: 'IN_PROGRESS', deadline: '2026-10-11T09:59:00' }, now),
    false,
  );
  assert.equal(acceptsAnswers(null, now), false);
});

test('um prazo sem fuso lê-se na hora do servidor (+01:00), não na do aparelho', () => {
  // 10:30 em Luanda são 09:30 UTC, seja qual for o fuso do telemóvel.
  assert.equal(parseServerTime('2026-10-11T10:30:00'), Date.parse('2026-10-11T09:30:00Z'));
  assert.equal(parseServerTime('2026-10-11T10:30:00Z'), Date.parse('2026-10-11T10:30:00Z'));
  assert.equal(parseServerTime('2026-10-11T10:30:00-03:00'), Date.parse('2026-10-11T13:30:00Z'));
  assert.ok(Number.isNaN(parseServerTime('lixo')));

  const now = Date.parse('2026-10-11T09:00:00Z');
  assert.equal(remainingMs('2026-10-11T10:30:00', now), 30 * 60 * 1000);
});

test('uma resposta por guardar aparece no mapa antes de tudo o resto', () => {
  const answered = new Set([1]);
  assert.equal(cellState(1, answered, new Set([1]), new Set([1])), 'unsaved');
  assert.equal(cellState(2, answered, new Set(), new Set([2])), 'unsaved');
  assert.equal(cellState(1, answered, new Set()), 'done');
});

test('os erros conhecidos do backend saem em português, os outros ficam como vieram', () => {
  assert.equal(translateError('The time allowed for this simulation has expired'), 'O tempo desta prova terminou.');
  assert.match(translateError('The statement is currently assigned to an exam room'), /sala de prova/);
  assert.equal(translateError('Algo inesperado'), 'Algo inesperado');
});

test('só se repete o que pode correr melhor: rede e 5xx, não uma recusa', () => {
  assert.equal(isTransient(0), true);
  assert.equal(isTransient(503), true);
  assert.equal(isTransient(400), false);
  assert.equal(isTransient(409), false);
  assert.deepEqual([1, 2, 3, 4, 9].map(backoffMs), [1000, 2000, 4000, 8000, 8000]);
});

// ── questões com alíneas ─────────────────────────────────────────────────────


function leaf(id: number, number: number, parentId: number, label: string, type = 'true_false'): ExamQuestion {
  return { id, number, text: `Alínea ${number}`, questionType: type, parentId, label, options: type === 'open' ? [] : [{ id: id * 10, optionText: 'Verdadeiro' }, { id: id * 10 + 1, optionText: 'Falso' }] };
}
const grupo = (id: number, number: number, text: string): ExamQuestion => ({ id, number, text, questionType: 'group', options: [] });

/** Q1 aberta; Q2 (grupo V/F, alíneas a, b); Q3 aberta; Q4 (grupo, alíneas a, b). Fora de ordem de propósito. */
function ogi(): ExamQuestion[] {
  return [
    leaf(23, 402, 40, 'b', 'open'), open(1, 1), leaf(21, 201, 20, 'a'), grupo(40, 4, 'Dados comuns da Q4'), open(3, 3),
    leaf(22, 202, 20, 'b'), leaf(24, 401, 40, 'a', 'open'), grupo(20, 2, 'Diga quais são verdadeiras ou falsas'),
  ];
}

test('com alíneas, cada uma vem a seguir ao seu pai e não depois da última questão', () => {
  assert.deepEqual(orderQuestions(ogi()).map((q) => q.number), [1, 201, 202, 3, 401, 402]);
});

test('a questão com alíneas sai da lista: o aluno só percorre as folhas', () => {
  const lista = orderQuestions(ogi());
  assert.equal(lista.length, 6);
  assert.ok(lista.every((q) => !isGroup(q)));
});

test('cada alínea leva o enunciado comum e o número da questão inteira', () => {
  const lista = orderQuestions(ogi());
  const a = lista.find((q) => q.id === 21)!;
  assert.equal(a.parentText, 'Diga quais são verdadeiras ou falsas');
  assert.equal(a.parentNumber, 2);
  const b4 = lista.find((q) => q.id === 23)!;
  assert.equal(b4.parentText, 'Dados comuns da Q4');
  assert.equal(b4.parentNumber, 4);
  // as de topo não levam contexto
  assert.equal(lista.find((q) => q.id === 1)!.parentText, undefined);
});

test('o enunciado comum que o servidor manda vale mais do que o do pai, e sem pai o número chega', () => {
  const comPai = [leaf(5, 301, 99, 'a', 'open')];
  const [sozinha] = orderQuestions([{ ...comPai[0], parentText: 'Do servidor' }]);
  assert.equal(sozinha.parentText, 'Do servidor');
  assert.equal(sozinha.parentNumber, 3);
  const [semPai] = orderQuestions(comPai);
  assert.equal(semPai.parentText, null);
  assert.equal(semPai.parentNumber, 3);
});

test('um grupo sem alíneas desaparece e uma lista sem grupos fica igual', () => {
  assert.deepEqual(orderQuestions([grupo(1, 1, 'vazio'), open(2, 2)]).map((q) => q.id), [2]);
  const simples = [choice(2, 2, [{ id: 1 }]), open(1, 1)];
  assert.deepEqual(orderQuestions(simples).map((q) => q.number), [1, 2]);
});

test('verdadeiro/falso responde-se por opção, como qualquer escolha', () => {
  const a = leaf(21, 201, 20, 'a');
  assert.equal(isChoice(a), true);
  assert.deepEqual(answerRequest(7, a, { optionId: 211 }), { simulationId: 7, questionId: 21, selectedOptionId: 211, answerText: null });
  // e uma opção de outra questão não vale
  assert.equal(answerRequest(7, a, { optionId: 9999 }).selectedOptionId, null);
});
