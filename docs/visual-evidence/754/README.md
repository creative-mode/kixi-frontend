# #754 — um único tratamento de LaTeX

Evidências do compositor e do feed, com a fórmula `B = \frac{u \cdot i}{2\pi d}`:

- `compositor.png` — o bloco Fórmula com o LaTeX escrito e a pré-visualização ao vivo.
- `previa.png` — a pré-visualização da publicação, igual ao que a turma vê.
- `feed.png` — o cartão publicado no feed, com a fórmula desenhada pelo KaTeX.

O teste `e2e/journeys.spec.ts` («compositor…») verifica que o feed mostra `.katex` e não
`.kixi-math-literal`, e `student/lib/shared/*.test.ts` cobre a normalização e o render.
