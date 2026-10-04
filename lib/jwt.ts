/** Shared by proxy.ts (edge) and the server code: one place decides which secret verifies the session token. */
const DEV_SECRET = 'default-secret-change-in-production-min-256-bits';

export function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  // A forgeable token would open the whole manager: never fall back to the public dev secret in production.
  if (!secret && process.env.NODE_ENV === 'production' && process.env.KIXI_MOCK === 'false') {
    throw new Error('JWT_SECRET não está definido');
  }
  return new TextEncoder().encode(secret || DEV_SECRET);
}
