// A proveniência OCR do enunciado criado no construtor (kixi#648):  node --test lib/exam/provenance.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ocrProvenance, termIdFrom } from './provenance.ts';

const ID = '5dbfe179-e74d-4aa6-a603-8b1e6a264cea';

test('com a leitura OCR o pedido leva o id e a confiança, só os campos válidos', () => {
  assert.deepEqual(ocrProvenance({ ocrRequestId: ID, ocrConfidence: 0.87 }), { ocrRequestId: ID, ocrConfidence: 0.87 });
  assert.deepEqual(ocrProvenance({ ocrRequestId: ID.toUpperCase() }), { ocrRequestId: ID }, 'o id vai em minúsculas');
  assert.deepEqual(ocrProvenance({ ocrRequestId: ID, ocrConfidence: 1 }), { ocrRequestId: ID, ocrConfidence: 1 });
  assert.deepEqual(ocrProvenance({ ocrRequestId: ID, ocrConfidence: 0 }), { ocrRequestId: ID, ocrConfidence: 0 }, 'zero é uma confiança, não ausência');
});

test('sem leitura OCR (prova feita à mão) o pedido não leva nada: continua `manual` no backend', () => {
  assert.deepEqual(ocrProvenance({}), {});
  assert.deepEqual(ocrProvenance(undefined), {});
  assert.deepEqual(ocrProvenance({ ocrRequestId: '' }), {});
});

test('um id que não é um UUID, ou uma confiança fora de 0 a 1, não se envia (o backend recusava o pedido todo)', () => {
  assert.deepEqual(ocrProvenance({ ocrRequestId: 'req-1', ocrConfidence: 0.5 }), { ocrConfidence: 0.5 });
  assert.deepEqual(ocrProvenance({ ocrRequestId: ID, ocrConfidence: 1.5 }), { ocrRequestId: ID });
  assert.deepEqual(ocrProvenance({ ocrRequestId: ID, ocrConfidence: -0.1 }), { ocrRequestId: ID });
  assert.deepEqual(ocrProvenance({ ocrRequestId: ID, ocrConfidence: Number.NaN }), { ocrRequestId: ID });
  assert.deepEqual(ocrProvenance({ ocrRequestId: ID, ocrConfidence: '0.9' as never }), { ocrRequestId: ID });
  assert.deepEqual(ocrProvenance({ ocrRequestId: `${ID}${'a'.repeat(100)}` }), {});
});

test('o trimestre escolhido vai no corpo como número; sem escolha fica de fora (o backend aceita nulo)', () => {
  assert.equal(termIdFrom('2'), 2);
  assert.equal(termIdFrom(3), 3);
  assert.equal(termIdFrom(''), null);
  assert.equal(termIdFrom(undefined), null);
  assert.equal(termIdFrom('abc'), null);
  assert.equal(termIdFrom('0'), null);
  assert.equal(termIdFrom('-1'), null);
  assert.equal(termIdFrom('1.5'), null);
});
