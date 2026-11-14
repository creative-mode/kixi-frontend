/**
 * A forma como o LaTeX e as listas chegam do modelo e dos compositores (#754).
 *
 * O tutor e as publicações recebiam três dialetos: `\(…\)`/`\[…\]` do modelo, `$…$` do compositor e
 * `* item` escrito à mão. Sem uma passagem comum, o `\[…\]` multilinha ficava em bruto e os asteriscos
 * apareciam no ecrã. `normalizeMathMarkdown` deixa tudo no mesmo dialeto antes de renderizar:
 *
 * - `\( x \)` → `$x$` e `\[ x \]` → `$$x$$`;
 * - aspa os `$…$` que o modelo partiu por linhas;
 * - `* item` no início da linha (e listas inline atrás de «…:») → `- item`;
 * - não toca em código: blocos ``` ``` nem `código em linha`.
 */

const MATH_MARKER = /[\\^_{}=+*/<>]|^[a-zA-Z]$/;
const FENCE = /^\s*```/;
const INLINE_CODE = /`[^`\n]*`/g;
const PLACEHOLDER = '\u0001';

function escapedAt(value: string, index: number): boolean {
  let slashes = 0;
  for (let i = index - 1; i >= 0 && value[i] === '\\'; i -= 1) slashes += 1;
  return slashes % 2 === 1;
}

/** Um par `$…$` é fórmula quando tem sinal de LaTeX — «$ 5 e $ 6» é dinheiro e fica como está. */
function looksLikeMath(inner: string): boolean {
  return MATH_MARKER.test(inner.trim());
}

/** `\(…\)` e `\[…\]` são inequívocos: convertem-se sempre, mesmo vazios ou partidos por linhas. */
function normalizeExplicitDelimiters(value: string): string {
  return value
    .replace(/(?<!\\)\\\[([\s\S]*?)(?<!\\)\\\]/g, (_match, body: string) => `$$${body.trim()}$$`)
    .replace(/(?<!\\)\\\(([\s\S]*?)(?<!\\)\\\)/g, (_match, body: string) => `$${body.trim().replace(/\s*\n\s*/g, ' ')}$`);
}

/** Junta os `$…$` que vieram partidos e aspa os espaços encostados aos delimitadores. */
function normalizeDollarSpans(value: string): string {
  let out = '';
  let i = 0;
  while (i < value.length) {
    if (value[i] !== '$' || escapedAt(value, i) || value[i + 1] === '$' || value[i - 1] === '$') {
      out += value[i];
      i += 1;
      continue;
    }
    let end = i + 1;
    while (end < value.length) {
      if (value[end] === '$' && !escapedAt(value, end) && value[end + 1] !== '$' && value[end - 1] !== '$') break;
      end += 1;
    }
    if (end >= value.length) {
      out += value.slice(i);
      break;
    }
    const inner = value.slice(i + 1, end);
    if (!looksLikeMath(inner)) {
      out += value.slice(i, end + 1);
      i = end + 1;
      continue;
    }
    out += `$${inner.trim().replace(/\s*\n\s*/g, ' ')}$`;
    i = end + 1;
  }
  return out;
}

/** Um `*` solto no início da linha, ou uma lista inteira escrita dentro de uma linha («Passos: * a * b»). */
function normalizeBullets(value: string): string {
  return value.split('\n').map((line) => {
    if (/^\s{0,3}\*\s+/.test(line)) return line.replace(/^(\s{0,3})\*(\s+)/, '$1-$2');
    const markers = [...line.matchAll(/ \* (?=\S)/g)];
    if (markers.length < 2 || line.includes('**')) return line;
    const head = line.slice(0, markers[0].index);
    if (!/([:.]\s*)$/.test(head)) return line;
    const [first, ...items] = line.split(/\s+\*\s+/);
    return [first.trimEnd(), ...items.map((item) => `- ${item.trim()}`)].join('\n');
  }).join('\n');
}

function normalizeProse(value: string): string {
  if (!value) return value;
  return normalizeBullets(normalizeDollarSpans(normalizeExplicitDelimiters(value)));
}

/** Normaliza só o que está fora de código; o interior de ``` ``` e de `código` fica byte a byte. */
export function normalizeMathMarkdown(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const out: string[] = [];
  let inFence = false;
  let prose: string[] = [];

  const flushProse = () => {
    if (!prose.length) return;
    out.push(...maskInlineCode(prose.join('\n')).split('\n'));
    prose = [];
  };

  for (const line of lines) {
    if (FENCE.test(line)) {
      flushProse();
      out.push(line);
      inFence = !inFence;
    } else if (inFence) {
      out.push(line);
    } else {
      prose.push(line);
    }
  }
  flushProse();
  return out.join('\n');
}

/** Troca cada `código` por um marcador que sobrevive às transformações e devolve-o no fim. */
function maskInlineCode(value: string): string {
  const masked: string[] = [];
  const protectedValue = value.replace(INLINE_CODE, (code) => {
    masked.push(code);
    return `${PLACEHOLDER}${masked.length - 1}${PLACEHOLDER}`;
  });
  const normalized = normalizeProse(protectedValue);
  return normalized.replace(new RegExp(`${PLACEHOLDER}(\\d+)${PLACEHOLDER}`, 'g'), (_match, index: string) => masked[Number(index)]);
}
