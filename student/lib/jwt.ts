import { jwtVerify } from 'jose';
import { getJwtSecretValue } from './dev-secret.ts';

export type Session = { accountId: number | null; roles: string[]; exp: number };

/** O backend assina com o tamanho do segredo (HS256, HS384 ou HS512); `none` e os algoritmos assimétricos não valem. */
const ALGORITMOS = ['HS256', 'HS384', 'HS512'];

/**
 * A sessão de um token com a assinatura **verificada** (e a validade). Quem tem um cookie forjado ou expirado não tem sessão.
 *
 * Verifica-se aqui e não só no backend porque é este app que decide, antes de qualquer chamada, quem tem sessão, quem vai para o
 * gestor e quem vai ao login: essa decisão não pode assentar num cookie que qualquer um escreve. O segredo é o mesmo do backend e do gestor.
 */
export async function verificarSessao(token?: string, env: Record<string, string | undefined> = process.env): Promise<Session | null> {
  if (!token) return null;
  // Fora do try: um segredo mal configurado tem de aparecer (a validação do arranque já o exige), não virar "ninguém tem sessão".
  const segredo = new TextEncoder().encode(getJwtSecretValue(env));
  try {
    const { payload } = await jwtVerify(token, segredo, { algorithms: ALGORITMOS });
    // Sem papéis reconhecidos a sessão não serve: trata-se como "sem sessão" para o utilizador ir ao login em vez de ficar num ciclo 403 ↔ início.
    const roles = Array.isArray(payload.roles) ? payload.roles.filter((r): r is string => typeof r === 'string') : [];
    if (roles.length === 0) return null;
    return { accountId: Number(payload.sub) || null, roles, exp: payload.exp ?? 0 };
  } catch {
    return null; // assinatura inválida, expirado, mal formado ou algoritmo não aceite
  }
}
