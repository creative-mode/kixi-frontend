import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveSchoolId } from './school.ts';
import type { Institution } from '../types.ts';

const itel: Institution = { id: 1, code: 'ITEL', name: 'Instituto de Telecomunicações', short_name: 'ITEL', logo: null };
const isptec: Institution = { id: 2, code: 'ISP', name: 'ISPTEC', short_name: 'ISPTEC', logo: null };

test('a escola da turma ganha a ligacao administrativa', () => {
  // MeService.resolveSchool: enrolledSchool primeiro, linkedSchool so quando nao ha
  // matricula. Invertido, o perfil mostrava uma escola com o curso de outra.
  assert.equal(resolveSchoolId(isptec, itel), isptec);
  assert.equal(resolveSchoolId(itel, isptec), itel);
});

test('sem matricula, a ligacao administrativa preenche', () => {
  assert.equal(resolveSchoolId(undefined, itel), itel);
});

test('sem nenhuma das duas, nao ha escola', () => {
  assert.equal(resolveSchoolId(undefined, undefined), undefined);
});
