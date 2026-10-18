import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validarCodigoDeMatricula, type EnrollmentCode } from './enrollment-codes.ts';

const AGORA = new Date('2026-10-18T12:00:00Z');

function codigo(sobrepor: Partial<EnrollmentCode> = {}): EnrollmentCode {
  return { id: 1, code: 'TESTE1234', maxUses: 1, uses: 0, expiresAt: null, revokedAt: null, ...sobrepor };
}

test('um código que não existe é inválido', () => {
  const resultado = validarCodigoDeMatricula([codigo()], 'OUTRO123', AGORA);
  assert.equal(resultado.ok, false);
  assert.equal(!resultado.ok && resultado.status, 400);
  assert.equal(!resultado.ok && resultado.detail, 'Invalid enrollment code');
});

test('um código revogado é recusado, mesmo com usos de sobra', () => {
  const resultado = validarCodigoDeMatricula(
    [codigo({ maxUses: 99, revokedAt: '2026-10-01T00:00:00Z' })],
    'TESTE1234',
    AGORA,
  );
  assert.equal(resultado.ok, false);
  assert.equal(!resultado.ok && resultado.detail, 'Enrollment code has been revoked');
});

test('um código expirado é recusado', () => {
  const resultado = validarCodigoDeMatricula(
    [codigo({ maxUses: 99, expiresAt: '2026-10-18T11:59:59Z' })],
    'TESTE1234',
    AGORA,
  );
  assert.equal(resultado.ok, false);
  assert.equal(!resultado.ok && resultado.detail, 'Enrollment code has expired');
});

test('um código que ainda não expirou, à hora exata, continua válido', () => {
  const resultado = validarCodigoDeMatricula(
    [codigo({ maxUses: 99, expiresAt: '2026-10-18T12:00:01Z' })],
    'TESTE1234',
    AGORA,
  );
  assert.equal(resultado.ok, true);
});

test('um código sem usos por gastar é recusado', () => {
  const resultado = validarCodigoDeMatricula([codigo({ maxUses: 1, uses: 1 })], 'TESTE1234', AGORA);
  assert.equal(resultado.ok, false);
  assert.equal(!resultado.ok && resultado.detail, 'Enrollment code has no uses left');
});

test('um código válido devolve a entrada, para quem chama contar o uso', () => {
  const entrada = codigo({ maxUses: 2, uses: 1 });
  const resultado = validarCodigoDeMatricula([entrada], 'TESTE1234', AGORA);
  assert.equal(resultado.ok, true);
  assert.equal(resultado.ok && resultado.entry, entrada);
});
