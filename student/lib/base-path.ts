/** O prefixo em que a app é servida (`basePath` em next.config.ts). Um `fetch()` do
 *  browser não o recebe de graça, ao contrário de `<Link>` e `router.push()`, por isso os
 *  pedidos às route handlers montam-no daqui em vez de o escreverem à mão em cada sítio. */
export const BASE_PATH = '/aluno';
