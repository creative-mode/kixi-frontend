// node --test student/lib/correcao-previsao.test.ts
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { abertasDaProva, previsaoEmTexto, previsaoPorAbertas, progressoEmTexto, situacaoDaEspera } from './correcao-previsao.ts';

test('as abertas da prova são as questões sem opções, fora o enunciado de um grupo', () => {
  assert.equal(
    abertasDaProva([
      { questionType: 'multiple_choice', options: [{ id: 1 }] },
      { questionType: 'short_answer', options: [] },
      { questionType: 'essay' },
      { questionType: 'group', options: [] },
    ]),
    2,
  );
  assert.equal(abertasDaProva(undefined), 0);
});

test('sem o motor estima-se por rondas de cinco, e sem abertas não há estimativa', () => {
  assert.equal(previsaoPorAbertas(0), null);
  assert.equal(previsaoPorAbertas(1), 20);
  assert.equal(previsaoPorAbertas(5), 20);
  assert.equal(previsaoPorAbertas(6), 40);
});

test('com o motor, o progresso e a previsão são os dele', () => {
  const s = situacaoDaEspera({ progresso: { corrigidas: 2, total: 5 }, previsaoSegundos: 63, abertas: 5, decorridoMs: 90_000 });
  assert.deepEqual(s, { corrigidas: 2, total: 5, percentagem: 40, previsaoSegundos: 63, origem: 'motor' });
});

test('o motor com progresso mas sem previsão: estima-se só o que falta, sem descontar o tempo', () => {
  const s = situacaoDaEspera({ progresso: { corrigidas: 5, total: 12 }, previsaoSegundos: null, abertas: 12, decorridoMs: 30_000 });
  assert.equal(s?.origem, 'estimada');
  assert.equal(s?.previsaoSegundos, 40); // faltam 7: duas rondas
});

test('sem nada do motor: 0 de N e a estimativa pelas abertas da prova, que encolhe com o tempo', () => {
  assert.deepEqual(situacaoDaEspera({ abertas: 5, decorridoMs: 0 }), { corrigidas: 0, total: 5, percentagem: 0, previsaoSegundos: 20, origem: 'estimada' });
  assert.equal(situacaoDaEspera({ abertas: 5, decorridoMs: 12_000 })?.previsaoSegundos, 8);
  assert.equal(situacaoDaEspera({ abertas: 5, decorridoMs: 5 * 60_000 })?.previsaoSegundos, 0); // nunca negativa
});

test('sem abertas nem total não há nada a mostrar', () => {
  assert.equal(situacaoDaEspera({ abertas: 0, decorridoMs: 0 }), null);
});

test('uma previsão zero do motor é «quase pronta», não «sem previsão»', () => {
  assert.equal(situacaoDaEspera({ progresso: { corrigidas: 4, total: 5 }, previsaoSegundos: 0, abertas: 5, decorridoMs: 0 })?.previsaoSegundos, 0);
});

test('o texto do progresso fala no singular e no plural', () => {
  assert.equal(progressoEmTexto(2, 5), '2 de 5 respostas abertas corrigidas');
  assert.equal(progressoEmTexto(0, 1), '0 de 1 resposta aberta corrigida');
});

test('a previsão diz-se em segundos até ao minuto e em minutos depois, sempre «cerca de»', () => {
  assert.equal(previsaoEmTexto(null), null);
  assert.equal(previsaoEmTexto(0), 'Fica pronta dentro de instantes.');
  assert.equal(previsaoEmTexto(9), 'Fica pronta dentro de instantes.');
  assert.equal(previsaoEmTexto(12), 'Fica pronta em cerca de 10 segundos.');
  assert.equal(previsaoEmTexto(38), 'Fica pronta em cerca de 40 segundos.');
  assert.equal(previsaoEmTexto(54), 'Fica pronta em cerca de 55 segundos.');
  assert.equal(previsaoEmTexto(55), 'Fica pronta em cerca de 1 minuto.');
  assert.equal(previsaoEmTexto(60), 'Fica pronta em cerca de 1 minuto.');
  assert.equal(previsaoEmTexto(61), 'Fica pronta em cerca de 2 minutos.');
  assert.equal(previsaoEmTexto(190), 'Fica pronta em cerca de 4 minutos.');
});
