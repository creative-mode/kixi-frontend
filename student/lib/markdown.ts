/**
 * Markdown simples para as respostas do tutor (#484).
 *
 * Só o que um modelo escreve numa explicação: parágrafos, títulos, listas, citações, blocos de código,
 * **negrito**, *itálico*, `código`, ligações http(s) e fórmulas em `$...$` / `$$...$$`. Devolve uma árvore,
 * nunca HTML: quem desenha usa elementos do React, por isso o texto do modelo não chega ao DOM como marcação.
 *
 * É tolerante com texto a meio (a resposta chega por partes): um marcador que ainda não fechou fica como texto.
 */

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: Inline[] }
  | { type: 'em'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'math'; latex: string; display: boolean };

export type Block =
  | { type: 'p'; children: Inline[] }
  | { type: 'h'; level: 1 | 2 | 3; children: Inline[] }
  | { type: 'ul'; items: Inline[][] }
  | { type: 'ol'; start: number; items: Inline[][] }
  | { type: 'quote'; children: Inline[] }
  | { type: 'code'; text: string }
  | { type: 'math'; latex: string }
  | { type: 'hr' };

const SAFE_LINK = /^https?:\/\/[^\s<>"']+$/i;

/** Texto corrido → nós. Procura o marcador mais próximo; o que não fecha fica literal. */
export function parseInline(source: string): Inline[] {
  const out: Inline[] = [];
  let buffer = '';
  const flush = () => {
    if (buffer) out.push({ type: 'text', text: buffer });
    buffer = '';
  };
  let i = 0;
  while (i < source.length) {
    const rest = source.slice(i);
    const ch = source[i];

    if (ch === '\\' && i + 1 < source.length && /[\\`*_{}\[\]()#+\-.!$]/.test(source[i + 1])) {
      buffer += source[i + 1];
      i += 2;
      continue;
    }
    if (ch === '`') {
      const end = source.indexOf('`', i + 1);
      if (end > i + 1) {
        flush();
        out.push({ type: 'code', text: source.slice(i + 1, end) });
        i = end + 1;
        continue;
      }
    }
    if (rest.startsWith('$$')) {
      const end = source.indexOf('$$', i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: 'math', latex: source.slice(i + 2, end).trim(), display: true });
        i = end + 2;
        continue;
      }
    }
    if (ch === '$' && !rest.startsWith('$$')) {
      const end = source.indexOf('$', i + 1);
      const body = end > i + 1 ? source.slice(i + 1, end) : '';
      // "$5 e $6" não é fórmula: sem espaço colado aos delimitadores e sem quebra de linha.
      if (body && !/^\s|\s$|\n/.test(body)) {
        flush();
        out.push({ type: 'math', latex: body, display: false });
        i = end + 1;
        continue;
      }
    }
    if (rest.startsWith('\\(') || rest.startsWith('\\[')) {
      const close = rest.startsWith('\\(') ? '\\)' : '\\]';
      const end = source.indexOf(close, i + 2);
      if (end > i + 2) {
        flush();
        out.push({ type: 'math', latex: source.slice(i + 2, end).trim(), display: close === '\\]' });
        i = end + 2;
        continue;
      }
    }
    if (rest.startsWith('**') || rest.startsWith('__')) {
      const mark = rest.slice(0, 2);
      const end = source.indexOf(mark, i + 2);
      if (end > i + 2 && !/^\s/.test(source[i + 2])) {
        flush();
        out.push({ type: 'strong', children: parseInline(source.slice(i + 2, end)) });
        i = end + 2;
        continue;
      }
    }
    if ((ch === '*' || ch === '_') && !rest.startsWith(ch + ch)) {
      const end = source.indexOf(ch, i + 1);
      const wordBefore = ch === '_' && i > 0 && /\w/.test(source[i - 1]);
      if (end > i + 1 && !/^\s/.test(source[i + 1]) && !/\s$/.test(source.slice(i + 1, end)) && !wordBefore) {
        flush();
        out.push({ type: 'em', children: parseInline(source.slice(i + 1, end)) });
        i = end + 1;
        continue;
      }
    }
    if (ch === '[') {
      const match = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(rest);
      if (match && SAFE_LINK.test(match[2])) {
        flush();
        out.push({ type: 'link', href: match[2], children: parseInline(match[1]) });
        i += match[0].length;
        continue;
      }
    }
    buffer += ch;
    i += 1;
  }
  flush();
  return out;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const BULLET = /^\s{0,3}[-*+]\s+(.*)$/;
const ORDERED = /^\s{0,3}(\d{1,3})[.)]\s+(.*)$/;
const RULE = /^\s{0,3}([-*_])(\s*\1){2,}\s*$/;

/** O texto da resposta → blocos. Linhas seguidas do mesmo parágrafo juntam-se; uma linha em branco separa. */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const endParagraph = () => {
    if (paragraph.length) blocks.push({ type: 'p', children: parseInline(paragraph.join(' ').trim()) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];

    if (/^\s*```/.test(line)) {
      endParagraph();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*```/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'code', text: body.join('\n') });
      continue;
    }
    if (/^\s*\$\$\s*$/.test(line)) {
      endParagraph();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i += 1;
      }
      blocks.push({ type: 'math', latex: body.join('\n').trim() });
      continue;
    }
    if (!line.trim()) {
      endParagraph();
      continue;
    }
    const heading = HEADING.exec(line);
    if (heading) {
      endParagraph();
      blocks.push({ type: 'h', level: Math.min(heading[1].length, 3) as 1 | 2 | 3, children: parseInline(heading[2].trim()) });
      continue;
    }
    if (RULE.test(line)) {
      endParagraph();
      blocks.push({ type: 'hr' });
      continue;
    }
    if (/^\s{0,3}>\s?/.test(line)) {
      endParagraph();
      const quoted: string[] = [];
      while (i < lines.length && /^\s{0,3}>\s?/.test(lines[i])) {
        quoted.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
        i += 1;
      }
      i -= 1;
      blocks.push({ type: 'quote', children: parseInline(quoted.join(' ').trim()) });
      continue;
    }
    const bullet = BULLET.exec(line);
    const ordered = ORDERED.exec(line);
    if (bullet || ordered) {
      endParagraph();
      const isOrdered = !!ordered;
      const items: Inline[][] = [];
      const start = ordered ? Number(ordered[1]) : 1;
      while (i < lines.length) {
        const b = BULLET.exec(lines[i]);
        const o = ORDERED.exec(lines[i]);
        if (isOrdered ? !o : !b || RULE.test(lines[i])) break;
        const parts = [(isOrdered ? o![2] : b![1]).trim()];
        // Continuação indentada do mesmo item.
        while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !BULLET.exec(lines[i + 1]) && !ORDERED.exec(lines[i + 1])) {
          i += 1;
          parts.push(lines[i].trim());
        }
        items.push(parseInline(parts.join(' ')));
        i += 1;
      }
      i -= 1;
      blocks.push(isOrdered ? { type: 'ol', start, items } : { type: 'ul', items });
      continue;
    }
    paragraph.push(line.trim());
  }
  endParagraph();
  return blocks;
}
