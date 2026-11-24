import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  aguardaCorrecao,
  calculateScoreBreakdown,
  contagemDeCertas,
  compareWithPrevious,
  formatDelta,
  formatDuration,
  formatScore,
  givenAnswers,
  inOrder,
  observation,
  partilha,
  optionTag,
  toReview,
  verdict,
  type ResultQuestion,
  showsContext,
} from './result-rules.ts';
import { wholeNumbers } from './question-number.ts';

const q = (over: Partial<ResultQuestion>): ResultQuestion => ({ questionId: 1, number: 1, text: 'x', ...over });

test('certa, errada, por corrigir e em branco são quatro coisas', () => {
  assert.equal(verdict(q({ isCorrect: true, selectedOptionId: 1 })), 'correct');
  assert.equal(verdict(q({ isCorrect: false, selectedOptionId: 2 })), 'wrong');
  assert.equal(verdict(q({ isCorrect: null, reviewStatus: 'PENDING_REVIEW', answerText: 'texto' })), 'pending');
  assert.equal(verdict(q({ isCorrect: false })), 'blank');
});

test('uma resposta aberta por corrigir não é um erro', () => {
  const list = [
    q({ number: 3, reviewStatus: 'PENDING_REVIEW', answerText: 'a' }),
    q({ number: 2, isCorrect: false, selectedOptionId: 9 }),
    q({ number: 1, isCorrect: true, selectedOptionId: 1 }),
  ];
  assert.deepEqual(toReview(list).map((x) => x.number), [2]);
});

test('as questões seguem a ordem do servidor, que é a da prova, sem mexer na lista recebida', () => {
  // A ordem da prova é a em que as questões chegam (order_index): o número não é uma ordem.
  const list = [q({ number: 2 }), q({ number: 1 })];
  const out = inOrder(list);
  assert.deepEqual(out.map((x) => x.number), [2, 1]);
  assert.notEqual(out, list);
  assert.deepEqual(inOrder(undefined), []);
});

test('a nota sai como o servidor a calculou, com vírgula; sem nota não é zero', () => {
  assert.equal(formatScore(16.4), '16,4');
  assert.equal(formatScore(0), '0');
  assert.equal(formatScore(null), null);
});

test('o tempo gasto é legível', () => {
  assert.equal(formatDuration(45), '45 s');
  assert.equal(formatDuration(3120), '52 min');
  assert.equal(formatDuration(3900), '1 h 05 min');
  assert.equal(formatDuration(null), null);
});

test('uma tentativa por corrigir não serve de comparação', () => {
  const attempts = [
    { id: 1, status: 'FINISHED', finalScore: 9.5, correctionStatus: 'PENDING' },
    { id: 2, status: 'FINISHED', finalScore: 14.2, correctionStatus: 'DONE' },
  ];
  assert.deepEqual(compareWithPrevious(3, 16.4, attempts), { previousScore: 14.2, delta: 2.2 });
});

test('compara com a tentativa terminada imediatamente anterior', () => {
  const attempts = [
    { id: 1, status: 'FINISHED', finalScore: 14.2 },
    { id: 2, status: 'CANCELLED', finalScore: null },
    { id: 3, status: 'IN_PROGRESS', finalScore: null },
    { id: 5, status: 'FINISHED', finalScore: 19 },
  ];
  const c = compareWithPrevious(4, 16.4, attempts);
  assert.deepEqual(c, { previousScore: 14.2, delta: 2.2 });
  assert.equal(compareWithPrevious(1, 14.2, attempts), null, 'a primeira não tem anterior');
  assert.equal(compareWithPrevious(4, null, attempts), null);
});

test('a diferença mostra o sinal', () => {
  assert.equal(formatDelta(2.2), '+2,2');
  assert.equal(formatDelta(-1.5), '-1,5');
  assert.equal(formatDelta(0), '0');
});

test('a etiqueta da opção é a da prova, ou a letra pela posição', () => {
  assert.equal(optionTag({ id: 1, optionLabel: 'B', optionText: 'x' }, 0), 'B');
  assert.equal(optionTag({ id: 1, optionLabel: ' ', optionText: 'x' }, 2), 'C');
});

test('o que o aluno respondeu viaja para o tutor pelo número da questão', () => {
  const list = [
    q({ number: 1, isCorrect: true, selectedOptionId: 1, options: [{ id: 1, optionText: 'Certa' }] }),
    q({ number: 2, isCorrect: false, selectedOptionId: 9, options: [{ id: 9, optionText: '/24' }] }),
    q({ number: 3, isCorrect: false, selectedOptionId: null, answerText: 'porque sim' }),
  ];
  assert.deepEqual([...givenAnswers(list)], [[2, '/24'], [3, 'porque sim']]);
});

test('uma questão em branco não leva resposta nenhuma', () => {
  assert.equal(givenAnswers([q({ number: 4, isCorrect: false })]).size, 0);
  assert.equal(givenAnswers([q({ number: 5, isCorrect: false, answerText: '   ' })]).size, 0);
});

test('uma resposta por corrigir não é tratada como erro do aluno', () => {
  const list = [q({ number: 6, isCorrect: null, reviewStatus: 'PENDING_REVIEW', answerText: 'texto' })];
  assert.equal(givenAnswers(list).size, 0);
});

test('a resposta de uma alínea viaja no número da questão inteira', () => {
  // O link leva `questoes=3` e a resposta vinha com a chave 301. O `?respostas=` era
  // procurado pelo 3 e nunca a encontrava: a resposta chegava ao link e nunca
  // chegava ao tutor.
  const list = [
    rq(1, 301, { isCorrect: false, answerText: 'a) Verdade' }),
    rq(2, 302, { isCorrect: false, answerText: 'b) Falso' }),
  ];
  assert.deepEqual([...givenAnswers(list)], [[3, 'a) Verdade\nb) Falso']]);
  // e as chaves são as mesmas que o link põe em `questoes`
  assert.deepEqual([...givenAnswers(list).keys()], wholeNumbers(toReview(list)));
});

// ── questões com alíneas ─────────────────────────────────────────────────────

const rq = (questionId: number, number: number, extra: Partial<ResultQuestion> = {}): ResultQuestion => ({ questionId, number, text: `Q${number}`, ...extra });
/** Na ordem do servidor: cada alínea já vem a seguir à sua questão. */
const COM_ALINEAS = [
  rq(1, 1), rq(2, 301, { parentId: 30, label: 'a', parentText: 'Diga V ou F' }), rq(3, 302, { parentId: 30, label: 'b', parentText: 'Diga V ou F' }),
  rq(4, 4), rq(8, 501, { parentId: 50, label: 'a', parentText: 'Dados da Q5' }), rq(9, 502, { parentId: 50, label: 'b', parentText: 'Dados da Q5' }),
];

test('a ordem do resultado é a do servidor e não se reordena por número', () => {
  assert.deepEqual(inOrder(COM_ALINEAS).map((q) => q.number), [1, 301, 302, 4, 501, 502]);
  // sem reordenar: 301 não passa para depois do 4
  assert.deepEqual(inOrder([rq(1, 5), rq(2, 301, { parentId: 3 }), rq(3, 2)]).map((q) => q.number), [5, 301, 2]);
});

test('o enunciado comum mostra-se uma vez, na primeira alínea de cada questão', () => {
  const lista = inOrder(COM_ALINEAS);
  assert.deepEqual(lista.map((_, i) => showsContext(lista, i)), [false, true, false, false, true, false]);
});

test('sem enunciado comum não há contexto a mostrar, e a primeira da lista mostra-o se o tiver', () => {
  assert.equal(showsContext([rq(1, 1)], 0), false);
  assert.equal(showsContext([rq(1, 301, { parentText: 'x' })], 0), true);
});

test('o tutor recebe as questões inteiras que o aluno errou', () => {
  const erradas = [rq(1, 301, { isCorrect: false }), rq(2, 302, { isCorrect: false }), rq(3, 6, { isCorrect: false })];
  assert.deepEqual(wholeNumbers(toReview(erradas)), [3, 6]);
});

test('a observação por baixo da nota é a do SchoolOps ou a da IA numa prova de plano, e vazia não é observação (kixi#542)', () => {
  assert.equal(observation({ feedback: 'Do motor.', aiFeedback: 'Da IA.' }), 'Do motor.');
  assert.equal(observation({ feedback: null, aiFeedback: '  Falta o tempo de vida.  ' }), 'Falta o tempo de vida.');
  assert.equal(observation({ feedback: '', aiFeedback: '   ' }), null);
  assert.equal(observation({}), null);
});

test('uma dissertativa corrigida pela IA não fica por corrigir', () => {
  const q = { questionId: 1, number: 1, text: 'q', answerText: 'x', isCorrect: true, reviewStatus: 'AI_GRADED' };
  assert.equal(verdict(q), 'correct');
  const errada = { ...q, isCorrect: false };
  assert.equal(verdict(errada), 'wrong');
});

// ── calculateScoreBreakdown (#798: transparência da nota) ────────────────────

/** Helper próprio dos testes de breakdown: questões de objetivas vs abertas. */
const bq = (over: Partial<ResultQuestion> = {}): ResultQuestion => ({
  questionId: 1,
  number: 1,
  text: 'Pergunta',
  options: [],
  maxScore: 2,
  scoreObtained: 2,
  isCorrect: true,
  ...over,
});

const obj = (over: Partial<ResultQuestion> = {}): ResultQuestion =>
  bq({ options: [{ id: 1, optionText: 'A', isCorrect: true }], ...over });

test('calculateScoreBreakdown: only objective questions', () => {
  const questions = [obj({ maxScore: 2, scoreObtained: 2 }), obj({ maxScore: 2, scoreObtained: 0 })];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.objectiveScore, 2);
  assert.equal(b.objectiveMax, 4);
  assert.equal(b.openScore, 0);
  assert.equal(b.openMax, 0);
  assert.equal(b.openPendingScore, 0);
  assert.equal(b.openPendingMax, 0);
  assert.equal(b.hasAiGraded, false);
  assert.equal(b.hasSchoolOpsGraded, false);
});

test('calculateScoreBreakdown: objective + open graded by AI', () => {
  const questions = [
    obj({ maxScore: 2, scoreObtained: 2 }),
    bq({ maxScore: 4, scoreObtained: 3, aiLevel: 'PARCIAL', aiFeedback: 'OK' }),
  ];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.objectiveScore, 2);
  assert.equal(b.objectiveMax, 2);
  assert.equal(b.openScore, 3);
  assert.equal(b.openMax, 4);
  assert.equal(b.openPendingScore, 0);
  assert.equal(b.openPendingMax, 0);
  assert.equal(b.hasAiGraded, true);
  assert.equal(b.hasSchoolOpsGraded, false);
});

test('calculateScoreBreakdown: open questions pending (no score)', () => {
  const questions = [
    obj({ maxScore: 2, scoreObtained: 2 }),
    bq({ maxScore: 4, scoreObtained: null, isCorrect: null }),
  ];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.objectiveScore, 2);
  assert.equal(b.objectiveMax, 2);
  assert.equal(b.openScore, 0);
  assert.equal(b.openMax, 0);
  assert.equal(b.openPendingScore, 0);
  assert.equal(b.openPendingMax, 4);
  assert.equal(b.hasAiGraded, false);
  assert.equal(b.hasSchoolOpsGraded, false);
});

test('calculateScoreBreakdown: mixed graded and pending open', () => {
  const questions = [
    obj({ maxScore: 2, scoreObtained: 2 }),
    bq({ maxScore: 4, scoreObtained: 3, aiLevel: 'TOTAL' }),
    bq({ maxScore: 4, scoreObtained: null }),
  ];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.openScore, 3);
  assert.equal(b.openMax, 4);
  assert.equal(b.openPendingScore, 0);
  assert.equal(b.openPendingMax, 4);
  assert.equal(b.hasAiGraded, true);
});

test('calculateScoreBreakdown: SchoolOps graded (feedback but no aiLevel)', () => {
  const questions = [
    obj({ maxScore: 2, scoreObtained: 2 }),
    bq({ maxScore: 4, scoreObtained: 3, feedback: 'Bem', isCorrect: true }),
  ];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.hasAiGraded, false);
  assert.equal(b.hasSchoolOpsGraded, true);
});

test('calculateScoreBreakdown: maxScore null treated as 0', () => {
  const questions = [obj({ maxScore: null, scoreObtained: 2 })];
  const b = calculateScoreBreakdown(questions);
  assert.equal(b.objectiveMax, 0);
  assert.equal(b.objectiveScore, 2);
});

test('calculateScoreBreakdown: empty questions', () => {
  const b = calculateScoreBreakdown([]);
  assert.equal(b.objectiveScore, 0);
  assert.equal(b.objectiveMax, 0);
  assert.equal(b.openScore, 0);
  assert.equal(b.openMax, 0);
});

test('calculateScoreBreakdown: undefined questions', () => {
  const b = calculateScoreBreakdown(undefined);
  assert.equal(b.objectiveScore, 0);
  assert.equal(b.objectiveMax, 0);
});
test('quando o cartão de partilha não aparece, diz-se porquê em vez de desaparecer (#789)', () => {
  assert.equal(partilha(12, 16.4, true), 'pode');
  // O perfil não carregou: a turma é desconhecida, não inexistente. Era o caso silencioso.
  assert.equal(partilha(null, 16.4, false), 'sem-perfil');
  assert.equal(partilha(null, 16.4, true), 'sem-turma');
  // Sem nota (por corrigir) não há o que partilhar, tenha o aluno turma ou não.
  assert.equal(partilha(12, null, true), 'sem-nota');
  assert.equal(partilha(null, null, false), 'sem-nota');
});

// Logo após entregar com a sala ainda aberta o backend não traz nota nem gabarito (kixi: `isCorrect`, `scoreObtained` e
// `correctOptionId` a null): «0/20 pelo gabarito» seria um zero que não existe.
const aguardar = (over: Partial<ResultQuestion> = {}): ResultQuestion =>
  bq({ options: [{ id: 1, optionText: 'A' }, { id: 2, optionText: 'B' }], selectedOptionId: 2, scoreObtained: null, isCorrect: null, correctOptionId: null, ...over });

test('calculateScoreBreakdown: sem nota das objetivas não há «0 pelo gabarito», há a aguardar a correção', () => {
  const b = calculateScoreBreakdown([aguardar(), aguardar({ questionId: 2 })]);
  assert.equal(b.objectiveGraded, false);
  assert.equal(b.objectiveMax, 4);
});

test('calculateScoreBreakdown: com pelo menos uma objetiva corrigida a nota conta, mesmo que seja 0', () => {
  assert.equal(calculateScoreBreakdown([obj({ scoreObtained: 0, isCorrect: false })]).objectiveGraded, true);
  assert.equal(calculateScoreBreakdown([obj({ scoreObtained: 2 }), aguardar()]).objectiveGraded, true);
  assert.equal(calculateScoreBreakdown([]).objectiveGraded, false);
});

test('uma prova entregue sem nota e com respostas por corrigir aguarda correção', () => {
  const objetiva = q({ questionId: 1, selectedOptionId: 3, isCorrect: null });
  assert.equal(aguardaCorrecao({ finalScore: null, questions: [objetiva] }), true);
  assert.equal(aguardaCorrecao({ finalScore: 12, questions: [objetiva] }), false);
  assert.equal(aguardaCorrecao({ finalScore: null, questions: [q({ isCorrect: false })] }), false, 'em branco não aguarda nada');
  assert.equal(aguardaCorrecao({ finalScore: null, questions: [] }), false);
});

test('a dissertativa por corrigir não conta como certa nem entra no total', () => {
  const certa = q({ questionId: 1, isCorrect: true, selectedOptionId: 1 });
  const errada = q({ questionId: 2, isCorrect: false, selectedOptionId: 2 });
  const aberta = q({ questionId: 3, answerText: 'texto', reviewStatus: 'PENDING_REVIEW' });
  assert.deepEqual(contagemDeCertas([certa, errada, aberta]), { certas: 1, corrigidas: 2, porCorrigir: 1 });
});

test('abertas sem nenhuma corrigida dizem «a aguardar», não «0/0»', () => {
  const b = calculateScoreBreakdown([q({ questionId: 1, options: [{ id: 1, optionText: 'a' }], maxScore: 5, scoreObtained: 5 }), q({ questionId: 2, maxScore: 10, scoreObtained: null })]);
  assert.equal(b.openMax, 0);
  assert.equal(b.openPendingMax, 10);
});
