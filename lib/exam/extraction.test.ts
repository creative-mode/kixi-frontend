import assert from 'node:assert/strict';
import test from 'node:test';

import { OGI_EXTRACTION } from '../mock/ogi-extraction.ts';
import { distributeScore, kindOf, leavesOf, problems, toRequest, totalScore, trueFalseAnswer } from './draft.ts';
import { draftFromExtraction, matchSubject, type ExamExtraction } from './extraction.ts';

const SUBJECTS = ['Matemática', 'Organização e Gestão Industrial', 'Física'];

test('a prova de OGI vira seis questões com os tipos certos', () => {
  const { items } = draftFromExtraction(OGI_EXTRACTION, { subjects: SUBJECTS });
  assert.equal(items.length, 6);
  assert.deepEqual(items.map((q) => kindOf(q)), ['open', 'open', 'group', 'open', 'group', 'open']);
  assert.deepEqual(items.map((q) => q.items?.length ?? 0), [0, 0, 4, 0, 2, 0]);
});

test('o verdadeiro/falso da Q3 fica com quatro alíneas, duas opções cada e nenhuma resposta marcada', () => {
  const q3 = draftFromExtraction(OGI_EXTRACTION, { subjects: SUBJECTS }).items[2];
  assert.match(q3.text, /verdadeiras/);
  assert.deepEqual(q3.items?.map((i) => i.kind), ['true_false', 'true_false', 'true_false', 'true_false']);
  assert.ok(q3.items?.every((i) => i.options.length === 2 && trueFalseAnswer(i.options) === null));
  // o texto das afirmações já vem sem o "( )" do papel
  assert.ok(q3.items?.every((i) => !/\(\s*\)/.test(i.text)));
});

test('a Q5 composta fica com o enunciado comum e as alíneas abertas', () => {
  const q5 = draftFromExtraction(OGI_EXTRACTION, { subjects: SUBJECTS }).items[4];
  assert.match(q5.text, /Lote Económico/);
  assert.doesNotMatch(q5.text, /Demonstre/);
  assert.deepEqual(q5.items?.map((i) => [i.kind, i.options.length]), [['open', 0], ['open', 0]]);
});

test('o cabeçalho: título, duração, classe, série, ano e tipo', () => {
  const { patch } = draftFromExtraction(OGI_EXTRACTION, { subjects: SUBJECTS });
  assert.equal(patch.title, 'Prova de Exame de OGI – 12ª Classe – Série B – 2024/2025');
  assert.equal(patch.duration, 90);
  assert.equal(patch.grade, '12ª Classe');
  assert.equal(patch.variant, 'B');
  assert.equal(patch.schoolYear, '2024/2025');
  assert.equal(patch.kind, 'Exame');
  assert.deepEqual(patch.rules, ['Leia a prova com atenção, coloque na folha de prova a variante correspondente e responda de uma forma clara.']);
});

test('a sigla OGI encontra a disciplina da escola; sem ela, avisa e deixa a disciplina por escolher', () => {
  const com = draftFromExtraction(OGI_EXTRACTION, { subjects: SUBJECTS });
  assert.equal(com.patch.subject, 'Organização e Gestão Industrial');
  const sem = draftFromExtraction(OGI_EXTRACTION, { subjects: ['Matemática', 'Física'] });
  assert.equal(sem.patch.subject, '');   // limpa a que o rascunho tinha: não é a desta prova
  assert.match(sem.notes.join(' '), /disciplina «OGI» não existe nesta escola/);
});

test('sem cotação no papel as cotações ficam vazias e há uma nota a explicar como distribuir', () => {
  const { items, notes } = draftFromExtraction(OGI_EXTRACTION, { subjects: SUBJECTS });
  assert.equal(totalScore(items), 0);
  assert.match(notes.join(' '), /Distribuir 20 valores/);
  assert.match(notes.join(' '), /Marque Verdadeiro ou Falso/);
});

test('a prova de OGI importada, distribuída e com o gabarito marcado, pode ser publicada', () => {
  const { items } = draftFromExtraction(OGI_EXTRACTION, { subjects: SUBJECTS });
  const dist = distributeScore(items, 20);
  assert.equal(totalScore(dist), 20);
  assert.match(problems(dist).join(' '), /Falta marcar Verdadeiro ou Falso na questão 3a, 3b, 3c, 3d/);
  const marcadas = dist.map((q) => (q.kind === 'group' ? { ...q, items: q.items?.map((i) => (i.kind === 'true_false' ? { ...i, options: i.options.map((o, n) => ({ ...o, correct: n === 0 })) } : i)) } : q));
  assert.deepEqual(problems(marcadas), []);
  const req = toRequest(marcadas);
  assert.equal(req.length, 6);
  assert.deepEqual(leavesOf(marcadas).map((l) => l.label), ['1', '2', '3a', '3b', '3c', '3d', '4', '5a', '5b', '6']);
});

test('uma questão de escolha múltipla traz as opções do OCR e nenhuma resposta marcada', () => {
  const ex: ExamExtraction = { questions: [{ number: '1', type: 'multipla_escolha', text: 'Quanto é 2+2?', cotacao: 2, confidence: 0.95,
    options: [{ option_label: 'a', option_text: '3' }, { option_label: 'B', option_text: '4' }, { option_label: 'B', option_text: '5' }, { option_label: 'D', option_text: '  ' }] }] };
  const [q] = draftFromExtraction(ex, { subjects: [] }).items;
  assert.equal(kindOf(q), 'multiple_choice');
  assert.equal(q.points, 2);
  assert.deepEqual(q.options.map((o) => o.label), ['A', 'B', 'C']);   // rótulo repetido recebe o próximo livre; opção vazia sai
  assert.ok(q.options.every((o) => !o.correct));
});

test('escolha múltipla sem opções legíveis cai para aberta, e verdadeiro/falso sem alíneas é uma folha V/F', () => {
  const ex: ExamExtraction = { questions: [
    { type: 'multipla_escolha', text: 'Sem opções', options: [], confidence: 0.9 },
    { type: 'verdadeiro_falso', text: 'A água ferve a 100 graus ( )', confidence: 0.9 },
  ] };
  const [a, b] = draftFromExtraction(ex, { subjects: [] }).items;
  assert.equal(kindOf(a), 'open');
  assert.equal(kindOf(b), 'true_false');
  assert.equal(b.text, 'A água ferve a 100 graus');
});

test('confiança baixa marca a questão e as alíneas para rever, e conta-as', () => {
  const ex: ExamExtraction = { questions: [
    { type: 'dissertativa', text: 'Pouco legível', confidence: 0.5 },
    { type: 'composta', text: 'Enunciado', confidence: 0.6, subitems_content: [{ label: 'a', text: 'x', type: 'dissertativa' }, { label: 'b', text: 'y', type: 'dissertativa' }] },
    { type: 'dissertativa', text: 'Legível', confidence: 0.99 },
  ] };
  const out = draftFromExtraction(ex, { subjects: [] });
  assert.equal(out.items[0].review, true);
  assert.equal(out.items[1].items?.every((i) => i.review), true);
  assert.equal(out.items[2].review, undefined);
  assert.equal(out.reviewCount, 3);
  assert.match(out.notes.join(' '), /3 questão\(ões\) ficaram marcadas «rever»/);
});

test('cotação lida no papel é aproveitada e não gera a nota de cotação em falta', () => {
  const ex: ExamExtraction = { questions: [{ type: 'dissertativa', text: 'q1', cotacao: 4, confidence: 0.9 }, { type: 'dissertativa', text: 'q2', cotacao: 6, confidence: 0.9 }] };
  const out = draftFromExtraction(ex, { subjects: [] });
  assert.equal(totalScore(out.items), 10);
  assert.doesNotMatch(out.notes.join(' '), /não traz cotação/);
});

test('sem questões legíveis diz-se isso, e nada do cabeçalho vazio apaga o rascunho', () => {
  const out = draftFromExtraction({ questions: [], title: '  ' }, { subjects: [] });
  assert.equal(out.items.length, 0);
  assert.match(out.notes.join(' '), /Não foi possível ler questões/);
  assert.deepEqual(out.patch, {});
});

test('avisos de baixa confiança em campos do cabeçalho viram notas legíveis', () => {
  const out = draftFromExtraction({ questions: [{ type: 'dissertativa', text: 'q', confidence: 0.9 }], warnings: [{ code: 'LOW_CONFIDENCE', field: 'durationMinutes', confidence: 0.4 }] }, { subjects: [] });
  assert.match(out.notes.join(' '), /inseguro com a duração/);
});

test('matchSubject: igual sem acentos, sigla nos dois sentidos, e nada quando não há', () => {
  assert.equal(matchSubject('matematica', SUBJECTS), 'Matemática');
  assert.equal(matchSubject('OGI', SUBJECTS), 'Organização e Gestão Industrial');
  assert.equal(matchSubject('Organização e Gestão Industrial', ['OGI']), 'OGI');
  assert.equal(matchSubject('Química', SUBJECTS), null);
  assert.equal(matchSubject('', SUBJECTS), null);
  assert.equal(matchSubject(null, SUBJECTS), null);
});

const PNG = 'data:image/png;base64,iVBORw0KGgo=';
const withFigures: ExamExtraction = {
  subject_name: 'Física',
  questions: [
    { number: '1', text: 'Sobre a teoria dos semicondutores, responda.', type: 'dissertativa', confidence: 0.95 },
    { number: '2', text: 'Encontre as correntes representadas no circuito da figura abaixo.', type: 'dissertativa', confidence: 0.95 },
    { number: '3', text: 'Determine o circuito abaixo.', type: 'dissertativa', confidence: 0.95 },
  ],
  images_to_upload: [
    { region: 'cabecalho', description: 'Cabeçalho', data_url: null },
    { region: 'questao_2', kind: 'figure', description: 'Figura da questão 2', data_url: PNG },
    { region: 'questao_3', kind: 'figure', description: 'Figura da questão 3', data_url: PNG },
    { region: 'questao_3', kind: 'table', description: 'Tabela da questão 3', data_url: PNG },
    { region: 'questao_3', kind: 'figure', description: 'Sem recorte', data_url: null },
    { region: 'rodape', description: 'Assinatura', data_url: PNG },
  ],
};

test('cada figura fica na questão a que o OCR a ligou, e o cabeçalho e a assinatura ficam de fora', () => {
  const { items, notes } = draftFromExtraction(withFigures, { subjects: SUBJECTS });
  assert.deepEqual(items.map((q) => q.images?.length ?? 0), [0, 1, 2]);
  assert.deepEqual(items[2].images?.map((i) => i.kind), ['figure', 'table']);
  assert.equal(items[1].images?.[0].caption, 'Figura da questão 2');
  assert.ok(notes.some((n) => /3 figura/.test(n)));
});

test('só os recortes que existem entram, e só se forem imagens', () => {
  const { items } = draftFromExtraction({ ...withFigures, images_to_upload: [{ region: 'questao_1', data_url: 'javascript:alert(1)' }, { region: 'questao_1', data_url: '' }] }, { subjects: SUBJECTS });
  assert.equal(items[0].images, undefined);
});

test('figuresOf dá a cada figura o número da questão na ordem em que vai ao servidor', async () => {
  const { figuresOf, withoutImages } = await import('./draft.ts');
  const { items } = draftFromExtraction(withFigures, { subjects: SUBJECTS });
  // uma questão vazia no meio não conta: o servidor só recebe as que têm texto
  const edited = [items[0], { ...items[0], text: '', images: undefined }, items[1], items[2]];
  assert.deepEqual(figuresOf(edited).map((f) => f.number), [2, 3, 3]);
  assert.ok(withoutImages({ items }).items.every((q) => q.images === undefined));
});
