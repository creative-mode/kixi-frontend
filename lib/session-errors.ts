/** Texto de sessão expirada devolvido pelas server actions e pelo guard do backend. */
export function isSessionExpiredError(message: unknown, code?: unknown): boolean {
  if (code !== undefined) return code === 'SESSION_EXPIRED';
  return typeof message === 'string' && /sess(?:ã|a)o expirad|n(?:ã|a)o autenticad/i.test(message);
}
