/** Texto de sessão expirada devolvido pelas server actions e pelo guard do backend. */
export function isSessionExpiredError(message: unknown): boolean {
  return typeof message === 'string' && /sess(?:ã|a)o expirad|n(?:ã|a)o autenticad/i.test(message);
}
