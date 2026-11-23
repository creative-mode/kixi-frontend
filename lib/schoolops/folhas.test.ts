// A digitalização das folhas (kixi-frontend#838):  node --test lib/schoolops/folhas.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  acrescentarFolhas,
  campoDeFicheiros,
  FOLHAS_MAX_BYTES,
  FOLHAS_MAX_FICHEIROS,
  FOLHAS_MAX_TOTAL_BYTES,
  problemaDasFolhas,
  referenciaDoDocumento,
  referenciasRecebidas,
  tipoPeloConteudo,
  variaveisDeConclusao,
} from './folhas.ts';

const MB = 1024 * 1024;
const f = (name: string, size = 1000, type = '') => ({ name, size, type });
const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0]);

// O corpo que `POST /v2/documents` devolveu na stack real (Camunda 8.10).
const RESPOSTA = {
  'camunda.document.type': 'camunda', storeId: 'in-memory', documentId: 'a2f5d405-bb52-4e5b-98b5-b95d24eb92c1',
  contentHash: 'c414cd0e204de974f73753c7e28d7638e7b3691bb8b1a2bab6b25bb7fed7ce77',
  metadata: { contentType: 'image/png', fileName: 'px.png', expiresAt: null, size: 70, processDefinitionId: null, processInstanceKey: null, customProperties: {} },
};

test('o formulário «Digitalizar as folhas» tem o campo de ficheiros folhasDigitalizadas; um form sem ficheiros não', () => {
  const form = { components: [{ type: 'text', text: '### Digitalizar' }, { type: 'filepicker', key: 'folhasDigitalizadas', multiple: true, accept: '.png,.jpg,.jpeg,.pdf', validate: { required: true } }] };
  assert.equal(campoDeFicheiros(form), 'folhasDigitalizadas');
  assert.equal(campoDeFicheiros({ components: [{ type: 'textfield', key: 'x' }] }), null);
  assert.equal(campoDeFicheiros({ components: [{ type: 'group', components: [{ type: 'filepicker', key: 'outro' }] }] }), 'outro');
});

test('o tipo vem do conteúdo (PNG, JPEG, PDF), não do nome nem do tipo declarado', () => {
  assert.equal(tipoPeloConteudo(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'image/png');
  assert.equal(tipoPeloConteudo(bytes(0xff, 0xd8, 0xff, 0xe0)), 'image/jpeg');
  assert.equal(tipoPeloConteudo(new TextEncoder().encode('%PDF-1.7\n...')), 'application/pdf');
  assert.equal(tipoPeloConteudo(new TextEncoder().encode('MZ executável')), null);
  assert.equal(tipoPeloConteudo(new TextEncoder().encode('<script>alert(1)</script>')), null);
  assert.equal(tipoPeloConteudo(new Uint8Array([])), null);
});

test('só PNG, JPG/JPEG e PDF, com o tamanho dentro do limite e não vazios', () => {
  assert.equal(problemaDasFolhas(f('folha-1.png')), null);
  assert.equal(problemaDasFolhas(f('FOLHA.JPG')), null);
  assert.equal(problemaDasFolhas(f('todas.pdf')), null);
  assert.match(problemaDasFolhas(f('folha.gif'))!, /«folha\.gif».*PNG, JPG ou PDF/);
  assert.match(problemaDasFolhas(f('folha.heic'))!, /PNG, JPG ou PDF/);
  assert.match(problemaDasFolhas(f('semextensao'))!, /PNG, JPG ou PDF/);
  assert.match(problemaDasFolhas(f('vazia.png', 0))!, /vazio/);
  assert.match(problemaDasFolhas(f('grande.pdf', FOLHAS_MAX_BYTES + 1))!, /«grande\.pdf» ultrapassa os 15 MB/);
  assert.equal(problemaDasFolhas(f('limite.pdf', FOLHAS_MAX_BYTES)), null);
});

test('acrescentar folhas diz porque ficou alguma de fora e não repete a mesma folha', () => {
  const { folhas, recusadas } = acrescentarFolhas([f('a.png', 10)], [f('a.png', 10), f('b.gif'), f('c.jpg', 20), f('d.pdf', 0)]);
  assert.deepEqual(folhas.map((x) => x.name), ['a.png', 'c.jpg']);
  assert.equal(recusadas.length, 3);
  assert.match(recusadas[0], /«a\.png» já está na lista/);
  assert.match(recusadas[1], /PNG, JPG ou PDF/);
  assert.match(recusadas[2], /vazio/);
});

test('há um máximo de ficheiros e um total em bytes', () => {
  const muitas = Array.from({ length: FOLHAS_MAX_FICHEIROS + 2 }, (_, i) => f(`f${i}.png`, 100));
  const r = acrescentarFolhas([], muitas);
  assert.equal(r.folhas.length, FOLHAS_MAX_FICHEIROS);
  assert.match(r.recusadas[0], new RegExp(`no máximo ${FOLHAS_MAX_FICHEIROS} ficheiros`));
  const grandes = Array.from({ length: 10 }, (_, i) => f(`g${i}.pdf`, 14 * MB));
  const t = acrescentarFolhas([], grandes);
  assert.ok(t.folhas.reduce((a, x) => a + x.size, 0) <= FOLHAS_MAX_TOTAL_BYTES);
  assert.match(t.recusadas[0], /passaria dos \d+ MB no total/);
});

test('o documento do Camunda vira a referência que o motor lê (documentId, storeId, contentHash)', () => {
  const ref = referenciaDoDocumento(RESPOSTA);
  assert.equal(ref['camunda.document.type'], 'camunda');
  assert.equal(ref.documentId, RESPOSTA.documentId);
  assert.equal(ref.storeId, 'in-memory');
  assert.equal(ref.contentHash, RESPOSTA.contentHash);
  assert.deepEqual(ref.metadata, { fileName: 'px.png', contentType: 'image/png', size: 70 });
});

test('uma resposta do Camunda sem documento, armazém ou hash não é aceite', () => {
  for (const mau of [null, 'x', {}, { ...RESPOSTA, documentId: undefined }, { ...RESPOSTA, storeId: '' }, { ...RESPOSTA, contentHash: undefined }]) {
    assert.throws(() => referenciaDoDocumento(mau), /documento/);
  }
});

test('concluir leva a lista folhasDigitalizadas sob o nome do campo do form', () => {
  const r = referenciaDoDocumento(RESPOSTA);
  assert.deepEqual(variaveisDeConclusao('folhasDigitalizadas', [r, r]), { folhasDigitalizadas: [r, r] });
});

test('as referências que chegam do browser são conferidas: forma, tamanho da lista, sem campos a mais', () => {
  const r = referenciaDoDocumento(RESPOSTA);
  assert.deepEqual(referenciasRecebidas([r]), { ok: true, referencias: [r] });
  // campos estranhos não passam para o Camunda
  const extra = referenciasRecebidas([{ ...r, intruso: 'x', metadata: { ...r.metadata, segredo: 1 } }]);
  assert.ok(extra.ok);
  assert.equal('intruso' in extra.referencias[0], false);
  assert.deepEqual(extra.referencias[0].metadata, r.metadata);
  for (const mau of [undefined, null, 'x', [], [{}], [{ ...r, documentId: '' }], [{ ...r, contentHash: 5 }], [r, null]]) {
    const x = referenciasRecebidas(mau);
    assert.equal(x.ok, false, JSON.stringify(mau));
  }
  const demais = referenciasRecebidas(Array.from({ length: FOLHAS_MAX_FICHEIROS + 1 }, () => r));
  assert.equal(demais.ok, false);
  assert.match((demais as { erro: string }).erro, /No máximo/);
  assert.match((referenciasRecebidas([]) as { erro: string }).erro, /pelo menos uma folha/);
});

test('o progresso conta as folhas já guardadas no Camunda e diz o que falta', async () => {
  const { progressoDoEnvio } = await import('./folhas.ts');
  assert.deepEqual(progressoDoEnvio([]), { enviadas: 0, total: 0, percentagem: 0, texto: 'Nenhuma folha escolhida.' });
  assert.deepEqual(progressoDoEnvio(['enviada', 'a-enviar', 'por-enviar']), { enviadas: 1, total: 3, percentagem: 33, texto: '1 de 3 folhas enviadas.' });
  assert.equal(progressoDoEnvio(['enviada']).texto, '1 de 1 folha enviada.');
  assert.equal(progressoDoEnvio(['enviada', 'enviada']).percentagem, 100);
  assert.equal(progressoDoEnvio(['enviada', 'erro']).texto, '1 de 2 folhas enviadas, 1 com erro.');
  assert.equal(progressoDoEnvio(['erro', 'erro']).texto, '0 de 2 folhas enviadas, 2 com erro.');
});
