/**
 * The prefix under which this app is served: `/aluno`.
 *
 * It lives in `next.config.ts` too. That duplication is deliberate and is guarded by
 * `paths.test.ts`, which fails if the two ever disagree — a constant that Next imports
 * cannot be checked from a plain `node --test`, and the drift it would hide is silent.
 *
 * This exists because `<Link>` and `router.push()` add the basePath on their own but
 * `redirect()` inside a server action does not: `redirect('/inicio')` came back as
 * `Location: /inicio`, which 404s, because nothing is listening there. Verified on Next
 * 16.3.8 — the cookie was set and the browser was sent to a page that does not exist, so
 * a successful login looked like a broken one.
 *
 * Only import this from the server: a `redirect()` is server-side anyway, and every `<Link>`
 * in this app keeps using bare paths, which Next handles on its own.
 */
export const BASE_PATH = '/aluno';

/**
 * A path inside this app, with the basePath already applied.
 *
 * Idempotent on purpose: if a caller ever hands over a path that already carries the
 * prefix, the answer is `/aluno/entrar` and not `/aluno/aluno/entrar`, which would 404 in
 * a way that is tedious to trace.
 */
export function appPath(path: string): string {
  const withSlash = path.startsWith('/') ? path : `/${path}`;
  if (!BASE_PATH || withSlash === BASE_PATH || withSlash.startsWith(`${BASE_PATH}/`)) {
    return withSlash;
  }
  return `${BASE_PATH}${withSlash}`;
}
