/**
 * Cabeçalhos de segurança (#585). Uma cópia por app, de propósito: cada imagem Docker só leva a pasta da sua app.
 *
 * - Cumprem-se já: nosniff, referrer, frame, permissões e a parte da CSP que não custa nada (sem plugins, base fixa, só a mesma origem em moldura).
 * - A política completa vai em `Report-Only`: o Next precisa de scripts inline para hidratar, por isso fecha-se por fases, vendo no
 *   consola do browser o que a política bloquearia antes de a impor. Enquanto for só relatório, não protege: é o passo 1.
 * - O Google Analytics só existe com `NEXT_PUBLIC_GA_ID` (e com consentimento): só então os seus domínios entram na política.
 */
export function cabecalhosDeSeguranca(env: Record<string, string | undefined> = process.env) {
  const ga = Boolean(env.NEXT_PUBLIC_GA_ID);
  const analytics = ga ? ' https://www.googletagmanager.com' : '';
  const analyticsLigacoes = ga ? ' https://www.googletagmanager.com https://*.google-analytics.com https://*.analytics.google.com' : '';
  const completa = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${analytics}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob:${ga ? ' https://*.google-analytics.com' : ''}`,
    "font-src 'self' data:",
    `connect-src 'self'${analyticsLigacoes}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
    "form-action 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join('; ');
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
    { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; frame-ancestors 'self'" },
    { key: 'Content-Security-Policy-Report-Only', value: completa },
  ];
}
