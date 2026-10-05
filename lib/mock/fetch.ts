import 'server-only';
import { handle } from './backend';

/** The manager has no backend: every API call is answered in-process by lib/mock/backend.ts.
 *  Set KIXI_MOCK=false to talk to the real Spring Boot API instead. */
export const MOCK = process.env.KIXI_MOCK !== 'false';

/** Drop-in replacement for `fetch` on the server: same arguments, same Response. */
export async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  if (!MOCK) return fetch(input, init);
  const url = new URL(String(input));
  const headers = new Headers(init.headers);
  const body = typeof init.body === 'string' ? init.body : '';
  return handle((init.method ?? 'GET').toUpperCase(), url.pathname + url.search, headers.get('authorization'), body);
}
