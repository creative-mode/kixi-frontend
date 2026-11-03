import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MANAGER_HOME, redirectOrigin, sessionDestination, sessionRoles, STUDENT_HOME } from './session-destination.ts';

const NOW = Date.UTC(2026, 9, 18, 12, 0, 0);

function token(payload: object): string {
  const b64 = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64(payload)}.assinatura`;
}

const daquiAUmaHora = Math.floor(NOW / 1000) + 3600;

test('sem cookie, a landing aparece', () => {
  assert.equal(sessionDestination(undefined, '', NOW), null);
  assert.equal(sessionDestination('', '', NOW), null);
});

test('o aluno vai para o início do aluno', () => {
  assert.equal(sessionDestination(token({ roles: ['STUDENT'], exp: daquiAUmaHora }), '', NOW), STUDENT_HOME);
});

test('administrador e professor vão para o gestor', () => {
  assert.equal(sessionDestination(token({ roles: ['ADMIN'], exp: daquiAUmaHora }), '', NOW), MANAGER_HOME);
  assert.equal(sessionDestination(token({ roles: ['TEACHER'], exp: daquiAUmaHora }), '', NOW), MANAGER_HOME);
  assert.equal(sessionDestination(token({ roles: ['TEACHER', 'STUDENT'], exp: daquiAUmaHora }), '', NOW), MANAGER_HOME);
});

test('o gestor noutro endereço é respeitado', () => {
  assert.equal(
    sessionDestination(token({ roles: ['ADMIN'], exp: daquiAUmaHora }), 'https://gestor.kixi.ao/manager', NOW),
    'https://gestor.kixi.ao/manager',
  );
});

test('uma sessão expirada conta como sem sessão', () => {
  assert.equal(sessionDestination(token({ roles: ['STUDENT'], exp: Math.floor(NOW / 1000) - 1 }), '', NOW), null);
});

test('papéis desconhecidos ou vazios não redirecionam', () => {
  assert.equal(sessionDestination(token({ roles: [], exp: daquiAUmaHora }), '', NOW), null);
  assert.equal(sessionDestination(token({ roles: ['ROOT'], exp: daquiAUmaHora }), '', NOW), null);
  assert.equal(sessionDestination(token({ exp: daquiAUmaHora }), '', NOW), null);
});

test('um cookie que não é um JWT não parte nada', () => {
  assert.equal(sessionRoles('lixo', NOW), null);
  assert.equal(sessionRoles('a.%%%.c', NOW), null);
  assert.equal(sessionRoles(`a.${Buffer.from('"texto"').toString('base64')}.c`, NOW), null);
});

test('a origem configurada manda; em produção, sem ela, não há redireccionamento', () => {
  const pedido = new Headers({ host: 'atacante.example', 'x-forwarded-host': 'atacante.example' });
  assert.equal(redirectOrigin('https://kixi.ao/qualquer', pedido, 'https:', true), 'https://kixi.ao');
  assert.equal(redirectOrigin('', pedido, 'https:', true), null, 'em produção o pedido não é de confiança');
  assert.equal(redirectOrigin('não é url', pedido, 'https:', true), null);
});

test('fora de produção, o pedido serve para o npm run dev', () => {
  const gateway = new Headers({ host: '127.0.0.1:3004', 'x-forwarded-host': 'localhost:3000', 'x-forwarded-proto': 'http' });
  assert.equal(redirectOrigin(undefined, gateway, 'http:', false), 'http://localhost:3000');
  assert.equal(redirectOrigin(undefined, new Headers({ host: 'localhost:3004' }), 'http:', false), 'http://localhost:3004');
  assert.equal(redirectOrigin(undefined, new Headers(), 'http:', false), null);
});
