/** As contagens do painel do gestor a partir da resposta de `GET /analytics/counts` (kixi#416): sem React, testável. */

/**
 * Uma contagem por chave pedida. Uma chave que o backend deixou de fora (a lista não se aplica ao papel) ou que não
 * traz um inteiro não negativo fica a -1, que o painel mostra como «!», tal como uma lista que falhava.
 */
export function dashboardCountsFrom(body: unknown, keys: readonly string[]): Record<string, number> {
  const source = body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  return Object.fromEntries(
    keys.map((key) => {
      const value = source[key];
      return [key, typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : -1];
    }),
  );
}
