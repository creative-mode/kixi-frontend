/** O basePath deste app. Tem de ser o de `next.config.ts` (um teste confirma). */
export const BASE_PATH = '/manager';

/**
 * Para onde um `redirect()` de server action tem de apontar.
 *
 * Quando a ação corre por `fetch` (o JavaScript já carregou), o Next escreve o caminho cru em
 * `x-action-redirect` e é o cliente que lhe acrescenta o basePath. Quando corre como envio nativo
 * do formulário (o aluno carregou em "Entrar" antes de a página ter hidratado, ou sem JavaScript),
 * o Next responde 303 com `Location` igual ao caminho cru, e o browser vai a `/login` em vez de
 * `/manager/login`: um 404 logo a seguir ao login (#479). Neste caso o prefixo tem de vir já escrito.
 *
 * Um endereço absoluto (o do gestor) não leva prefixo em nenhum dos casos.
 */
export function actionDestination(path: string, viaClient: boolean): string {
  if (/^https?:\/\//i.test(path)) return path;
  if (viaClient || path === BASE_PATH || path.startsWith(`${BASE_PATH}/`) || path.startsWith(`${BASE_PATH}?`)) return path;
  return `${BASE_PATH}${path}`;
}
