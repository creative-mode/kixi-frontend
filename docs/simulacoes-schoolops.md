# Simulações corrigidas em tempo real pelo SchoolOps

Uma simulação é iniciativa do aluno e não tem nada a ver com pautas. O aluno entrega e o resultado só mostra a nota quando o
SchoolOps a corrigiu: as objectivas pelo gabarito e as dissertativas por proximidade ao gabarito (um modelo de linguagem decide e
justifica). Até lá o ecrã diz "A corrigir a tua prova…", sem nota, sem certas e sem veredictos, e actualiza sozinho.

## Como funciona

1. `submeterAction` entrega a simulação no backend e vai para `/resultado?prova=<id>`.
2. A página de resultado vê se a tentativa é uma simulação livre (não aparece em `/exam-rooms/mine`) e chama
   `POST {SCHOOLOPS_URL}/v1/correcoes?aguardar=0`. O pedido é idempotente no motor (cliente, instituição, prova, simulação), por isso
   abrir o resultado outra vez não cria outra correcção e também recupera uma abertura que tenha falhado.
3. `GET /v1/correcoes/{id}` dá o estado. `ACorrigir` volta a ler a cada 3 s, até 5 minutos.
4. Corrigida, a nota é a do motor (0 a 20) e as dissertativas levam os pontos e a justificação. Sem respostas legíveis a correcção
   termina sem nota ("INCOMPLETE") e o ecrã diz isso em vez de mostrar zero.

Uma prova de sala não é simulação: o professor valida e a nota vem da pauta. Se `/exam-rooms/mine` falhar, a tentativa não vai ao motor.

## Configuração (servidor, nunca o browser)

| Variável | Para quê |
|---|---|
| `SCHOOLOPS_URL` | Endereço do motor (`https://schoolops-<hex>.<ip>.sslip.io`). |
| `SCHOOLOPS_CLIENTE_TOKEN` | Token do cliente `kixi` no motor. |
| `SCHOOLOPS_SEGREDO_EVENTOS` | `whsec_...` do cliente, para validar o callback assinado. |
| `SCHOOLOPS_CALLBACK_URL` | Opcional. Por omissão `${APP_ORIGIN}/aluno/api/schoolops/eventos`. |

Sem `SCHOOLOPS_URL` e token a funcionalidade está desligada e o resultado fica como antes. No motor, o domínio do callback tem de estar em
`SCHOOLOPS_CLIENTE_KIXI_CALLBACK_HOSTS`, e o motor precisa de uma conta de serviço do Kixi (`KIXI_USERNAME`, `KIXI_PASSWORD`) para ler o
gabarito e as respostas.

O callback (`/api/schoolops/eventos`) só confirma a entrega: valida a assinatura Standard Webhooks (300 s de tolerância) e responde 204. A
nota chega ao ecrã por leitura, não pelo evento.

## A nota fora do resultado

Com a correcção ligada, a nota de uma simulação livre só aparece no resultado, depois de corrigida. `listSimulationsResult` (histórico,
catálogo, detalhe do enunciado, desempenho) tira a `finalScore` das simulações que não são de sala, e `getCommunityStats` tira
`mine.finalScore` (comparação com a média). Se a lista de salas não se ler, tira a de todas. Sem a correcção ligada nada muda.
