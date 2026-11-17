import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pedirRevisaoAction } from './review-actions';

// Mock do apiPost
const originalApiPost = await import('./api').then(m => m.apiPost);

// Helper para mockar apiPost
let mockApiPost: typeof originalApiPost;

async function runWithMock(mockImpl: typeof originalApiPost, fn: () => Promise<void>) {
  const apiModule = await import('./api');
  const original = apiModule.apiPost;
  (apiModule as any).apiPost = mockImpl;
  try {
    await fn();
  } finally {
    (apiModule as any).apiPost = original;
  }
}

test('pedirRevisaoAction: validação simulationId inválido', async () => {
  const r = await pedirRevisaoAction(0, 1, 'motivo');
  assert.equal(r.ok, false);
  assert.match(r.message, /inválida/i);
});

test('pedirRevisaoAction: validação questionId inválido', async () => {
  const r = await pedirRevisaoAction(1, -1, 'motivo');
  assert.equal(r.ok, false);
  assert.match(r.message, /inválida/i);
});

test('pedirRevisaoAction: motivo vazio', async () => {
  const r = await pedirRevisaoAction(1, 1, '   ');
  assert.equal(r.ok, false);
  assert.match(r.message, /explicar/i);
});

test('pedirRevisaoAction: motivo excede maxLength', async () => {
  const long = 'a'.repeat(1001);
  const r = await pedirRevisaoAction(1, 1, long);
  assert.equal(r.ok, false);
  assert.match(r.message, /exceder/i);
});

test('pedirRevisaoAction: sucesso com message no data', async () => {
  await runWithMock(
    (async () => ({ ok: true, data: { message: 'Custom success' } })) as typeof originalApiPost,
    async () => {
      const r = await pedirRevisaoAction(1, 1, 'motivo válido');
      assert.equal(r.ok, true);
      assert.equal(r.message, 'Custom success');
    }
  );
});

test('pedirRevisaoAction: sucesso HTTP 204 (data undefined)', async () => {
  await runWithMock(
    (async () => ({ ok: true, data: undefined })) as typeof originalApiPost,
    async () => {
      const r = await pedirRevisaoAction(1, 1, 'motivo válido');
      assert.equal(r.ok, true);
      assert.match(r.message, /enviado/i);
    }
  );
});

test('pedirRevisaoAction: erro 409 (já existe pedido)', async () => {
  await runWithMock(
    async () => ({ ok: false, status: 409, message: 'Already requested' }),
    async () => {
      const r = await pedirRevisaoAction(1, 1, 'motivo válido');
      assert.equal(r.ok, false);
    }
  );
});

test('pedirRevisaoAction: erro 404 (endpoint não existe)', async () => {
  await runWithMock(
    async () => ({ ok: false, status: 404, message: 'Not Found' }),
    async () => {
      const r = await pedirRevisaoAction(1, 1, 'motivo válido');
      assert.equal(r.ok, false);
    }
  );
});

test('pedirRevisaoAction: erro de rede (catch)', async () => {
  await runWithMock(
    async () => { throw new Error('Network error'); },
    async () => {
      const r = await pedirRevisaoAction(1, 1, 'motivo válido');
      assert.equal(r.ok, false);
      assert.match(r.message, /ligação/i);
    }
  );
});

test('pedirRevisaoAction: timeout', async () => {
  await runWithMock(
    async () => { const e = new Error('Timeout'); e.name = 'TimeoutError'; throw e; },
    async () => {
      const r = await pedirRevisaoAction(1, 1, 'motivo válido');
      assert.equal(r.ok, false);
      assert.match(r.message, /demorou/i);
    }
  );
});
