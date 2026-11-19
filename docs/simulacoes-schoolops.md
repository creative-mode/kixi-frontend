# Simulações corrigidas em tempo real pelo SchoolOps

Uma simulação é iniciativa do aluno e não tem nada a ver com pautas. O aluno entrega e o resultado só mostra a nota quando o
SchoolOps a corrigiu: as objectivas pelo gabarito e as dissertativas por proximidade ao gabarito (um modelo de linguagem decide e
justifica). Até lá o ecrã diz "A corrigir a tua prova…", sem nota, sem certas e sem veredictos, e actualiza sozinho.

## Como funciona

1. `submeterAction` entrega a simulação no backend e, em segundo plano (dentro de um `try/catch` que nunca bloqueia a
   entrega), inicia a correcção no motor com `POST {SCHOOLOPS_URL}/v1/correcoes?aguardar=0`. O pedido é idempotente no
   motor (cliente, instituição, prova, simulação). Se a abertura falhar, a entrega segue sem `correcaoId` e o ecrã de
   resultado volta a pedir a correcção ao abrir. Vai para `/resultado?prova=<id>&submetida=1` (com `&correcaoId=<id>`
   quando a abertura correu bem).
2. A página de resultado vê se a tentativa é uma simulação livre (não aparece em `/exam-rooms/mine`).
   - Com `correcaoId` (entrega #794): lê o estado pela rota leve `GET /aluno/api/correcao/status/{correcaoId}?simulationId=<id>`,
     sem reabrir a página inteira no servidor.
   - Sem `correcaoId` (ecrã aberto antes da entrega, ou o aluno voltou mais tarde): abre a correcção com `correcaoDaSimulacao`
     (idempotente), que também recupera uma abertura que tenha falhado.
   - Se o motor estiver em baixo (`consultarEstadoCorrecao` devolve `null`) com `correcaoId`, **não** se mostra a nota do
     backend como se fosse final: fica "a corrigir" e volta-se a ler.
3. O ecrã de espera (`correcao-em-curso.tsx`) faz polling à rota leve a cada 3 s (até 5 minutos), com `BASE_PATH` e
   `AbortController`. Quando o estado passa a `corrigida`/`incompleta`/`falhou`, faz `router.refresh()` **uma vez** para
   mostrar o resultado. Mostra o erro de polling (`erroPoll`) em vez de o engolir.
4. Corrigida, a nota é a do motor (0 a 20, com uma casa decimal) e as dissertativas levam os pontos e a justificação. O anel usa a
   `escala` do resultado (20) como denominador, nunca o `maximo`, que é a cotação em pontos da prova e pode não somar 20. Sem respostas
   legíveis a correcção termina sem nota ("INCOMPLETE") e o ecrã diz isso em vez de mostrar zero.

Uma prova de sala não é simulação: o professor valida e a nota vem da pauta. Se `/exam-rooms/mine` falhar, a tentativa não vai ao motor.

## Rota de polling (`/api/correcao/status/[correcaoId]`)

Rota leve criada para a espera não reabrir a página inteira a cada leitura (#794). Contrato e semântica:

- **Autenticação/autorização:** o `proxy.ts` garante sessão, mas não liga o `correcaoId` ao aluno. A rota exige
  `?simulationId=<id>` e confirma, via `listSimulationsResult`, que a simulação pertence ao aluno (`getMe` + lista de
  simulações). Sem isto, qualquer aluno com um `correcaoId` alheio leria o estado (e a nota) de outro. **Devolve só o
  estado (`VistaCorrecao`), nunca o resultado completo com justificações.**
- **Respostas:**
  - `200` com `VistaCorrecao` (`{ kind: 'a-corrigir' | 'corrigida' | 'incompleta' | 'falhou' }`), `Cache-Control: no-store`.
  - `400` sem `correcaoId`; `403` sem sessão ou simulação que não é do aluno; `404` correcção inexistente; `503` backend
    indisponível (a lista de simulações não confirmou — não se arrisca).
- **Semântica de falha/retry:** `consultarEstadoCorrecao` a `null` (motor em baixo) é tratado como "a corrigir" no ecrã de
  resultado, não como nota final. O polling distingue `404/403` (pára) de `5xx/503` (continua a tentar).

## Figuras das questões

`getQuestionImagesBatch(questionIds)` carrega as imagens de várias questões em paralelo, com cache de 5 min por
`questionId` (`TtlCache`). Não há endpoint em lote no backend: são N pedidos em paralelo, como já era. A cache é por
`questionId` e salta o `requireQuestion` por utilizador do backend (os IDs vêm do enunciado do aluno).

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

## Como o callback e as repetições funcionam (decisões)

- **Repetições:** o resultado volta a chamar o motor de 3 em 3 segundos enquanto está «a corrigir» (até 5 minutos). O `POST /v1/correcoes` é idempotente por
  (cliente, instituição, prova, simulação), por isso essa leitura é, na prática, a repetição: um motor em baixo uns segundos não perde a correção. Não há
  retry dentro do pedido: duplicaria esse ciclo e alongava a página.
- **Callback (`/api/schoolops/eventos`):** só confirma a entrega, validando a assinatura. A nota chega por leitura, não pelo evento. Não se deduplica o
  `webhook-id` porque o receptor não faz nada com o evento: uma repetição dentro da janela de 300 s é inofensiva. Se o callback passar a notificar o aluno,
  passa a ser preciso deduplicar.
- **Rotação do token do cliente e do segredo de eventos:** o motor aceita dois de cada durante a troca. Procedimento completo no repositório schoolops
  (`deploy/servidor/README.md`, «Rotação do token do cliente e do segredo de eventos»). Do lado do Kixi: trocar `SCHOOLOPS_CLIENTE_TOKEN` e
  `SCHOOLOPS_SEGREDO_EVENTOS` em `/opt/kixi/.env` e recriar o serviço `student`.

## A nota fora do resultado

Com a correcção ligada, a nota de uma simulação livre só aparece no resultado, depois de corrigida. `listSimulationsResult` (histórico,
catálogo, detalhe do enunciado, desempenho) tira a `finalScore` das simulações que não são de sala, e `getCommunityStats` tira
`mine.finalScore` (comparação com a média). Se a lista de salas não se ler, tira a de todas. Sem a correcção ligada nada muda.
