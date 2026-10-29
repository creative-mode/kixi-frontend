import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badgesUnlockedIn, gradeReading } from './result-motivation.ts';

test('sem nota não há leitura: uma nota em falta não é um zero', () => {
  assert.equal(gradeReading({ score: null, totalMax: 20, meanScore: 12, sampleSize: 5, delta: null }), null);
  assert.equal(gradeReading({ score: 10, totalMax: 0, meanScore: 12, sampleSize: 5, delta: null }), null);
});

test('acima da média da turma usa os números do servidor', () => {
  const leitura = gradeReading({ score: 16.4, totalMax: 20, meanScore: 12.8, sampleSize: 8, delta: null });
  assert.equal(leitura?.tone, 'above');
  assert.match(leitura!.text, /Acima da média da turma: 16,4 de 20, contra 12,8 em 8 tentativas/);
  assert.equal(leitura?.leadsToTutor, false);
});

test('na média e abaixo da média são leituras diferentes', () => {
  assert.equal(gradeReading({ score: 12.8, totalMax: 20, meanScore: 12.8, sampleSize: 4, delta: null })?.tone, 'level');
  assert.equal(gradeReading({ score: 11, totalMax: 20, meanScore: 12.8, sampleSize: 4, delta: null })?.tone, 'below');
});

test('com uma só tentativa não se inventa uma média da turma', () => {
  const leitura = gradeReading({ score: 16, totalMax: 20, meanScore: 8, sampleSize: 1, delta: null });
  assert.equal(leitura?.tone, 'above');
  assert.doesNotMatch(leitura!.text, /média da turma/);
});

test('nota baixa é encorajadora, sem culpa, e leva ao tutor', () => {
  const leitura = gradeReading({ score: 6, totalMax: 20, meanScore: 12.8, sampleSize: 8, delta: null });
  assert.equal(leitura?.tone, 'low');
  assert.equal(leitura?.leadsToTutor, true);
  assert.match(leitura!.text, /ponto de partida, não um veredicto/);
  assert.match(leitura!.text, /tutor/);
  assert.doesNotMatch(leitura!.text, /falhaste|culpa|preguiça/);
});

test('a subida face à tentativa anterior entra na frase', () => {
  const leitura = gradeReading({ score: 16.4, totalMax: 20, meanScore: null, sampleSize: null, delta: 2.2 });
  assert.match(leitura!.text, /Subiste \+2,2 face à tentativa anterior/);
});

test('só contam as medalhas desbloqueadas durante esta tentativa', () => {
  const badges = [
    { code: 'ANTIGA', unlockedAt: '2026-10-20T10:00:00' },
    { code: 'NOVA', unlockedAt: '2026-10-28T10:00:00' },
    { code: 'DEPOIS', unlockedAt: '2026-10-28T12:00:00' },
  ];
  const out = badgesUnlockedIn(badges, '2026-10-28T09:30:00', '2026-10-28T10:05:00');
  assert.deepEqual(out.map((b) => b.code), ['NOVA']);
});

test('uma medalha atribuída ao entregar, uns minutos depois, ainda conta', () => {
  const badges = [{ code: 'NOVA', unlockedAt: '2026-10-28T10:08:00' }];
  assert.deepEqual(badgesUnlockedIn(badges, '2026-10-28T09:30:00', '2026-10-28T10:05:00').map((b) => b.code), ['NOVA']);
});

test('sem início de tentativa, ou com datas estragadas, não há medalha a anunciar', () => {
  const badges = [{ code: 'NOVA', unlockedAt: '2026-10-28T10:00:00' }];
  assert.deepEqual(badgesUnlockedIn(badges, null, '2026-10-28T10:05:00'), []);
  assert.deepEqual(badgesUnlockedIn([{ code: 'X', unlockedAt: 'não é data' }], '2026-10-28T09:30:00', '2026-10-28T10:05:00'), []);
});
