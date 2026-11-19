# #794 — a espera lê só o estado

Ensaio com o Kixi do `dev` (com o `correctionStatus`, kixi#609), o motor SchoolOps e a app do aluno com
`KIXI_MOCK=false`. A abertura da correcção passa por um proxy que lhe põe 1,5 s (o «motor lento» da issue); a leitura
do estado vai directa ao motor.

## A rota de estado (`/aluno/api/correcao/status/{id}?simulationId=N`)

```
ok    a rota de estado responde 200
ok    uma leitura quente responde em menos de 1 s        (229 ms; a primeira compila a rota em dev)
ok    devolve só o estado, sem o resultado              ({"kind":"a-corrigir"})
ok    uma simulação que não é do aluno: 403
ok    uma correcção que não existe: 404
ok    motor em baixo: 503 (e não 404)                   (a espera volta a ler)
ok    motor de volta: 200
```

Fonte: [rota.json](rota.json) — os pedidos e os tempos medidos, com a sessão real da aluna.

## O ecrã

- `espera.png` — o ecrã de espera real («A tua prova está a ser corrigida»), com a nota provisória fora.
- `resultado.png` — o resultado que aparece a seguir, já com a nota do motor.

A entrega arranca a correcção em `after()`: a resposta sai imediatamente e o aluno não espera pelo motor. A espera
recebe o `correcaoId` da abertura (ou da URL) e passa a ler só o estado; o `router.refresh()` acontece uma vez, na
transição para o resultado.

> Nota: neste ambiente, o `next dev` servido directamente em `:3100` não correu os efeitos dos componentes de cliente
> (nem o `CookieBanner` hidratou), por isso o polling do ecrã não foi observável no browser. A rota que ele usa foi
> medida com a sessão real, e o ecrã foi fotografado como o servidor o entrega.
