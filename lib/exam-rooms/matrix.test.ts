// node --test lib/exam-rooms/matrix.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { CSV_TEMPLATE, draftFrom, emptyDraft, fold, keywordsOf, levelFrom, newRow, parseMatrixText, parseNumber, payloadOf, problemsOf, totalsOf, type MatrixDraft } from './matrix.ts';

/** A matriz da prova: o que o professor escreve ou importa tem de chegar ao servidor certo, ou dizer porque não. */

const draft = (rows: Parameters<typeof newRow>[0][], extra: Partial<MatrixDraft> = {}): MatrixDraft => ({ title: '', totalPoints: '20', rows: rows.map((r) => newRow(r)), ...extra });

test('a vírgula decimal conta, e o vazio nunca é zero', () => {
  assert.equal(parseNumber('4,5'), 4.5);
  assert.equal(parseNumber(' 7 '), 7);
  assert.ok(Number.isNaN(parseNumber('')));
  assert.ok(Number.isNaN(parseNumber('abc')));
});

test('temas e níveis comparam-se sem acentos nem maiúsculas', () => {
  assert.equal(fold('  Sub-Redes '), 'sub redes');
  assert.equal(fold('sub redes'), 'sub redes');
  assert.equal(levelFrom('Aplicação'), 'APPLICATION');
  assert.equal(levelFrom('analise'), 'ANALYSIS');
  assert.equal(levelFrom('knowledge'), 'KNOWLEDGE');
  assert.equal(levelFrom('xpto'), '');
});

test('uma matriz certa não tem problemas e vai para o servidor limpa', () => {
  const d = draft([{ topic: 'IP', count: '3', points: '12', level: 'APPLICATION' }, { topic: 'OSI', count: '2', points: '8' }, { topic: '', count: '', points: '' }], { title: ' Teste 2 ' });
  assert.deepEqual(problemsOf(d), []);
  assert.deepEqual(payloadOf(d), {
    title: 'Teste 2',
    totalPoints: 20,
    items: [{ topicName: 'IP', questionCount: 3, points: 12, cognitiveLevel: 'APPLICATION' }, { topicName: 'OSI', questionCount: 2, points: 8 }],
  });
});

test('a soma das cotações tem de bater com a escala, e o texto diz quanto', () => {
  const d = draft([{ topic: 'IP', count: '3', points: '12' }, { topic: 'OSI', count: '2', points: '6,5' }]);
  assert.deepEqual(problemsOf(d), ['As cotações somam 18,5 e a prova vale 20.']);
  assert.deepEqual(totalsOf(d), { questions: 5, points: 18.5, remaining: 1.5 });
});

test('ou todos os temas têm cotação ou nenhum', () => {
  assert.deepEqual(problemsOf(draft([{ topic: 'IP', count: '3', points: '20' }, { topic: 'OSI', count: '2' }])), ['Ou todos os temas têm cotação, ou nenhum.']);
  assert.deepEqual(problemsOf(draft([{ topic: 'IP', count: '3' }, { topic: 'OSI', count: '2' }])), []);
});

test('temas repetidos, sem tema, sem questões e sem linhas', () => {
  assert.deepEqual(problemsOf(draft([{ topic: 'Sub-redes', count: '2' }, { topic: 'sub redes', count: '1' }])), ['Linha 2: o tema «sub redes» já está na matriz.']);
  assert.deepEqual(problemsOf(draft([{ topic: '', count: '2' }])), ['Linha 1: falta o tema.']);
  assert.deepEqual(problemsOf(draft([{ topic: 'IP', count: '0' }])), ['Linha 1: indique quantas questões saem (um número inteiro, pelo menos 1).']);
  assert.deepEqual(problemsOf(emptyDraft()), ['Acrescente pelo menos um tema.']);
  assert.deepEqual(problemsOf(draft([{ topic: 'IP', count: '1' }], { totalPoints: '' })), ['Indique a escala da prova, por exemplo 20 valores.']);
});

test('o modelo de CSV que se descarrega é lido sem erros e soma 20 valores', () => {
  const { rows, errors } = parseMatrixText(CSV_TEMPLATE);
  assert.deepEqual(errors, []);
  assert.equal(rows.length, 4);
  assert.deepEqual(problemsOf({ title: '', totalPoints: '20', rows }), []);
  assert.equal(rows[2]!.level, 'KNOWLEDGE');
});

test('aceita tabulação (colado do Excel), vírgula, cabeçalho em maiúsculas e linhas vazias', () => {
  const tab = parseMatrixText('Tema\tQuestões\tCotação\nIP\t3\t6\n\nOSI\t2\t4,5\tconhecimento\n');
  assert.deepEqual(tab.errors, []);
  assert.deepEqual(tab.rows.map((r) => [r.topic, r.count, r.points, r.level]), [['IP', '3', '6', ''], ['OSI', '2', '4,5', 'KNOWLEDGE']]);
  const comma = parseMatrixText('IP,3,6,aplicação');
  assert.deepEqual(comma.rows.map((r) => [r.topic, r.count, r.points, r.level]), [['IP', '3', '6', 'APPLICATION']]);
});

test('os erros dizem a linha do ficheiro e o que está mal', () => {
  const { rows, errors } = parseMatrixText('tema;questões\nIP;três\n;2\nOSI;2;abc\nSub;1;;x\nBoa;4');
  assert.deepEqual(errors, [
    'Linha 2: «três» não é um número de questões.',
    'Linha 3: falta o tema.',
    'Linha 4: «abc» não é uma cotação.',
    'Linha 5: o nível «x» não existe (conhecimento, compreensão, aplicação ou análise).',
  ]);
  assert.deepEqual(rows.map((r) => r.topic), ['Boa']);
});

test('a matriz guardada volta ao editor com vírgula decimal', () => {
  const d = draftFrom({ roomId: 4, title: 'Matriz', totalPoints: 20, items: [{ id: 1, topicId: 9, topicName: 'IP', questionCount: 3, points: 4.5, cognitiveLevel: 'APPLICATION' }] });
  assert.equal(d.title, 'Matriz');
  assert.deepEqual(d.rows.map((r) => [r.topic, r.count, r.points, r.level]), [['IP', '3', '4,5', 'APPLICATION']]);
  assert.equal(draftFrom(null).rows.length, 2);
});

test('as palavras-chave vêm do CSV e seguem limpas para o servidor', () => {
  const { rows, errors } = parseMatrixText(CSV_TEMPLATE);
  assert.deepEqual(errors, []);
  assert.equal(rows[1]!.keywords, 'máscara, sub-rede, /24');
  const d = draft([{ topic: 'IP', count: '1', keywords: ' ipv4 ,, endereço ip ' }, { topic: 'OSI', count: '1' }]);
  assert.deepEqual(keywordsOf(d), [{ name: 'IP', keywords: 'ipv4, endereço ip' }]);
});
