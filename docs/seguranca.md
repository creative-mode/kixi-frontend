# Cabeçalhos de segurança

O gateway (`scripts/gateway.mjs`) acrescenta os mesmos cabeçalhos às respostas das três apps. É o único sítio onde se mudam.

| Cabeçalho | Valor | Porquê |
|---|---|---|
| `Content-Security-Policy-Report-Only` | política do ficheiro | mostra o que partiria, sem bloquear |
| `X-Content-Type-Options` | `nosniff` | o navegador não adivinha o tipo dos ficheiros |
| `X-Frame-Options` e `frame-ancestors` | `DENY` e `'none'` | ninguém embute o login noutro site |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | não deixa sair endereços completos |
| `Permissions-Policy` | só câmara no próprio site | a leitura de provas pode usar a câmara |
| `Strict-Transport-Security` | só quando o pedido chegou por HTTPS | evita voltar ao HTTP |

## Passar a CSP a bloqueio

1. Navegar a landing (com o Analytics aceite), o aluno e o gestor, com o console aberto.
2. Se não houver avisos de CSP, definir `CSP_ENFORCE=true` no gateway.
3. Se algo for legítimo e estiver a ser apontado, acrescentar a origem à lista no `gateway.mjs`.

O Analytics só carrega depois do consentimento, por isso `googletagmanager.com` e `google-analytics.com` estão previstos na política.
