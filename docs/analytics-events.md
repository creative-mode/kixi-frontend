# Analytics e eventos de UX (#517, #714)

As apps gestor, aluno e landing usam o mesmo schema e a mesma fila em memória, compilados localmente em cada app.

**Regra de sincronização:** `lib/analytics.ts`, `student/lib/analytics.ts` e `landing/lib/analytics.ts` são cópias byte a byte (apps Next separadas, sem pacote partilhado). Qualquer mudança faz-se nas três; `lib/analytics-mirror.test.ts` falha enquanto divergirem. Um pacote partilhado fica como follow-up. Analytics só é carregado depois de a pessoa escolher **Aceitar**. A escolha “Só necessários” não é enviada para o Google Analytics; uma recusa não pode ser registada sem violar a própria recusa.

`track(event, params)` devolve `sent`, `queued`, `denied`, `invalid` ou `overflow`. A fila só vive em memória, tem limite de 100 eventos e não persiste em localStorage, cookies ou URL. `FireEventOnce` chama `track` e limpa o marcador da URL logo a seguir, seja qual for o resultado. A configuração do Google tag (`loadAnalytics` em `landing/` e `student/components/consent/Consent.tsx`) envia `send_page_view: false` e já leva `page_location` canónico e `page_referrer` vazio. Nenhuma chamada manual passa uma URL completa.

**Onde os eventos nascem (#714):**

- `components/analytics/trackers.tsx` (igual em `landing/` e `student/`, verificado por `lib/analytics-mirror.test.ts`): `PageViewTracker` (um `page_view` por rota, com `setSafePageContext` antes), `ScrollDepthTracker` (só na landing) e `ErrorView` (páginas 403, 404 e de erro).
- Banner de consentimento (`components/consent/Consent.tsx`): ao aceitar, `setAnalyticsEnabled(true)`, carrega o Google tag e chama `flushAnalytics()`, por isso o que ficou na fila antes do `gtag` (o `page_view` da chegada, por exemplo) sai nessa altura; regista `consent_choice`. «Só necessários» chama `setAnalyticsEnabled(false)`, a única limpeza de cookies. `ANALYTICS_READY_EVENT` é disparado quando a fila fica vazia.
- Cadastro do aluno (`student/components/AuthForm.tsx`): `signup_started` à primeira alteração; `signup_error` com o primeiro campo inválido ou `form` quando o servidor recusa.
- Login do aluno: o destino leva `?entrou=1` (`lib/auth-actions.ts`) e o layout dispara `login_success` com `FireEventOnce`, que tira o marcador do endereço. O marcador sai sempre, mesmo sem consentimento: um login feito antes de aceitar os cookies não fica registado (o mesmo vale para os outros marcadores do `FireEventOnce`, como o `sign_up`).
- Doação (`landing/components/donate/DonationForm.tsx`): `donation_started` à primeira interação (campo, ficheiro ou colar), `donation_step` ao avançar de ecrã, `donation_error` com o ecrã, a categoria e o primeiro campo inválido desse ecrã.
- Sala de prova: `exam_abandoned` só no «Sair» do aviso de saída.
- **O gestor não mede:** não tem banner nem carregador de GA, por isso lá `track` devolve sempre `denied`. `login_success` e `page_view` do gestor ficam no contrato para o dia em que se decidir medir, com banner próprio.

**Limite da proteção automática:** `send_page_view: false` desliga o page view da configuração inicial (o `page_view` é o explícito do `PageViewTracker`), mas não desliga a medição melhorada de alterações no histórico do browser da propriedade GA4. Para garantir que o GA4 não cria page views automáticos em `pushState`, `replaceState` ou `popstate`, a opção **Page changes based on browser history events** deve estar desativada na propriedade (Admin → Data streams → Web stream → Enhanced measurement → Page views → configurações). Esta configuração pertence ao GA4 e não é verificável nem garantida por este repositório. O código dá contexto de página canónico em cada navegação (`setSafePageContext`) como defesa adicional; a validação final deve confirmar a opção externa e inspecionar as requisições GA4 no ambiente publicado.

## Privacidade e parâmetros comuns

Nunca enviar email, nome, telefone, password, token, conteúdo de campos, respostas de provas, IDs de utilizador/prova, nome/tamanho/conteúdo de ficheiros, mensagem de exceção ou URL arbitrária. O schema de `track` selecciona explicitamente os parâmetros permitidos e rejeita eventos/parâmetros inválidos. `page_location` e `page_referrer` são produzidos internamente: localização é normalizada para origem + rota canónica, sem query/hash, e referrer é vazio. As UTMs só são incluídas nos eventos explicitamente documentados e só aceitam valores enumerados; termos, conteúdo e outros parâmetros de URL são descartados.

Quando o consentimento não está ativo (`necessary` ou nulo), o contexto global do GA4 é forçado a uma rota neutra (`${origin}/`) com referrer vazio, impedindo que qualquer rota real da aplicação fique exposta no contexto de página do Google tag.

## Consentimento, filas e limites de retirada

- Sem consentimento `all`, `track` devolve `denied`; o carregador GA não é iniciado. Sem `NEXT_PUBLIC_GA_ID` não há `gtag`: com consentimento os eventos ficam na fila em memória e nunca saem. `necessary` e consentimento nulo não permitem medições.
- A passagem de `all` para `necessary` ou nulo ativa o bloqueio global `ga-disable-*` **sincronamente**, antes de persistir a escolha ou notificar o React. Limpa a fila da aplicação, remove comandos `event`/`config` ainda não consumidos no `dataLayer` (preservando a referência do array), limpa o contexto global de página do GA4 e apaga cookies `_ga` acessíveis ao JavaScript. Reabrir as definições usa a mesma retirada imediata.
- A fila local nunca é reenviada após retirada: é limpa e não persiste. O que trava o Google tag é o `ga-disable-*`; o stub de `gtag` continua a empurrar para o `dataLayer`, e os comandos `event`/`config` ainda não consumidos são removidos na retirada. Ao aceitar novamente, só eventos novos podem ser enviados.
- Um pedido GA4 que já tenha sido enviado pela rede antes da retirada não pode ser cancelado ou removido retroactivamente pelo browser. Cookies `HttpOnly` também não são apagáveis por JavaScript. Não há persistência de eventos para tentar reenviá-los.
- O bloqueio `ga-disable-*` impede novos envios do Google tag nesta página, mas a garantia contra page views de medição melhorada continua a depender da configuração da propriedade indicada acima. Verifica também integrações GTM/Google tag externas que possam carregar outros destinos.

## Evitar duplicação de eventos

- `FireEventOnce` só dispara quando a página chega com o parâmetro e remove-o com `replace`, por isso um refresh não o repete.
- `page_view`: um por rota (`usePathname`); o Strict Mode e as mudanças de consentimento não o repetem. Sem consentimento é `denied` e não conta: ao aceitar, sai o desta página.
- `scroll_depth`: cada limiar (25, 50, 75, 100) uma vez por montagem da página, medido só em eventos de scroll.
- `signup_started` e `donation_started`: uma vez por formulário («Doar outro enunciado» recomeça). Só contam feitos quando `track` os aceita: quem preenche antes de aceitar os cookies emite o início na interação seguinte, e o funil não fica com passos sem começo.
- `error_view`: uma vez por montagem da página de erro.

A reabertura das definições (consentimento a nulo) desativa imediatamente a medição; eventos já na fila são descartados e não são reenviados ao reaceitar.

## Configuração externa necessária do GA4

A seguinte configuração da propriedade GA4 é obrigatória para a proteção completa de privacidade (não é gerida por este repositório):

- **Admin → Data streams → Web stream → Enhanced measurement → Page views → configurações**: desativar a opção “Page changes based on browser history events” (impedir page views automáticos em `pushState`, `replaceState`, `popstate`).
- Verificar se não há integrações GTM/Google tag externas que carreguem outros destinos de medição.

## Métricas de campo (#799)

O `WebVitalsTracker` (`student/components/analytics/`), montado no layout do aluno, usa o
`useReportWebVitals` do Next — que já traz o `web-vitals` compilado, sem dependência nova — e
envia um `web_vitals` por métrica, página canónica e carregamento:

- **O que sai:** LCP e INP (atualizados; envia-se o último valor fechado), TTFB, FCP e CLS.
- **O que não sai:** URL completa, ids, user-agent ou qualquer identificador. O aparelho é
  classificado em `mobile`/`tablet`/`desktop` a partir do ponteiro, da largura e de um teste
  grosseiro ao user-agent; nada disso é guardado.
- **Consentimento:** sem `all` a métrica fica em memória e só é enviada quando a pessoa aceita
  (`CONSENT_EVENT`), como o `page_view`. Sem `NEXT_PUBLIC_GA_ID`, fica na fila como os restantes.
- **Server-Timing:** o gateway acrescenta `Server-Timing: upstream;desc="primeiro byte";dur=…`
  a `/aluno/inicio`, `/aluno/provas` e `/aluno/resultado`, para separar a espera do servidor do
  trabalho do browser.

**Ler o p75 em produção.** O evento já vai para o GA4. Para o ver:

1. Admin → Custom definitions → criar dimensões de evento `metric`, `page` e `device` (âmbito
   evento) e uma métrica personalizada `value` (âmbito evento, unidade ms).
2. Explore → Free form: linhas `page` e `device`, colunas `metric`, valor `value` com agregação
   **p75**. As metas são INP <= 200 ms, LCP <= 2,5 s, TTFB <= 800 ms, FCP <= 1,8 s e CLS <= 0,1.

**Ler o p75 na máquina de quem testa.** Com `KIXI_VITALS_LOG=true` num host local/rede privada,
o mesmo evento é também enviado para `/aluno/api/vitals`, que agrega em memória (sem disco, sem
ids) e serve o painel `/aluno/metricas`. O endpoint responde 404 em produção ou com a flag
desligada.

## Catálogo de eventos

| Evento | Aplicação e quando | Parâmetros permitidos |
|---|---|---|
| `page_view` | Landing e aluno, uma vez por rota com consentimento | `app`: `manager\|student\|landing`; `page`: categoria controlada por app (`home`, `donation`, `privacy`, `cookies`, `login`, `signup`, `onboarding`, `student_home`, `exam`, `result`, `room`, `dashboard`, `forbidden`, `not_found`, `other`); UTMs permitidas acima |
| `web_vitals` | Aluno, uma vez por métrica e navegação; LCP/INP levam o último valor (#799) | `app`: `student`; `page`: categoria controlada; `metric`: `LCP\|INP\|TTFB\|FCP\|CLS`; `value`: ms (CLS adimensional, três casas); `device`: `mobile\|tablet\|desktop` |
| `cta_clique` | Landing, clique num CTA de criar conta (`CtaLink`, #512) | `origem`: `header\|outro\|faq` |
| `signup_started` | Aluno, primeira interação no formulário de cadastro | `surface`: `signup_form` |
| `signup_error` | Aluno, validação local ou falha do servidor | `field`: `first_name\|last_name\|username\|email\|password\|confirm\|form`; `category`: `validation\|server` |
| `sign_up` | Aluno, cadastro confirmado após redirect | Somente UTMs permitidas |
| `login_success` | Aluno, autenticação confirmada (o gestor não mede) | `app`: `manager\|student`; UTMs permitidas |
| `donation_started` | Landing, primeira interação com o formulário | Somente UTMs permitidas |
| `donation_step` | Landing, transição após validação de etapa | `step`: `origin\|contact` (a primeira etapa é `statement`) |
| `donation_error` | Landing, validação, ficheiro, upload ou servidor | `step`: `statement\|origin\|contact`; `category`: `validation\|file_validation\|upload\|rate_limit\|server` (`rate_limit` é o 429; `upload` é sem ligação ou sem resposta a tempo); `field`: `files\|institution\|subject\|exam_type\|class_grade\|school_year\|donor_name\|donor_email\|notes\|consent\|form` (opcional) |
| `donation_submitted` | Landing, resposta HTTP 201 confirmada | Somente UTMs permitidas |
| `consent_choice` | App respetiva, só ao **aceitar** analytics (uma recusa não se mede) | `app`: `manager\|student\|landing`; `choice`: `all` |
| `error_view` | Landing e aluno, páginas 403/404 ou fronteira de erro | `kind`: `forbidden\|not_found\|unexpected`; `app`: `manager\|student\|landing` |
| `scroll_depth` | Landing, ao cruzar um limiar uma vez por montagem da página | `app`: `landing`; `page`: categoria controlada; `depth`: `25\|50\|75\|100` |
| `exam_abandoned` | Aluno, somente após confirmar explicitamente “Sair” no diálogo de saída | `app`: `student` |
| `exam_started` | Aluno, confirmação de início | Sem parâmetros |
| `exam_submitted` | Aluno, entrega confirmada | Sem parâmetros |
| `exam_room_joined` | Aluno, entrada confirmada numa sala | Sem parâmetros |
| `onboarding_completed` | Aluno, matrícula concluída | Sem parâmetros |
| `tutor_used` | Aluno, primeira utilização do tutor na sessão | Sem parâmetros |

## Exemplos

```ts
track('cta_clique', { origem: 'header' });
track('signup_error', { field: 'email', category: 'validation' });
track('donation_error', { step: 'statement', category: 'file_validation', field: 'files' });
track('error_view', { app: 'student', kind: 'unexpected' });
```

Não passar valores de formulário a `track`; parâmetros fora do catálogo não são enviados. A chamada só é aceite se houver consentimento e o nome estiver em `AnalyticsEvent` (`track` não aceita `string` solta); quando o gtag ainda não estiver disponível, fica pendente na fila volátil limitada até inicialização.
