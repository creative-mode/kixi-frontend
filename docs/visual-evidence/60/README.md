# #60 — o anel da nota usa a escala, não a cotação em pontos

Evidência do ensaio real: app do aluno (`student`, `KIXI_MOCK=false`) contra o Kixi isolado (`127.0.0.1:19081`) e o motor
SchoolOps com a correcção do `schoolops#60` (`127.0.0.1:18091`). As duas simulações são livres, da Ana, entregues no Kixi.

| Prova | `maximo` (pontos) | Nota do motor (`escala: 20`) | Kixi (`finalScore`) | O anel diz |
|---|---|---|---|---|
| P5 — 20 pontos | 20 | 17,2 | 17,2 / 20 | **17,2 de 20 valores** |
| P6 — 25 pontos | **25** | 14,2 | 17,75 / 25 (= 14,2 × 25 / 20) | **14,2 de 20 valores** |

Antes desta correcção, a P6 mostrava «14,2 de 25»: o anel usava `maximo` como denominador. O `aria-label` do anel lê-se
directamente no `aluno.json` do ensaio (`schoolops#60`, `docs/visual-evidence/60/`), e o mesmo número aparece no carimbo
da folha.

## Ficheiros

- `resultado-20.png`, `resultado-25.png` — o ecrã de resultado completo (anel + folha corrigida).
- `resultado-20-anel.png`, `resultado-25-anel.png` — o anel recortado.
- `resumo.txt` — motor, Kixi e o texto do anel, lado a lado.

A regra está testada em `student/lib/schoolops/correcao-rules.test.ts` («o anel usa a escala da nota (20), nunca a
cotação em pontos da prova»), incluindo o motor antigo sem `escala` e uma escala inválida.
