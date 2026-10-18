import { BASE_PATH } from './base-path.ts';

/** As imagens enviadas vivem no backend, em `/uploads/...`. O browser pede-as ao endereço do aluno, e aí
 *  `/uploads` não existe (o gateway entregava o pedido à landing, 404). Servem-se por `/aluno/uploads/...`
 *  (app/uploads), que as lê do backend; esta função põe o prefixo. Endereços completos ficam como estão. */
export function assetUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith('/uploads/') ? `${BASE_PATH}${url}` : url;
}
