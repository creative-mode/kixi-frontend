import assert from 'node:assert/strict';
import test from 'node:test';
import { getJwtSecretValue, validateRuntimeConfiguration } from './dev-secret.ts';

test('requires an explicit mock/backend selection', () => {
  assert.throws(() => validateRuntimeConfiguration({}), /KIXI_MOCK.*explicitamente/);
  assert.throws(() => validateRuntimeConfiguration({ KIXI_MOCK: 'yes' }), /KIXI_MOCK.*explicitamente/);
});

test('allows the mock only when explicitly enabled and requires production authorization', () => {
  assert.equal(validateRuntimeConfiguration({ KIXI_MOCK: 'true', NODE_ENV: 'development' }), 'mock');
  assert.throws(
    () => validateRuntimeConfiguration({ KIXI_MOCK: 'true', NODE_ENV: 'production' }),
    /KIXI_ALLOW_MOCK_IN_PROD=true/,
  );
  assert.equal(
    validateRuntimeConfiguration({
      KIXI_MOCK: 'true',
      NODE_ENV: 'production',
      KIXI_ALLOW_MOCK_IN_PROD: 'true',
    }),
    'mock',
  );
});

test('requires real backend URL and signing secret when mock is disabled', () => {
  assert.throws(() => validateRuntimeConfiguration({ KIXI_MOCK: 'false' }), /BACKEND_API_URL/);
  assert.throws(
    () => validateRuntimeConfiguration({ KIXI_MOCK: 'false', BACKEND_API_URL: 'http://backend' }),
    /JWT_SECRET/,
  );
  assert.equal(
    validateRuntimeConfiguration({
      KIXI_MOCK: 'false',
      BACKEND_API_URL: 'http://backend',
      JWT_SECRET: 'a-configured-secret',
    }),
    'real',
  );
});

test('uses the public demo secret only in explicit mock mode', () => {
  assert.throws(() => getJwtSecretValue({}), /JWT_SECRET.*demonstração/);
  assert.throws(() => getJwtSecretValue({ KIXI_MOCK: 'false' }), /JWT_SECRET.*demonstração/);
  assert.equal(getJwtSecretValue({ KIXI_MOCK: 'true' }), 'default-secret-change-in-production-min-256-bits');
  assert.equal(getJwtSecretValue({ KIXI_MOCK: 'true', JWT_SECRET: ' configured ' }), 'configured');
});
