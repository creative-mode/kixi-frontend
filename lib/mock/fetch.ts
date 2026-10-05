import 'server-only';
import { handle } from './backend';

/** The manager has no backend: every API call is answered in-process by lib/mock/backend.ts.
 *  Set KIXI_MOCK=false to talk to the real Spring Boot API instead. */
export const MOCK = process.env.KIXI_MOCK !== 'false';

/** Multipart bodies reach the mock as JSON: JSON parts are parsed, files become `{ name, type, size, dataUrl }`. */
async function formToJson(form: FormData): Promise<string> {
  const out: Record<string, unknown> = {};
  for (const [key, v] of form.entries()) {
    let value: unknown = v;
    if (typeof v !== 'string') {
      const buf = Buffer.from(await v.arrayBuffer());
      if (v.type.includes('json')) value = JSON.parse(buf.toString('utf8'));
      else value = { name: (v as File).name, type: v.type, size: buf.length, dataUrl: buf.length <= 1_500_000 ? `data:${v.type || 'application/octet-stream'};base64,${buf.toString('base64')}` : null };
    }
    out[key] = key in out ? [...(Array.isArray(out[key]) ? (out[key] as unknown[]) : [out[key]]), value] : value;
  }
  return JSON.stringify(out);
}

/** Drop-in replacement for `fetch` on the server: same arguments, same Response. */
export async function apiFetch(input: string | URL, init: RequestInit = {}): Promise<Response> {
  if (!MOCK) return fetch(input, init);
  const url = new URL(String(input));
  const headers = new Headers(init.headers);
  const body = typeof init.body === 'string' ? init.body : init.body instanceof FormData ? await formToJson(init.body) : '';
  return handle((init.method ?? 'GET').toUpperCase(), url.pathname + url.search, headers.get('authorization'), body);
}
