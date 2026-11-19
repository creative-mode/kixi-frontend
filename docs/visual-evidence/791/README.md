# #791 — a nota em todo o lado, com o estado da correcção

Ensaio real: Kixi do `dev` (com o `correctionStatus` do kixi#609) em `127.0.0.1:19081`, motor SchoolOps em `18091` e a app
do aluno com `KIXI_MOCK=false`. Duas simulações livres da Ana, no Kixi:

| Simulação | `finalScore` no Kixi | `correctionStatus` | O que o aluno vê |
|---|---|---|---|
| P5 — 20 pontos | 17,2 (corrigida pelo motor) | `DONE` | «Concluída · 17,2», «Prova corrigida · 17,2 valores» |
| P6 — 25 pontos | 9,75 (só as fechadas) | `PENDING` | «Concluída · A corrigir», «Prova entregue · a corrigir» |

O 9,75 é a nota parcial do backend: **não aparece em nenhum ecrã**. É esse o bug do #791 — o aluno via três notas diferentes
(ou nenhuma) para a mesma prova.

```
ok   Provas: a corrigida mostra a nota 17,2
ok   Provas: a pendente diz «A corrigir»
ok   Provas: a nota parcial (9,75) não aparece
ok   detalhe da pendente: diz «A corrigir»
ok   detalhe da pendente: não mostra 9,75
ok   detalhe da corrigida: mostra 17,2
ok   detalhe da corrigida: não diz que está por corrigir
ok   Notificações: a corrigida diz «com 17,2»
ok   Notificações: a pendente diz «a corrigir»
ok   Notificações: a parcial (9,75) não aparece
nota e estado em todo o lado
```

## Ficheiros

| Ficheiro | O que é |
|---|---|
| `provas.png` | Provas: P6 «Concluída · A corrigir», P5 «Concluída · 17,2»; no painel «Os teus temas» só a P5 conta |
| `detalhe-a-corrigir.png` | Detalhe da P6: «Prova entregue · a corrigir», sem nota parcial |
| `detalhe-corrigida.png` | Detalhe da P5: «Prova corrigida · 17,2 valores» |
| `notificacoes.png` | «Terminaste P6 … — a corrigir» e «Terminaste P5 … com 17,2» |

Cada captura é o ecrã real da app (Chromium sobre a app a falar com o Kixi e o motor reais), não uma maquete.

## O que ficou coberto por teste

- `student/lib/nota-da-simulacao.test.ts` — a regra: `DONE` mostra a nota (incluindo zero), `PENDING`/`IN_PROGRESS` dizem «A corrigir»,
  `FAILED` diz «Correção falhou», e sem estado vale a nota final (prova de sala, backend antigo). Um estado novo do backend não esconde
  a nota: cai na nota final.
- `performance-rules` e `result-rules` — uma tentativa por corrigir não entra no desempenho nem serve de comparação.
- `attempt-history` — `scoreOf` devolve o estado, não a parcial.
- `exam.ts` — deixou de pedir `/exam-rooms/mine` e de esconder a nota; `listSimulationsResult` é uma leitura só por pedido (`cache`),
  partilhada por Provas, detalhe, notificações, desempenho e plano de estudo.
