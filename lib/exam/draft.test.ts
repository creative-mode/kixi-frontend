import assert from 'node:assert/strict';
import test from 'node:test';

import {
  convertItemKind,
  convertKind,
  distributeScore,
  emptyItem,
  groupScore,
  invalidateReviewOnContentChange,
  isChoice,
  itemLabel,
  kindOf,
  leavesOf,
  trueFalseAnswer,
  trueFalseOptions,
  labelAt,
  labelsFor,
  missingLabels,
  move,
  nextLabel,
  optionsFor,
  optionsReady,
  problems,
  round2,
  toRequest,
  totalScore,
  unscored,
  type DraftItem,
  type DraftOption,
  type DraftQuestion,
} from './draft.ts';

const open = (text: string, points: number | '' = 2): DraftQuestion => ({ text, points, options: [] });
const opt = (label: string, correct = false): DraftOption => ({ label, text: `texto ${label}`, correct });
const choice = (text: string, points: number | '' = 2, correct = 0): DraftQuestion => ({
  text,
  points,
  options: [
    { label: 'A', text: 'Certa', correct: correct === 0 },
    { label: 'B', text: 'Errada', correct: correct === 1 },
  ],
});

test('uma pergunta é de escolha múltipla exatamente quando tem opções', () => {
  // ManualStatementService deduz questionType de options.isEmpty(): não há outro caminho.
  assert.equal(isChoice(open('aberta')), false);
  assert.equal(isChoice(choice('fechada')), true);
});

test('os rótulos das opções seguem A, B, C e não se reciclam', () => {
  assert.deepEqual([0, 1, 2, 3].map(labelAt), ['A', 'B', 'C', 'D']);
  // O rótulo é a identidade única da opção dentro da pergunta: um rótigo deixado
  // livre continua tomado depois de a opção ser removida.
  assert.equal(labelAt(25), 'Z');
  assert.equal(labelAt(26), '27');
});

test('uma opção sem texto impede a pergunta de estar pronta', () => {
  const q = { text: 'q', points: 2, options: [{ label: 'A', text: 'ok', correct: true }, { label: 'B', text: '  ', correct: false }] };
  assert.equal(optionsReady(q), false);
  assert.equal(optionsReady(choice('q')), true);
});

test('o total ignora a pergunta sem cotação em vez de a contar como zero', () => {
  // É o que totalScore e calculateTotalMaxScore fazem: filtram os nulos. A diferença
  // entre "sem cotação" e "zero" é o total que o enunciado vai declarar.
  assert.equal(totalScore([open('a', 2), open('b', 3)]), 5);
  assert.equal(totalScore([open('a', 2), open('b', '')]), 2);
  assert.equal(totalScore([open('a', ''), open('b', '')]), 0);
  assert.equal(unscored([open('a', ''), open('b', 3)]), 1);
});

test('o total é arredondado a duas casas, como a comparação do backend', () => {
  // A soma volta do R2DBC em double; o servidor compara com BigDecimal a 2 casas.
  assert.equal(round2(0.1 + 0.2), 0.3);
  assert.equal(totalScore([open('a', 0.1), open('b', 0.2)]), 0.3);
  assert.equal(totalScore([open('a', 1.005)]), 1.01);
});

test('o pedido manda só as perguntas com texto, sem options em perguntas abertas', () => {
  const out = toRequest([open('primeira', 2), { text: '   ', points: 2, options: [] }, choice('terceira', 1)]);
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { text: 'primeira', type: 'open', maxScore: 2, options: [] });
  assert.deepEqual(out[1].options, [
    { label: 'A', text: 'Certa', correct: true },
    { label: 'B', text: 'Errada', correct: false },
  ]);
});

test('o gabarito viaja no próprio pedido de criação', () => {
  // É o que o BE-08 tornou possível: ManualStatementRequest.Option.correct é honrado
  // na criação, por isso marcar a resposta certa não custa um segundo pedido.
  const [envio] = toRequest([choice('q', 2, 1)]);
  assert.equal(envio.options.filter((o) => o.correct).length, 1);
  assert.equal(envio.options[1].correct, true);
  assert.equal(envio.options[0].correct, false);
});

test('a pergunta sem texto não conta para o número que o backend atribui', () => {
  // ManualStatementService.indexed numera as perguntas que chegam, por isso uma linha
  // vazia a meio não empurra as seguintes para baixo.
  const out = toRequest([open('a', 1), { text: '', points: 1, options: [] }, choice('c', 1)]);
  assert.deepEqual(out.map((q) => q.text), ['a', 'c']);
});

test('sem gabarito o enunciado não pode ser aprovado, e o problema nomeia a questão', () => {
  const semGabarito = choice('q1', 2, 1);
  semGabarito.options = semGabarito.options.map((o) => ({ ...o, correct: false }));
  const lista = problems([open('a', 2), semGabarito]);
  assert.equal(lista.length, 1);
  assert.match(lista[0], /questão 2/);
});

test('sem cotação o enunciado avisa antes de gravar', () => {
  assert.equal(problems([open('a', 2)]).length, 0);
  assert.match(problems([open('a', '')]).join(' '), /sem cotação/);
});

test('uma pergunta aberta sem gabarito não é um problema', () => {
  // answerKeyComplete só olha para perguntas que têm opções; uma aberta não tem
  // resposta certa a marcar e nunca chumbaria a aprovação.
  assert.deepEqual(problems([open('a', 2)]), []);
});

test('opções por escrever barrem a aprovação com um aviso próprio', () => {
  const q = { text: 'q', points: 2, options: [{ label: 'A', text: '', correct: false }] };
  assert.match(problems([q]).join(' '), /opções por escrever/);
});

test('um rascunho inteiro não reporta problemas quando está correcto', () => {
  assert.deepEqual(problems([open('a', 2), choice('b', 3), choice('c', 15)]), []);
  assert.equal(totalScore([open('a', 2), choice('b', 3), choice('c', 15)]), 20);
});

test('as opções são enviadas com o texto aparado e o rótulo intacto', () => {
  const q = { text: 'q', points: 1, options: [{ label: 'C', text: '  texto  ', correct: false }] };
  assert.deepEqual(optionsFor(q), [{ label: 'C', text: 'texto', correct: false }]);
});

test('optionsFor não inventa um rótulo que não existe', () => {
  // O fallback que aqui estava renumerava por índice: ["",""] saía ["A","B"], que é
  // a colisão que o `UNIQUE (question_id, option_label)` proíbe. Sem fallback, o
  // vazio sai vazio e quem tem de dizer isso é o `problems`, onde o professor lê.
  const semRotulos = { text: 'q', points: 1, options: [
    { label: '', text: 'a', correct: true },
    { label: '', text: 'b', correct: false },
  ] };
  assert.deepEqual(optionsFor(semRotulos).map((o) => o.label), ['', '']);
  assert.deepEqual(missingLabels(semRotulos), 2);
  assert.equal(missingLabels(choice('q')), 0);
});

test('uma opção sem rótulo é um problema antes de publicar', () => {
  const semRotulos = { text: 'q', points: 2, options: [{ label: '', text: 'a', correct: true }] };
  assert.match(problems([semRotulos]).join(' '), /sem rótulo/);
  // E some assim que o rótulo volta: o aviso é sobre o estado, não sobre a pergunta.
  assert.equal(problems([choice('q', 2)]).length, 0);
});
test('mover troca o item com a vizinha e não mexe no resto', () => {
  const lista = ['a', 'b', 'c', 'd'];
  assert.deepEqual(move(lista, 1, -1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(move(lista, 1, 1), ['a', 'c', 'b', 'd']);
  assert.deepEqual(move(lista, 0, 1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(move(lista, 3, -1), ['a', 'b', 'd', 'c']);
});

test('mover nas pontas não faz nada, e a lista original fica intacta', () => {
  const lista = ['a', 'b', 'c'];
  assert.deepEqual(move(lista, 0, -1), lista);
  assert.deepEqual(move(lista, 2, 1), lista);
  move(lista, 0, 1);
  assert.deepEqual(lista, ['a', 'b', 'c']);
});

test('mover uma lista curta não deita fora o resto', () => {
  // A versão que primeiro escrevi devolvia `a a _ c d` ao descer da primeira: um
  // `slice` a mais partia a lista em vez de trocar dois vizinhos.
  assert.deepEqual(move(['a', 'b', 'c', 'd'], 0, 1), ['b', 'a', 'c', 'd']);
  assert.deepEqual(move(['a', 'b', 'c', 'd'], 2, 1), ['a', 'b', 'd', 'c']);
});

// ── rótulos ───────────────────────────────────────────────────────────────────
// Um `UNIQUE (question_id, option_label)` no backend que não conhece as linhas
// removidas: uma etiqueta deixada livre continua tomada para sempre. Reciclar
// rótulos dá uma violação de integridade na base de dados, não um erro simpático.

test('o rótulo novo nunca é um rótulo já em uso', () => {
  // Com [A,B,C], apagar o B e adicionar não pode dar C: contar as opções dá
  // exactamente isso, e C está tomado.
  const semB = [{ label: 'A', text: 'a', correct: true }, { label: 'C', text: 'c', correct: false }];
  assert.equal(nextLabel(semB), 'D');
  assert.notEqual(nextLabel(semB), 'C');
});

test('o próximo rótulo é o maior em uso mais um, mesmo com lacunas', () => {
  assert.equal(nextLabel([]), 'A');
  assert.equal(nextLabel([opt('A')]), 'B');
  assert.equal(nextLabel([opt('A'), opt('D')]), 'E');
  // Com o C em falta, o próximo rótulo é o C: as lacunas não se reatribuem.
  assert.equal(nextLabel([opt('A'), opt('B')]), 'C');
});

test('o gabarito fica preso à opção que o carrega', () => {
  // A opção correcta é a que tem `correct`, não a que está numa posição. Reatribuir
  // rótulos não pode trocar a resposta de uma opção para outra.
  const opcoes = [
    { label: 'A', text: 'certa', correct: true },
    { label: 'B', text: 'errada', correct: false },
    { label: 'C', text: 'errada', correct: false },
  ];
  const enviadas = optionsFor({ text: 'q', points: 2, options: opcoes });
  assert.deepEqual(enviadas.map((o) => o.label), ['A', 'B', 'C']);
  assert.equal(enviadas.filter((o) => o.correct).length, 1);
  assert.equal(enviadas[0].correct, true);
});

test('apagar uma opção não renumera as que ficam', () => {
  // Este é o caso em que o remapeamento por índice mentia: [A,C] tem de sair [A,C].
  const restantes = { text: 'q', points: 2, options: [{ label: 'A', text: 'a', correct: false }, { label: 'C', text: 'c', correct: true }] };
  assert.deepEqual(optionsFor(restantes).map((o) => o.label), ['A', 'C']);
});

test('um rascunho antigo sem rótulos recebe rótulos que não colidem entre si', () => {
  // O `normalizeItem` é o outro sítio onde se atribui. Com um rascunho guardado de
  // antes das opções, os rótulos têm de sair distintos e pela ordem das letras.
  const normalizado = [{ label: '', text: 'a', correct: false }, { label: '', text: 'b', correct: false }, { label: '', text: 'c', correct: false }];
  assert.deepEqual(labelsFor(normalizado), ['A', 'B', 'C']);
});

test('normalizar só preenche os rótulos que faltam e não toca nos que existem', () => {
  const normalizado = [{ label: 'A', text: 'a', correct: false }, { label: '', text: 'b', correct: false }];
  // A já está taken; a lacuna não pode ser reatribuída a A.
  assert.deepEqual(labelsFor(normalizado), ['A', 'B']);
});


// ── tipos e alíneas ──────────────────────────────────────────────────────────

const vf = (text: string, points: number | '' = '', answer: 'V' | 'F' | null = null) => ({ ...emptyItem('true_false'), text, points, options: trueFalseOptions(answer) });
const aberta = (text: string, points: number | '' = '') => ({ ...emptyItem('open'), text, points });
const grupo = (text: string, items: ReturnType<typeof emptyItem>[]): DraftQuestion => ({ text, points: '', options: [], kind: 'group', items });

/** A prova de OGI: 1, 2 abertas; 3 verdadeiro/falso a–d; 4 aberta; 5 composta a–b; 6 aberta. */
const ogi = (): DraftQuestion[] => [
  open('Q1', ''),
  open('Q2', ''),
  grupo('Q3 verdadeiras ou falsas', [vf('a'), vf('b'), vf('c'), vf('d')]),
  open('Q4', ''),
  grupo('Q5 lote económico', [aberta('a'), aberta('b')]),
  open('Q6', ''),
];

test('o tipo deriva das opções e dos itens quando nunca foi escolhido', () => {
  assert.equal(kindOf(open('a')), 'open');
  assert.equal(kindOf(choice('a')), 'multiple_choice');
  assert.equal(kindOf(grupo('g', [aberta('a')])), 'group');
  assert.equal(kindOf({ ...choice('a'), kind: 'true_false' }), 'true_false');
});

test('verdadeiro/falso são duas opções e a resposta é a marcada', () => {
  assert.deepEqual(trueFalseOptions('F').map((o) => [o.label, o.text, o.correct]), [['A', 'Verdadeiro', false], ['B', 'Falso', true]]);
  assert.equal(trueFalseAnswer(trueFalseOptions('V')), 'V');
  assert.equal(trueFalseAnswer(trueFalseOptions('F')), 'F');
  assert.equal(trueFalseAnswer(trueFalseOptions()), null);
});

test('as alíneas levam rótulos a, b, c… e depois aa, ab', () => {
  assert.deepEqual([0, 1, 2, 25, 26, 27].map(itemLabel), ['a', 'b', 'c', 'z', 'aa', 'ab']);
});

test('mudar o tipo guarda o texto e a cotação e troca as opções', () => {
  const aV = convertKind({ ...open('texto', 3) }, 'true_false');
  assert.equal(aV.text, 'texto');
  assert.equal(aV.points, 3);
  assert.deepEqual(aV.options.map((o) => o.text), ['Verdadeiro', 'Falso']);
  const aMc = convertKind(open('texto', 3), 'multiple_choice');
  assert.equal(aMc.options.length, 2);
  assert.equal(convertKind(aMc, 'open').options.length, 0);
  assert.equal(convertKind(aMc, 'multiple_choice'), aMc);
});

test('passar a alíneas leva a cotação para a primeira alínea e voltar atrás larga as alíneas', () => {
  const g = convertKind(open('enunciado', 4), 'group');
  assert.equal(g.points, '');
  assert.equal(g.items?.length, 1);
  assert.equal(g.items?.[0].points, 4);
  const back = convertKind(g, 'open');
  assert.equal(back.items, undefined);
  assert.equal(back.text, 'enunciado');
});

test('uma alínea muda de tipo sem perder o texto', () => {
  const item = convertItemKind(aberta('afirmação', 2), 'true_false');
  assert.equal(item.kind, 'true_false');
  assert.equal(item.text, 'afirmação');
  assert.equal(item.options.length, 2);
});

test('mudar o tipo de uma alínea preserva evidência OCR e revisão matemática', () => {
  const formulas = [{ raw: 'v = v₀ + at', latex: 'v = v_0 + at', confidence: 0.72, kind: 'formula' }];
  const blocks = [{ type: 'formula' as const, ...formulas[0] }];
  const item = convertItemKind({
    ...emptyItem(), text: '$v = v_0 + at$', rawText: 'v = v₀ + at', confidence: 0.72,
    formulas, blocks, review: true, reviewed: false, modelAnswer: 'resposta modelo',
  }, 'true_false');

  assert.equal(item.rawText, 'v = v₀ + at');
  assert.equal(item.confidence, 0.72);
  assert.deepEqual(item.formulas, formulas);
  assert.deepEqual(item.blocks, blocks);
  assert.equal(item.review, true);
  assert.equal(item.reviewed, false);
  assert.equal(item.modelAnswer, 'resposta modelo');
});

test('editar conteúdo de questão ou alínea invalida a confirmação de revisão', () => {
  const formula = { raw: 'x2', latex: 'x^2', confidence: 0.62, kind: 'formula' };
  const reviewedQuestion: DraftQuestion = {
    text: 'Calcule $x^2$', points: 2, options: [], review: true, reviewed: true,
    formulas: [formula], blocks: [{ type: 'formula', ...formula }],
  };

  const textEdit = invalidateReviewOnContentChange(reviewedQuestion, {
    ...reviewedQuestion, text: 'Calcule $x^3$', blocks: undefined,
  });
  assert.equal(textEdit.reviewed, false);
  assert.match(problems([textEdit]).join(' '), /Reveja a confiança OCR/);
  assert.equal(toRequest([textEdit])[0].reviewed, undefined);

  const formulaEdit = invalidateReviewOnContentChange(reviewedQuestion, {
    ...reviewedQuestion, formulas: [{ ...formula, latex: 'x^3' }],
  });
  assert.equal(formulaEdit.reviewed, false);
  assert.match(problems([formulaEdit]).join(' '), /Reveja a confiança OCR/);

  const blockEdit = invalidateReviewOnContentChange(reviewedQuestion, {
    ...reviewedQuestion, blocks: [{ type: 'text', text: 'Calcule x ao cubo' }],
  });
  assert.equal(blockEdit.reviewed, false);
  assert.match(problems([blockEdit]).join(' '), /Reveja a confiança OCR/);

  const reviewedItem: DraftItem = { ...emptyItem(), text: 'Calcule $x^2$', review: true, reviewed: true,
    formulas: [formula], blocks: [{ type: 'formula' as const, ...formula }] };
  const editedItem = invalidateReviewOnContentChange(reviewedItem, {
    ...reviewedItem, text: 'Calcule $x^3$', blocks: undefined,
  });
  assert.equal(editedItem.reviewed, false);
  assert.match(problems([{ ...emptyItem(), kind: 'group', items: [editedItem], text: 'Resolva', points: '', options: [] }]).join(' '), /Reveja a confiança OCR/);
});

test('as folhas de uma prova com alíneas têm os rótulos impressos 3a, 3b…', () => {
  assert.deepEqual(leavesOf(ogi()).map((l) => l.label), ['1', '2', '3a', '3b', '3c', '3d', '4', '5a', '5b', '6']);
});

test('o total soma as alíneas e o grupo não conta cotação própria', () => {
  const q = ogi();
  assert.equal(totalScore(q), 0);
  const g = grupo('g', [aberta('a', 2), aberta('b', 3)]);
  assert.equal(totalScore([open('x', 5), g]), 10);
  assert.equal(groupScore(g), 5);
  assert.equal(unscored([open('x', 5), grupo('g', [aberta('a', 2), aberta('b', '')])]), 1);
});

test('verdadeiro/falso sem resposta marcada é um problema e nomeia a alínea', () => {
  const lista = problems([grupo('Q3', [vf('a', 2, 'V'), vf('b', 2), vf('c', 2)])]);
  assert.match(lista.join(' '), /Falta marcar Verdadeiro ou Falso na questão 1b, 1c/);
  assert.equal(problems([grupo('Q3', [vf('a', 2, 'V'), vf('b', 2, 'F')])]).length, 0);
});

test('escolha múltipla dentro de uma alínea exige resposta marcada', () => {
  const mc = { ...emptyItem('multiple_choice'), text: 'a', points: 2, options: [{ label: 'A', text: 'x', correct: false }, { label: 'B', text: 'y', correct: false }] };
  assert.match(problems([grupo('Q', [mc])]).join(' '), /resposta correcta na questão 1a/);
});

test('um grupo sem alíneas escritas ou com uma alínea vazia é um problema', () => {
  assert.match(problems([grupo('Q', [])]).join(' '), /tem alíneas mas nenhuma escrita/);
  assert.match(problems([grupo('Q', [aberta('a', 2), aberta('', 2)])]).join(' '), /alíneas por escrever: 1b/);
});

test('distribuir 20 valores reparte por igual e o resto vai para a última folha', () => {
  const out = distributeScore(ogi(), 20);
  const pts = leavesOf(out).map((l) => l.points);
  assert.deepEqual(pts, [2, 2, 2, 2, 2, 2, 2, 2, 2, 2]);
  assert.equal(totalScore(out), 20);
  // 7 folhas: 20/7 = 2,857 → 2,5 cada e o resto (2,5) na última
  const sete = [open('a'), open('b'), open('c'), open('d'), open('e'), open('f'), open('g')].map((q) => ({ ...q, points: '' as const }));
  const rep = leavesOf(distributeScore(sete, 20)).map((l) => l.points);
  assert.deepEqual(rep, [2.5, 2.5, 2.5, 2.5, 2.5, 2.5, 5]);
  assert.equal(totalScore(distributeScore(sete, 20)), 20);
});

test('distribuir nunca altera uma cotação já preenchida', () => {
  const q = [open('a', 8), open('b', ''), open('c', ''), grupo('g', [aberta('x', 1), aberta('y', '')])];
  const out = distributeScore(q, 20);
  const pts = leavesOf(out).map((l) => l.points);
  assert.equal(pts[0], 8);
  assert.equal(pts[3], 1);
  assert.equal(totalScore(out), 20);
});

test('distribuir sem espaço ou sem folhas por pontuar devolve a prova como está', () => {
  const cheia = [open('a', 20), open('b', '')];
  assert.equal(distributeScore(cheia, 20), cheia);
  const completa = [open('a', 10), open('b', 10)];
  assert.equal(distributeScore(completa, 20), completa);
});

test('o pedido leva o tipo, os itens do grupo e as opções de verdadeiro/falso', () => {
  const [simples, g] = toRequest([open('Q1', 2), grupo('Q3', [vf('a', 1, 'V'), vf('b', 1, 'F')])]);
  assert.equal(simples.type, 'open');
  assert.equal(g.type, 'group');
  assert.equal(g.maxScore, null);
  assert.deepEqual(g.options, []);
  assert.deepEqual(g.items?.map((i) => [i.label, i.type, i.maxScore]), [['a', 'true_false', 1], ['b', 'true_false', 1]]);
  assert.deepEqual(g.items?.[1].options, [
    { label: 'A', text: 'Verdadeiro', correct: false },
    { label: 'B', text: 'Falso', correct: true },
  ]);
});

test('o pedido preserva evidência OCR e a confiança pendente bloqueia publicação', () => {
  const formula = { raw: 'v0', latex: 'v_0', confidence: 0.62, kind: 'formula' };
  const question = {
    text: 'Determine v0', points: 2, kind: 'open' as const, options: [],
    rawText: 'Determine v0', confidence: 0.71, formulas: [formula],
    blocks: [
      { type: 'text' as const, text: 'Determine ' },
      { type: 'formula' as const, ...formula },
    ],
    review: true,
  };
  assert.match(problems([question]).join(' '), /Reveja a confiança OCR antes de publicar: 1/);
  const pending = toRequest([question])[0];
  assert.equal(pending.text, 'Determine $v_0$');
  assert.equal(pending.rawText, 'Determine v0');
  assert.equal(pending.confidence, 0.71);
  assert.equal(pending.reviewed, undefined);
  assert.deepEqual(pending.formulas, [formula]);
  assert.equal('blocks' in pending, false);
  assert.equal('needsReview' in pending, false);

  const reviewed = { ...question, review: false, reviewed: true };
  assert.doesNotMatch(problems([reviewed]).join(' '), /confiança OCR/);
  assert.equal(toRequest([reviewed])[0].reviewed, true);
});

test('o pedido de grupo preserva evidência do enunciado e de cada alínea no contrato manual', () => {
  const formula = { raw: 'x2', latex: 'x^2', confidence: 0.91, kind: 'formula' };
  const [request] = toRequest([{
    text: 'Resolva x2', points: '', kind: 'group', options: [],
    rawText: 'Resolva x2', confidence: 0.96,
    blocks: [{ type: 'text', text: 'Resolva ' }, { type: 'formula', ...formula }],
    items: [{
      text: 'Calcule x2', points: 2, kind: 'open', options: [],
      rawText: 'Calcule x2', confidence: 0.62, review: true,
      blocks: [{ type: 'text', text: 'Calcule ' }, { type: 'formula', ...formula }],
    }],
  }]);

  assert.equal(request.text, 'Resolva $x^2$');
  assert.equal(request.rawText, 'Resolva x2');
  assert.equal(request.confidence, 0.96);
  assert.deepEqual(request.formulas, [formula]);
  assert.deepEqual(request.items?.[0], {
    label: 'a', text: 'Calcule $x^2$', type: 'open', maxScore: 2, options: [],
    rawText: 'Calcule x2', confidence: 0.62, formulas: [formula],
  });
  assert.equal(request.items?.[0].reviewed, undefined);
  assert.equal('blocks' in (request.items?.[0] ?? {}), false);
});

test('uma alínea aberta vai sem opções e as vazias não vão', () => {
  const [g] = toRequest([grupo('Q5', [aberta('a', 2), aberta('   ', 2), aberta('b', 3)])]);
  assert.deepEqual(g.items?.map((i) => [i.label, i.text, i.options.length]), [['a', 'a', 0], ['b', 'b', 0]]);
});

test('a prova de OGI completa e pontuada não tem problemas', () => {
  const pronta = distributeScore(ogi(), 20).map((q) => (kindOf(q) === 'group' ? { ...q, items: (q.items ?? []).map((i) => (kindOf(i) === 'true_false' ? { ...i, options: trueFalseOptions('V') } : i)) } : q));
  assert.deepEqual(problems(pronta), []);
  assert.equal(totalScore(pronta), 20);
});
