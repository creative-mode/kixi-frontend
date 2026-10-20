import { getJwtSecretValue } from './dev-secret';

/** Shared by proxy.ts (edge) and the server code. */
export function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(getJwtSecretValue());
}
