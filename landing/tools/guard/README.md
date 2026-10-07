# Ferramentas do sprite do guarda

A cena 403 da landing desenha o guarda a partir de `landing/components/forbidden/guard-sprite.ts`, que sai de um PNG desenhado à mão. Estas scripts servem para refazer esse ficheiro quando o desenho muda.

Corridas a partir de `landing/`:

```bash
node tools/guard/detect-grid.js     # mostra as dimensões e a grelha do PNG
node tools/guard/gen-sprite.js      # regenera components/forbidden/guard-sprite.ts
node tools/guard/png-to-svg.js      # utilitário genérico de PNG para SVG
```

## Atenção: o `gen-sprite.js` não reproduz o ficheiro actual

`gen-sprite.js` emite uma paleta plana de uma cor por caminho. O `guard-sprite.ts` em
`components/forbidden/` foi depois trabalhado à mão em cima dessa saída: tem as regiões
`body`, `eyes`, `feetL` e `feetR` por caixas delimitadoras, que o script não produz.

Ou seja, correr o gerador **sobrescreve e perde** as regiões. Para mexer no desenho:

1. correr `gen-sprite.js` para um ficheiro temporário;
2. portar os caminhos para as regiões, por caixas delimitadoras;
3. rever `forbidden-scene.tsx`, que consome essas regiões para os estados de patrulha,
   olhar e falar.

Se o desenho deixar de precisar de regiões por caixa, vale a pena fazer o script emiti-las
e apagar este aviso.
