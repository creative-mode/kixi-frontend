# Analytics e eventos de UX (#517)

As apps gestor, aluno e landing usam o mesmo schema e a mesma fila em memória, compilados localmente em cada app. Analytics só é carregado depois de a pessoa escolher **Aceitar**. A escolha “Só necessários” não é enviada para o Google Analytics; uma recusa não pode ser registada sem violar a própria recusa.

`track(event, params)` devolve `sent`, `queued`, `denied`, `invalid` ou `overflow`. A fila só vive em memória, tem limite de 100 eventos e não persiste em localStorage, cookies ou URL. `FireEventOnce` limpa o marcador da URL somente depois de `sent` ou `queued`; eventos pendentes são enviados quando o gtag está pronto. A configuração envia `send_page_view: false` e define `page_location`/`page_referrer` canónicos também no contexto global do Google tag, antes de o carregar e nas mudanças de página. Nenhuma chamada manual passa uma URL completa.

**Limite da proteção automática:** `send_page_view: false` desliga o page view da configuração inicial, mas não desliga a medição melhorada de alterações no histórico do browser da propriedade GA4. Para garantir que o GA4 não cria page views automáticos em `pushState`, `replaceState` ou `popstate`, a opção **Page changes based on browser history events** deve estar desativada na propriedade (Admin → Data streams → Web stream → Enhanced measurement → Page views → configurações). Esta configuração pertence ao GA4 e não é verificável nem garantida por este repositório. O código fornece apenas contexto de página canónico como defesa adicional; a validação final deve confirmar a opção externa e inspecionar as requisições GA4 no ambiente publicado.

## Privacidade e parâmetros comuns

Nunca enviar email, nome, telefone, password, token, conteúdo de campos, respostas de provas, IDs de utilizador/prova, nome/tamanho/conteúdo de ficheiros, mensagem de exceção ou URL arbitrária. O schema de `track` selecciona explicitamente os parâmetros permitidos e rejeita eventos/parâmetros inválidos. `page_location` e `page_referrer` são produzidos internamente: localização é normalizada para origem + rota canónica, sem query/hash, e referrer é vazio. As UTMs só são incluídas nos eventos explicitamente documentados e só aceitam valores enumerados; termos, conteúdo e outros parâmetros de URL são descartados.

Quando o consentimento não está ativo (`necessary` ou nulo), o contexto global do GA4 é forçado a uma rota neutra (`${origin}/`) com referrer vazio, impedindo que qualquer rota real da aplicação fique exposta no contexto de página do Google tag.

## Consentimento, filas e limites de retirada

- Sem consentimento `all`, `track` devolve `denied`; o carregador GA não é iniciado. `necessary` e consentimento nulo não permitem medições.
- A passagem de `all` para `necessary` ou nulo ativa o bloqueio global `ga-disable-*` **sincronamente**, antes de persistir a escolha ou notificar o React. Limpa a fila da aplicação, remove comandos `event`/`config` ainda não consumidos no `dataLayer` (preservando a referência do array), limpa o contexto global de página do GA4 e apaga cookies `_ga` acessíveis ao JavaScript. Reabrir as definições usa a mesma retirada imediata.
- A fila local nunca é reenviada após retirada. O stub de `gtag` só aceita novos comandos quando o bloqueio local está activo. Ao aceitar novamente, só eventos novos podem ser enviados; os page views e limiares de scroll já contabilizados na mesma montagem não são reiniciados.
- Um pedido GA4 que já tenha sido enviado pela rede antes da retirada não pode ser cancelado ou removido retroactivamente pelo browser. Cookies `HttpOnly` também não são apagáveis por JavaScript. Não há persistência de eventos para tentar reenviá-los.
- O bloqueio `ga-disable-*` impede novos envios do Google tag nesta página, mas a garantia contra page views de medição melhorada continua a depender da configuração da propriedade indicada acima. Verifica também integrações GTM/Google tag externas que possam carregar outros destinos.

## Evitar duplicação de eventos

A alternância de consentimento na mesma página não provoca duplicações indevidas:
- `page_view` é rastreado por rota canónica (`trackedPath`); apenas o primeiro envio por caminho é aceito.
- `scroll_depth` é rastreado por limiar (`depths` Set); cada limiar é enviado uma vez por montagem.
- `FireEventOnce` remove o parâmetro da URL após envio bem-sucedido e usa uma referência de tentativa para evitar execuções repetidas (incluindo modo Strict Mode do React).

A reabertura das definições (consentimento a nulo) desativa imediatamente a medição; eventos já na fila são descartados e não são reenviados ao reaceitar.

## Configuração externa necessária do GA4

A seguinte configuração da propriedade GA4 é obrigatória para a proteção completa de privacidade (não é gerida por este repositório):

- **Admin → Data streams → Web stream → Enhanced measurement → Page views → configurações**: desativar a opção “Page changes based on browser history events” (impedir page views automáticos em `pushState`, `replaceState`, `popstate`).
- Verificar se não há integrações GTM/Google tag externas que carreguem outros destinos de medição.

## Catálogo de eventos

| Evento | Aplicação e quando | Parâmetros permitidos |
|---|---|---|
| `page_view` | As três apps, em navegação/visita com consentimento | `app`: `manager\|student\|landing`; `page`: categoria controlada por app (`home`, `donation`, `privacy`, `cookies`, `login`, `signup`, `onboarding`, `student_home`, `exam`, `result`, `room`, `dashboard`, `forbidden`, `not_found`, `other`); UTMs permitidas acima |
| `cta_click` | Landing/aluno, clique em CTA de criar conta/entrar | `surface`: `header\|hero\|faq\|footer\|auth_form\|forbidden\|not_found`; `destination`: `signup\|login` |
| `signup_started` | Aluno, primeira interação no formulário de cadastro | `surface`: `signup_form` |
| `signup_error` | Aluno, validação local ou falha do servidor | `field`: `first_name\|last_name\|username\|email\|password\|confirm\|form`; `category`: `validation\|server` |
| `sign_up` | Aluno, cadastro confirmado após redirect | Somente UTMs permitidas |
| `login_success` | Gestor/aluno, autenticação confirmada | `app`: `manager\|student`; UTMs permitidas |
| `donation_started` | Landing, primeira interação com o formulário | Somente UTMs permitidas |
| `donation_step` | Landing, transição após validação de etapa | `step`: `origin\|contact` (a primeira etapa é `statement`) |
| `donation_error` | Landing, validação, ficheiro, upload ou servidor | `step`: `statement\|origin\|contact`; `category`: `validation\|file_validation\|upload\|server`; `field`: `files\|institution\|subject\|exam_type\|class_grade\|school_year\|donor_name\|donor_email\|notes\|consent\|form` (opcional) |
| `donation_submitted` | Landing, resposta HTTP 201 confirmada | Sem parâmetros |
| `consent_choice` | App respetiva, após aceitar analytics | `app`: `manager\|student\|landing`; `choice`: `all`. Recusa/necessários não são reportados |
| `error_view` | As três apps, páginas 403/404 ou fronteira de erro global | `kind`: `forbidden\|not_found\|unexpected`; `app`: `manager\|student\|landing` |
| `scroll_depth` | Landing, ao cruzar um limiar uma vez por montagem da página | `app`: `landing`; `page`: categoria controlada; `depth`: `25\|50\|75\|100` |
| `exam_abandoned` | Aluno, somente após confirmar explicitamente “Sair” no diálogo de saída | `app`: `student` |
| `exam_started` | Aluno, confirmação de início | Sem parâmetros |
| `exam_submitted` | Aluno, entrega confirmada | Sem parâmetros |
| `exam_room_joined` | Aluno, entrada confirmada numa sala | Sem parâmetros |
| `onboarding_completed` | Aluno, matrícula concluída | Sem parâmetros |
| `tutor_used` | Aluno, primeira utilização do tutor na sessão | Sem parâmetros |

## Exemplos

```ts
track('cta_click', { surface: 'hero', destination: 'signup' });
track('signup_error', { field: 'email', category: 'validation' });
track('donation_error', { step: 'statement', category: 'file_validation', field: 'files' });
track('error_view', { app: 'student', kind: 'unexpected' });
```

Não passar valores de formulário a `track`; parâmetros fora do catálogo não são enviados. A chamada só é aceite se houver consentimento e, quando o gtag ainda não estiver disponível, fica pendente na fila volátil limitada até inicialização.
