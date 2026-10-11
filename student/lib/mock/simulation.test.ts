// Testes das regras de simulação do mock:  node --test student/lib/mock/simulation.test.ts
//
// O mock existe para desenhar a sala de prova sem backend, mas um mock que mente
// sobre o contrato é pior do que nenhum: a sala seria construída contra prazos e
// notas que o servidor real não produz. Estes testes fixam os pontos em que os
// dois têm de concordar, com a referência do backend ao lado.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TOLERANCE_SECONDS,
  deadlineFor,
  expired,
  finalScore,
  gradeAnswer,
  isObjective,
  toLocalDateTime,
  type MockAnswer,
  type MockQuestion,
} from './simulation.ts';

const choice: MockQuestion = {
  id: 1,
  number: 1,
  text: 'Classe A tem qual prefixo?',
  questionType: 'multiple_choice',
  maxScore: 2,
  orderIndex: 0,
  options: [
    { id: 10, optionLabel: 'A', optionText: '/24', isCorrect: false, orderIndex: 0 },
    { id: 11, optionLabel: 'B', optionText: '/26', isCorrect: true, orderIndex: 1 },
  ],
};

const open: MockQuestion = {
  id: 2,
  number: 2,
  text: 'Explica o subnetting.',
  questionType: 'development',
  maxScore: 4,
  orderIndex: 1,
  options: [],
};

function answer(over: Partial<MockAnswer> = {}): MockAnswer {
  return {
    id: 1,
    simulationId: 1,
    questionId: 1,
    selectedOptionId: null,
    answerText: null,
    scoreObtained: null,
    isCorrect: null,
    reviewStatus: null,
    answeredAt: null,
    ...over,
  };
}

test('o prazo é o início mais a duração, mais a tolerância', () => {
  // SimulationDeadlineService.java:89-99. A tolerância entra no prazo devolvido,
  // por isso o cliente que subtrair `deadline` chega ao mesmo instante que o
  // servidor impõe — sem um segundo número para acertar.
  const deadline = deadlineFor('2026-10-11T10:00:00', 60, false);
  assert.equal(deadline, toLocalDateTime(new Date(Date.parse('2026-10-11T10:00:00') + (3600 + TOLERANCE_SECONDS) * 1000)));
});

test('com +25% de tempo a duração por minuto é de 75 segundos, não 60', () => {
  const normal = deadlineFor('2026-10-11T10:00:00', 60, false);
  const extra = deadlineFor('2026-10-11T10:00:00', 60, true);
  assert.equal(Date.parse(extra!) - Date.parse('2026-10-11T10:00:00'), 60 * 75 * 1000 + TOLERANCE_SECONDS * 1000);
  assert.equal(Date.parse(normal!) - Date.parse('2026-10-11T10:00:00'), 60 * 60 * 1000 + TOLERANCE_SECONDS * 1000);
});

test('sem início ou sem duração não há prazo, e a prova nunca expira', () => {
  // SimulationDeadlineService.java:89-91 devolve null nestes casos. Um prazo
  // inventado aqui faria o ecrã avisar o aluno de um tempo que não está a correr.
  assert.equal(deadlineFor(null, 60, false), null);
  assert.equal(deadlineFor('2026-10-11T10:00:00', null, false), null);
  assert.equal(expired(null), false);
});

test('o prazo é um LocalDateTime, sem zona', () => {
  // É o que o Jackson escreve para um LocalDateTime. Um `Z` aqui faria o cliente
  // ler o prazo noutro fuso e o cronómetro não bater certo com o servidor.
  assert.equal(toLocalDateTime(new Date(2026, 9, 11, 10, 0, 0)), '2026-10-11T10:00:00');
  assert.equal(deadlineFor('2026-10-11T10:00:00', 1, false)?.endsWith('Z'), false);
});

test('passado o prazo o servidor já não aceita respostas', () => {
  assert.equal(expired('2026-10-11T10:00:00', Date.parse('2026-10-11T10:00:01')), true);
  assert.equal(expired('2026-10-11T10:00:00', Date.parse('2026-10-11T09:59:59')), false);
  // Uma data ilegível não pode ser lida como "ainda há tempo" sem o servidor a dizer.
  assert.equal(expired('lixo', Date.parse('2026-10-11T09:00:00')), false);
});

test('uma questão é objectiva quando tem opções, não quando o tipo diz', () => {
  // SimulationSubmissionService.java:97-98: o gate de aprovação define objectiva
  // pela existência de alternativas, e o comentário avisa que o tipo pode vir
  // "aberto" ou vazio. Um mock que olhasse para a palavra daria nota a uma
  // resposta que o servidor manda para o professor.
  assert.equal(isObjective(choice), true);
  assert.equal(isObjective({ ...open, questionType: 'multiple_choice' }), false);
  assert.equal(isObjective({ ...choice, questionType: 'development' }), true);
});

test('a escolha certa vale a cotação, a errada vale zero', () => {
  const hit = gradeAnswer(answer({ selectedOptionId: 11 }), choice);
  assert.equal(hit.isCorrect, true);
  assert.equal(hit.scoreObtained, 2);
  assert.equal(hit.reviewStatus, 'AUTO_GRADED');

  const miss = gradeAnswer(answer({ selectedOptionId: 10 }), choice);
  assert.equal(miss.isCorrect, false);
  assert.equal(miss.scoreObtained, 0);

  // Uma alternativa que não é desta pergunta não é a resposta certa.
  const alien = gradeAnswer(answer({ selectedOptionId: 999 }), choice);
  assert.equal(alien.isCorrect, false);
  assert.equal(alien.scoreObtained, 0);
});

test('uma resposta em branco a uma escolha vale zero, não fica por corrigir', () => {
  const blank = gradeAnswer(answer({ selectedOptionId: null, answerText: 'texto' }), choice);
  assert.equal(blank.reviewStatus, 'AUTO_GRADED');
  assert.equal(blank.scoreObtained, 0);
});

test('a resposta aberta fica para o professor, sem nota nem veredicto', () => {
  // SimulationSubmissionService.java:104-108: sem cotação e sem isCorrect, à espera
  // de PATCH /simulation-answers/{id}/grade. Dar-lhe zero seria afirmar que o aluno
  // falhou, e é o professor que decide.
  const graded = gradeAnswer(answer({ questionId: 2, answerText: 'porque sim' }), open);
  assert.equal(graded.reviewStatus, 'PENDING_REVIEW');
  assert.equal(graded.scoreObtained, null);
  assert.equal(graded.isCorrect, null);
});

test('a nota final é a soma das cotações, em fração decimal', () => {
  const answers = [
    gradeAnswer(answer({ id: 1, selectedOptionId: 11 }), choice),
    gradeAnswer(answer({ id: 2, questionId: 2, answerText: 'texto' }), open),
    gradeAnswer(answer({ id: 3, questionId: 3, selectedOptionId: 10 }), {
      ...choice,
      id: 3,
      maxScore: 1.5,
      options: choice.options,
    }),
  ];
  // 2 + 0 (a aberta não pontua) + 0 = 2. Uma aberta por corrigir não pesa para baixo.
  assert.equal(finalScore(answers), 2);
});

test('o LocalDateTime do mock é a hora do servidor (+01:00), seja qual for o fuso do processo', () => {
  assert.equal(toLocalDateTime(new Date('2026-10-11T09:30:00Z')), '2026-10-11T10:30:00');
  // Ida e volta: o prazo calculado lê-se de volta no mesmo instante.
  const deadline = deadlineFor('2026-10-11T10:00:00', 1, false);
  assert.equal(deadline, '2026-10-11T10:01:10');
});
