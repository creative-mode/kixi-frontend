// A fila de verificação (#535): node --test lib/verification/queue.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { filterRequests, verificationCounts, VERIFICATION_FILTERS, DEFAULT_VERIFICATION_FILTER } from './queue.ts';
import type { VerificationRequest, VerificationStatus } from './model.ts';

const pedido = (id: number, status: VerificationStatus): VerificationRequest => ({
  id, institutionId: id, officialName: `Escola ${id}`, registrationNumber: 'NIF', contactEmail: 'a@b.ao', documentUrl: null, notes: null,
  status, reviewNote: null, reviewedAt: null, createdAt: '2026-10-01T08:00:00',
});
const pedidos = [pedido(1, 'PENDING'), pedido(2, 'APPROVED'), pedido(3, 'PENDING'), pedido(4, 'REJECTED'), pedido(5, 'REVOKED'), pedido(6, 'PENDING')];

test('cada filtro mostra os pedidos do seu estado, e «todos» mostra tudo', () => {
  assert.deepEqual(filterRequests(pedidos, 'por-rever').map((r) => r.id), [1, 3, 6]);
  assert.deepEqual(filterRequests(pedidos, 'aprovado').map((r) => r.id), [2]);
  assert.deepEqual(filterRequests(pedidos, 'recusado').map((r) => r.id), [4]);
  assert.deepEqual(filterRequests(pedidos, 'revogado').map((r) => r.id), [5]);
  assert.equal(filterRequests(pedidos, 'todos').length, 6);
});

test('as contagens batem com o que cada filtro mostra', () => {
  const counts = verificationCounts(pedidos);
  assert.deepEqual(counts, { todos: 6, 'por-rever': 3, aprovado: 1, recusado: 1, revogado: 1 });
  for (const f of VERIFICATION_FILTERS) assert.equal(filterRequests(pedidos, f.key).length, counts[f.key], f.key);
});

test('sem pedidos tudo é zero', () => {
  assert.deepEqual(verificationCounts([]), { todos: 0, 'por-rever': 0, aprovado: 0, recusado: 0, revogado: 0 });
});

test('abre nos pedidos por rever e os rótulos são os do estado', () => {
  assert.equal(DEFAULT_VERIFICATION_FILTER, 'por-rever');
  assert.deepEqual(VERIFICATION_FILTERS.map((f) => f.label), ['Todos', 'Por rever', 'Aprovado', 'Recusado', 'Revogado']);
});
