export const API_BASE = process.env.BACKEND_API_URL ?? 'http://localhost:8080/api/v1';

/** Backend origin without the /api/v1 suffix (a few resources live outside /v1). */
export const API_HOST = (process.env.BACKEND_API_URL ?? 'http://localhost:8080/api/v1').replace(/\/api(\/v1)?\/?$/, '');

/** O `basePath` do next.config.ts. O Next prefixa-o nos `<Link>` e no router, mas
 *  não num `fetch` ou `EventSource` feitos à mão, que têm de o levar. */
export const BASE_PATH = '/manager';

/** O contacto público do site, reutilizado no gestor para o «Problemas no acesso?».
 *  Sem `NEXT_PUBLIC_CONTACT_EMAIL` não há endereço para mostrar — e não se inventa um. */
export const CONTACT_EMAIL = (process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '').trim();
