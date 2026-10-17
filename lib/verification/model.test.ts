import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canReview, canRevoke, isStatus, noteError, safeDocumentUrl } from './model.ts';

test('só um pedido por rever se decide e só um aprovado se revoga', () => {
  assert.equal(canReview('PENDING'), true);
  assert.equal(canReview('APPROVED'), false);
  assert.equal(canRevoke('APPROVED'), true);
  assert.equal(canRevoke('REJECTED'), false);
});

test('recusar sem motivo é erro; aprovar sem nota não é', () => {
  assert.match(noteError('reject', '  ') ?? '', /motivo/);
  assert.equal(noteError('approve', ''), null);
  assert.equal(noteError('reject', 'Documento ilegível'), null);
  assert.match(noteError('approve', 'x'.repeat(501)) ?? '', /500/);
});

test('o documento só abre se for http ou https', () => {
  assert.equal(safeDocumentUrl('https://example.com/a.pdf'), 'https://example.com/a.pdf');
  assert.equal(safeDocumentUrl('javascript:alert(1)'), null);
  assert.equal(safeDocumentUrl('não é url'), null);
  assert.equal(safeDocumentUrl(null), null);
});

test('estados desconhecidos não passam', () => {
  assert.ok(isStatus('REVOKED'));
  assert.ok(!isStatus('approved'));
});
