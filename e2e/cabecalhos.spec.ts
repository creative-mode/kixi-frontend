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
