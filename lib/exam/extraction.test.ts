import assert from 'node:assert/strict';
import test from 'node:test';

import { OGI_EXTRACTION } from '../mock/ogi-extraction.ts';
import { distributeScore, kindOf, leavesOf, problems, sourceItemLabel, toRequest, totalScore, trueFalseAnswer } from './draft.ts';
import { draftFromExtraction, matchSubject, type ExamExtraction } from './extraction.ts';

const SUBJECTS = ['Matemática', 'Organização e Gestão Industrial', 'Física'];

test('a prova de OGI vira seis questões com os tipos certos', () => {
  const { items } = draftFromExtraction(OGI_EXTRACTION, { subjects: SUBJECTS });
  assert.equal(items.length, 6);
  assert.deepEqual(items.map((q) => kindOf(q)), ['open', 'open', 'group', 'open', 'group', 'open']);
  assert.deepEqual(items.map((q) => q.items?.length ?? 0), [0, 0, 4, 0, 2, 0]);
});

test('a importação preserva os rótulos impressos das alíneas no editor, na folha e no pedido', () => {
  const { items } = draftFromExtraction({
    questions: [{
      number: '2', type: 'composta', text: 'Calcule:', confidence: 0.95,
      subitems_content: [
        { label: 'c)', text: 'Primeira alínea', type: 'dissertativa' },
        { label: 'd', text: 'Segunda alínea', type: 'dissertativa' },
      ],
    }],
  }, { subjects: [] });
  const group = items[0];
  assert.equal(sourceItemLabel(group.items![0], 0), 'c');
  assert.equal(sourceItemLabel(group.items![1], 1), 'd');
  assert.deepEqual(toRequest(items)[0].items?.map((item) => item.label), ['c', 'd']);
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

test('NATIVE_TEXT_GAP global marca para revisão mesmo com confiança alta e sem fórmula estruturada', () => {
  const out = draftFromExtraction({
    questions: [{ number: '1', type: 'dissertativa', text: 'Determine a velocidade.', confidence: 0.99 }],
    warnings: [{ code: 'NATIVE_TEXT_GAP', field: 'formulas', confidence: 0, message: 'Podem faltar símbolos matemáticos.' }],
  }, { subjects: [] });

  assert.equal(out.items[0].review, true);
  assert.equal(out.reviewCount, 1);
  assert.match(problems(out.items).join(' '), /confiança OCR/);
});

test('avisos de fórmula por questão marcam apenas a questão identificada', () => {
  const out = draftFromExtraction({
    questions: [
      { number: '1', type: 'dissertativa', text: 'Determine x.', confidence: 0.99 },
      { number: '2', type: 'dissertativa', text: 'Determine y.', confidence: 0.99 },
    ],
    warnings: [{ code: 'LOW_CONFIDENCE_FORMULA', field: 'question_2_formula_1', confidence: 0.4 }],
  }, { subjects: [] });

  assert.equal(out.items[0].review, undefined);
  assert.equal(out.items[1].review, true);
  assert.equal(out.reviewCount, 1);
});

test('needs_review global força revisão, mas NO_COTACAO continua apenas como cotação', () => {
  const questions = [
    { number: '1', type: 'dissertativa', text: 'Questão 1', confidence: 0.99 },
    { number: '2', type: 'dissertativa', text: 'Questão 2', confidence: 0.99 },
  ];
  const flagged = draftFromExtraction({ needs_review: true, questions }, { subjects: [] });
  assert.ok(flagged.items.every((question) => question.review === true));
  assert.equal(flagged.reviewCount, 2);
  assert.match(problems(flagged.items).join(' '), /confiança OCR/);

  const unscored = draftFromExtraction({ needs_review: true, questions, warnings: [{ code: 'NO_COTACAO', field: 'questions', confidence: 1 }] }, { subjects: [] });
  assert.ok(unscored.items.every((question) => question.review !== true));
  assert.equal(unscored.reviewCount, 0);
  assert.match(unscored.notes.join(' '), /não traz cotação/);
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
  const { items, notes, footerPreview } = draftFromExtraction(withFigures, { subjects: SUBJECTS });
  assert.deepEqual(items.map((q) => q.images?.length ?? 0), [0, 1, 2]);
  assert.deepEqual(items[2].images?.map((i) => i.kind), ['figure', 'table']);
  assert.equal(items[1].images?.[0].caption, 'Figura da questão 2');
  assert.ok(notes.some((n) => /3 figura/.test(n)));
  assert.equal(footerPreview?.dataUrl, PNG);
  assert.deepEqual(footerPreview?.text, []);
});

test('conteúdo do rodapé mantém zona e texto fora das questões', () => {
  const imported = draftFromExtraction({
    questions: [{ number: '1', text: 'Calcule o fluxo.', type: 'dissertativa' }],
    images_to_upload: [{ region: 'rodape', data_url: PNG }],
    unmapped_content: [
      { pageIndex: 0, text: 'A coordenação', zone: 'rodape', bbox: [0, 100, 500, 140] },
      { pageIndex: 0, text: 'secretaria@example.ao', zone: 'rodape', bbox: [0, 150, 500, 180] },
    ],
  }, { subjects: SUBJECTS });

  assert.equal(imported.items.length, 1);
  assert.equal(imported.items[0].text, 'Calcule o fluxo.');
  assert.equal(imported.footerPreview?.pageIndex, 0);
  assert.deepEqual(imported.footerPreview?.text, ['A coordenação', 'secretaria@example.ao']);
  assert.match(imported.notes.join(' '), /Rodapé separado das questões/);
});

test('só os recortes que existem entram, e só se forem imagens', () => {
  const { items } = draftFromExtraction({ ...withFigures, images_to_upload: [{ region: 'questao_1', data_url: 'javascript:alert(1)' }, { region: 'questao_1', data_url: '' }] }, { subjects: SUBJECTS });
  assert.equal(items[0].images, undefined);
});

test('fórmulas, blocos, confiança e texto OCR original sobrevivem à conversão e ao contrato de texto da API', () => {
  const { items, reviewCount } = draftFromExtraction({ questions: [
    {
      number: '1', type: 'dissertativa', text: 'Determine $B_{max}e^{-2t}$', rawText: 'Determine Bmaxe-2t', confidence: 0.96,
      formulas: [{ raw: 'Bmaxe-2t', latex: 'B_{\\max}e^{-2t}', confidence: 0.94, kind: 'formula' }],
      blocks: [{ type: 'text', text: 'Determine ' }, { type: 'formula', raw: 'Bmaxe-2t', latex: 'B_{\\max}e^{-2t}', confidence: 0.94, kind: 'formula' }],
    },
    {
      number: '2', type: 'composta', text: 'Resolva', rawText: 'Resolva', confidence: 0.97,
      subitems_content: [{ label: 'a', text: 'Calcule $5\\times 10^{-3}T$', rawText: 'a) Calcule 5x10-3T', confidence: 0.7,
        formulas: [{ raw: '5x10-3T', latex: '5\\times 10^{-3}T', confidence: 0.7, kind: 'formula' }] }],
    },
  ] }, { subjects: [] });

  assert.equal(items[0].rawText, 'Determine Bmaxe-2t');
  assert.equal(items[0].confidence, 0.96);
  assert.equal(items[0].formulas?.[0].raw, 'Bmaxe-2t');
  assert.equal(items[0].blocks?.[1].type, 'formula');
  assert.equal(items[0].review, undefined);
  assert.equal(items[1].items?.[0].rawText, 'a) Calcule 5x10-3T');
  assert.equal(items[1].items?.[0].confidence, 0.7);
  assert.equal(items[1].items?.[0].review, true);
  assert.equal(reviewCount, 1);

  const request = toRequest(items);
  assert.match(request[0].text, /\$B_\{\\max\}e\^{-2t}\$/);
  assert.match(request[1].items?.[0].text ?? '', /\$5\\times 10\^{-3\}T\$/);
});

test('fórmula não reconhecida e confiança matemática baixa obrigam a revisão', () => {
  const out = draftFromExtraction({ questions: [{ number: '1', type: 'dissertativa', text: 'Vetor 7=1-tex', confidence: 0.99,
    formulas: [{ raw: '7=1-tex', latex: null, confidence: 0.99, kind: 'unrecognized' }] }] }, { subjects: [] });
  assert.equal(out.items[0].review, true);
  assert.equal(out.reviewCount, 1);
  assert.equal(toRequest(out.items)[0].text, 'Vetor 7=1-tex');
});

test('figuresOf dá a cada figura o número da questão na ordem em que vai ao servidor', async () => {
  const { figuresOf, withoutImages } = await import('./draft.ts');
  const { items } = draftFromExtraction(withFigures, { subjects: SUBJECTS });
  // uma questão vazia no meio não conta: o servidor só recebe as que têm texto
  const edited = [items[0], { ...items[0], text: '', images: undefined }, items[1], items[2]];
  assert.deepEqual(figuresOf(edited).map((f) => f.number), [2, 3, 3]);
  assert.ok(withoutImages({ items }).items.every((q) => q.images === undefined));
});
