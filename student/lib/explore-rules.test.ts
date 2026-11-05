import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergePeople, schoolInitials } from './explore-rules.ts';

test('as iniciais vêm das palavras com 3 ou mais letras, até 3 letras', () => {
  assert.equal(schoolInitials('Instituto Técnico Kianda'), 'ITK');
  assert.equal(schoolInitials('Escola Nacional de Comércio'), 'ENC');
});

test('sem palavras longas que cheguem, ficam as duas primeiras letras do nome', () => {
  assert.equal(schoolInitials('ITEL'), 'IT');
  assert.equal(schoolInitials('Lar'), 'LA');
});

test('professores vêm antes dos colegas, e ninguém repete pelo mesmo id de conta', () => {
  const people = mergePeople(
    [{ accountId: 7, displayName: 'Prof. Costa', specialty: 'Física' }, { accountId: null, displayName: 'Sem conta' }],
    [{ accountId: 3, displayName: 'Ana Silva' }, { accountId: 7, displayName: 'Repetido' }],
  );
  assert.deepEqual(people.map((p) => p.accountId), [7, 3]);
  assert.equal(people[0]!.sub, 'Física');
  assert.equal(people[1]!.sub, 'Colega');
});
