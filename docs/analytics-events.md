# Eventos de analítica (kixi-frontend#219)

Google Analytics, só depois de aceitar os cookies (`lib/consent.ts` e
`components/consent/Consent.tsx`, espelhados na landing e no aluno — o gestor não
tem nenhum destes eventos e por isso não tem analítica). Recusar o banner, ou
bloqueá-lo com um ad-blocker, significa zero pedidos a terceiros: a aplicação não
depende do Google Analytics para nada.

Nenhum evento leva PII: nunca nome, email, texto de resposta, notas de doação ou
qualquer outro texto livre. Os IDs que entram nalgum evento (nenhum, nesta v1) seriam
sempre os IDs internos já existentes, nunca algo que identifique a pessoa por si só.

## Eventos mínimos v1

| Evento | Onde dispara | O que significa |
|---|---|---|
| `sign_up` | `student/app/onboarding/page.tsx`, ao chegar com `?novo=1` | Conta de aluno criada (`student/lib/auth-actions.ts`, `cadastroAction`) |
| `onboarding_completed` | `student/app/(app)/inicio/page.tsx`, ao chegar com `?matriculado=1` | Auto-matrícula concluída (`student/lib/enrollment-actions.ts`, `matricularAction`) — exige o código de `kixi#255` |
| `exam_started` | `student/app/prova/[id]/page.tsx`, ao chegar com `?iniciada=1` | O aluno começou uma prova de treino (`student/lib/exam-actions.ts`, `iniciarAction`) |
| `exam_submitted` | `student/app/(app)/resultado/page.tsx`, ao chegar com `?submetida=1` | O aluno entregou a prova (`student/lib/exam-actions.ts`, `submeterAction`) |
| `exam_room_joined` | `student/app/sala/[id]/page.tsx`, ao chegar com `?entrada=1` | O aluno entrou numa sala de prova controlada (`student/lib/exam-room-actions.ts`, `entrarSalaAction`) |
| `tutor_used` | `student/components/tutor-chat.tsx`, ao abrir a sessão | O aluno enviou a primeira mensagem ao tutor (uma sessão inteira conta como um só uso) |
| `donation_submitted` | `landing/components/donate/DonationForm.tsx`, ao receber `201` | Uma doação de enunciado foi enviada |

## Porque o parâmetro na URL, e não o próprio ecrã

Páginas como `/inicio`, `/prova/[id]` ou `/resultado` são revisitadas em todas as
sessões seguintes — disparar o evento sempre que a página abre contaria "entrou na
turma" ou "começou a prova" uma vez por visita, não uma vez por acontecimento. A
navegação, além disso, vem de um `redirect()` de server action, que não devolve um
resultado ao componente cliente para ele saber que a ação teve sucesso.

Por isso cada ação de servidor acrescenta um parâmetro de uso único ao `redirect()`
só na primeira vez (ex.: `redirect('/inicio?matriculado=1')`), e
`components/analytics/fire-event-once.tsx` lê esse parâmetro no destino, dispara o
evento e limpa a URL com `router.replace` (sem entrada no histórico), para um
refresh manual não o repetir.

## Dashboards v1

Vivem na conta do Google Analytics, não no repositório. Definições:

- **Ativação semanal**: contas com pelo menos um `sign_up` ou `onboarding_completed` nos últimos 7 dias.
- **Funil cadastro → prova**: `sign_up` → `onboarding_completed` → `exam_started` → `exam_submitted`, por semana de coorte.
- **Retenção**: contas com `exam_started` ou `exam_room_joined` em semanas sucessivas depois do `sign_up`.

## Fora de âmbito (nesta v1)

Monitorização de infraestrutura, conteúdo das dashboards de professor (ver
`kixi-frontend#219`), e qualquer evento no gestor — nenhum dos eventos acima
acontece lá.
