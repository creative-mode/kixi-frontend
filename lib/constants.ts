export const API_BASE = process.env.BACKEND_API_URL ?? 'http://localhost:8080/api/v1';

/** Backend origin without the /api/v1 suffix (a few resources live outside /v1). */
export const API_HOST = (process.env.BACKEND_API_URL ?? 'http://localhost:8080/api/v1').replace(/\/api(\/v1)?\/?$/, '');

/** O `basePath` do next.config.ts. O Next prefixa-o nos `<Link>` e no router, mas
 *  não num `fetch` ou `EventSource` feitos à mão, que têm de o levar. */
export const BASE_PATH = '/manager';
