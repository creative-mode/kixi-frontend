import assert from 'node:assert/strict';
import { test } from 'node:test';
import { forwardedFor, messageForStatus, readFields, validateFields, validateFiles } from './donation-rules.ts';

const base = {
  institutionName: 'ITEL', subjectName: 'Matemática', examType: 'Exame', consent: 'true',
  donorName: '', donorEmail: '', classGrade: '', schoolYear: '', notes: '',
};
const fields = (over: Record<string, string> = {}) => {
  const all: Record<string, string> = { ...base, ...over };
  return readFields((name) => all[name]);
};

test('uma doação mínima é válida e o nome e o e-mail são opcionais', () => {
  assert.deepEqual(validateFields(fields()), {});
});

test('o consentimento, a instituição, a disciplina e o tipo são obrigatórios', () => {
  const errors = validateFields(fields({ consent: '', institutionName: '', subjectName: 'x', examType: 'Nada' }));
  assert.deepEqual(Object.keys(errors).sort(), ['consent', 'examType', 'institutionName', 'subjectName']);
});

test('marcação, e-mail e ano lectivo mal formados são recusados', () => {
  const errors = validateFields(fields({ institutionName: '<b>x</b>', donorEmail: 'ana@', schoolYear: 'ontem', notes: 'a<b' }));
  assert.deepEqual(Object.keys(errors).sort(), ['donorEmail', 'institutionName', 'notes', 'schoolYear']);
  assert.deepEqual(validateFields(fields({ schoolYear: '2024/2025' })), {});
  assert.deepEqual(validateFields(fields({ schoolYear: '2025' })), {});
});

test('valores que não são texto não passam por texto', () => {
  const f = readFields(() => ({ evil: true }));
  assert.equal(f.institutionName, '');
});

test('os ficheiros: pelo menos um, o tipo, o tamanho e o total', () => {
  assert.match(validateFiles([])!, /pelo menos uma/);
  assert.match(validateFiles([{ name: 'a.exe', size: 10 }])!, /não é uma foto/);
  assert.match(validateFiles([{ name: 'a.png', size: 0 }])!, /vazio/);
  assert.match(validateFiles([{ name: 'a.png', size: 16 * 1024 * 1024 }])!, /15 MB/);
  assert.match(validateFiles(Array.from({ length: 11 }, (_, i) => ({ name: `${i}.png`, size: 1 })))!, /No máximo 10/);
  assert.match(validateFiles(Array.from({ length: 4 }, (_, i) => ({ name: `${i}.pdf`, size: 14 * 1024 * 1024 })))!, /50 MB/);
  assert.equal(validateFiles([{ name: 'A.JPG', size: 100 }, { name: 'b.pdf', size: 100 }]), null);
});

test('forwardedFor só aceita uma lista de IPs', () => {
  assert.equal(forwardedFor('41.223.10.9, 10.0.0.1'), '41.223.10.9, 10.0.0.1');
  assert.equal(forwardedFor('2001:db8::1'), '2001:db8::1');
  assert.equal(forwardedFor('1.2.3.4\r\nX-Evil: 1'), null);
  assert.equal(forwardedFor('evil.example'), null);
  assert.equal(forwardedFor(null), null);
});

test('as mensagens são em português e a 429 diz quando voltar', () => {
  assert.match(messageForStatus(429, '1800'), /30 min/);
  assert.match(messageForStatus(413), /demasiado grande/);
  assert.match(messageForStatus(415), /foto nem um PDF/);
  assert.match(messageForStatus(500), /Não foi possível/);
});
