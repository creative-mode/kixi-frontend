import { test, expect } from '@playwright/test';

// Os cabeçalhos de segurança (#585) chegam ao browser pelo gateway nas três apps, não só na configuração de cada uma.
const APPS = [
  ['aluno', '/aluno/entrar'],
  ['gestor', '/manager/login'],
  ['landing', '/'],
] as const;

for (const [nome, caminho] of APPS) {
  test(`${nome}: cabeçalhos de segurança`, async ({ request }) => {
    const resposta = await request.get(caminho);
    expect(resposta.status()).toBeLessThan(400);
    const h = resposta.headers();
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['x-frame-options']).toBe('SAMEORIGIN');
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(h['permissions-policy']).toContain('camera=()');
    expect(h['content-security-policy']).toBe("object-src 'none'; base-uri 'self'; frame-ancestors 'self'");
    expect(h['content-security-policy-report-only']).toContain("default-src 'self'");
  });
}

test('#799: Server-Timing nas páginas do aluno que mais pedem ao servidor', async ({ request }) => {
  for (const caminho of ['/aluno/inicio', '/aluno/provas', '/aluno/resultado']) {
    // Sem sessão a app responde 307; o cabeçalho vem na mesma, do gateway.
    const resposta = await request.get(caminho, { maxRedirects: 0 });
    expect(resposta.headers()['server-timing'], caminho).toMatch(/^upstream;desc="primeiro byte";dur=\d+(\.\d+)?$/);
  }
  // As restantes páginas não levam o cabeçalho: não se mede o que não é pesado.
  const entrada = await request.get('/aluno/entrar', { maxRedirects: 0 });
  expect(entrada.headers()['server-timing']).toBeUndefined();
});
