import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CatalogItem } from './catalog.ts';
import { estadoDaProva } from './provas-temas-rules.ts';

const item = (extra: Partial<CatalogItem> = {}): CatalogItem => ({
  id: '1', kind: 'Teste', title: 'Redes', subject: 'Redes', school: 'Escola', year: '2025–2026',
  state: 'done', ...extra,
});

test('a percentagem é sobre a cotação da prova, não sobre 20', () => {
  // 17,75 de 25 = 71%: «A aprender», nunca «Dominado» (17,75/20 daria 89%) (#820).
  const estados = estadoDaProva(item({ score: '17,75', maxScore: 25 }));
  assert.equal(estados.pct, 71);
  assert.equal(estados.estado, 'apr');
  assert.equal(estados.label, 'A aprender');
  // A mesma nota numa prova de 20 é 89%.
  assert.equal(estadoDaProva(item({ score: '17,75', maxScore: 20 })).pct, 89);
});

test('sem cotação conhecida cai no 20, o denominador antigo', () => {
  assert.equal(estadoDaProva(item({ score: '10' })).pct, 50);
  assert.equal(estadoDaProva(item({ score: '10', maxScore: 0 })).pct, 50);
});

test('entregue sem número (nota do motor) diz «Corrigida» e não inventa percentagem', () => {
  const estado = estadoDaProva(item({ score: undefined, correction: 'Corrigida' }));
  assert.equal(estado.pct, null);
  assert.equal(estado.label, 'Corrigida');
  assert.equal(estado.estado, 'apr');
});

test('por corrigir, em curso e por treinar têm estados próprios', () => {
  assert.equal(estadoDaProva(item({ score: undefined, correction: 'A corrigir' })).label, 'A corrigir');
  assert.equal(estadoDaProva(item({ state: 'progress', score: undefined })).label, 'Em curso');
  assert.equal(estadoDaProva(item({ state: 'new', score: undefined })).label, 'Ainda não treinaste');
});
