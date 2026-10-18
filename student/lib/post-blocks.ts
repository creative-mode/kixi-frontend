/** Os blocos de uma publicação construída (#388), sem servidor e sem React.
 *
 *  Espelham as regras do backend (creative-mode/kixi#347): o que o construtor deixa enviar é o
 *  que o backend aceita, e o aluno vê o erro antes do pedido em vez de depois. O backend continua
 *  a ser quem decide. */

export type BlockType = 'heading' | 'text' | 'list' | 'callout' | 'formula' | 'image' | 'choice';
export type CalloutTone = 'info' | 'tip' | 'warning';

/** Um bloco tal como o backend o guarda e devolve. */
export interface PostBlock {
  type: BlockType;
  text?: string;
  items?: string[];
  ordered?: boolean;
  tone?: CalloutTone;
  url?: string;
  alt?: string;
  caption?: string;
  correct?: number;
  explanation?: string;
}

/** Um bloco no construtor: o mesmo, com um `key` só para a lista do React. */
export type BlockDraft = PostBlock & { key: string };

/** Os tipos de publicação com construtor. `doubt` e `topic` são os simples, com ou sem blocos. */
export type BuiltKind = 'doubt' | 'topic' | 'study_card' | 'solution' | 'challenge';

export const LIMITS = {
  blocks: 20,
  images: 6,
  totalText: 4000,
  heading: 120,
  text: 2000,
  formula: 300,
  callout: 500,
  item: 200,
  option: 150,
  question: 300,
  caption: 150,
  explanation: 500,
  title: 150,
} as const;

export const BLOCK_LABEL: Record<BlockType, string> = {
  heading: 'Título',
  text: 'Texto',
  list: 'Lista',
  callout: 'Destaque',
  formula: 'Fórmula',
  image: 'Imagem',
  choice: 'Pergunta com opções',
};

export const TONE_LABEL: Record<CalloutTone, string> = { info: 'Nota', tip: 'Dica', warning: 'Atenção' };

export interface Template {
  kind: BuiltKind;
  label: string;
  hint: string;
  /** Os blocos com que o construtor abre. */
  blocks: BlockType[];
}

export const TEMPLATES: Template[] = [
  { kind: 'doubt', label: 'Dúvida com imagem', hint: 'Mostra o exercício e pergunta à turma.', blocks: ['text', 'image'] },
  { kind: 'study_card', label: 'Cartão de estudo', hint: 'Um resumo com pontos-chave e um destaque.', blocks: ['heading', 'text', 'list', 'callout'] },
  { kind: 'solution', label: 'Resolução passo a passo', hint: 'Os passos, as fórmulas e as figuras.', blocks: ['heading', 'text', 'formula', 'text'] },
  { kind: 'challenge', label: 'Desafio', hint: 'Uma pergunta com opções e a explicação.', blocks: ['choice'] },
  { kind: 'topic', label: 'Publicação livre', hint: 'Junta os blocos que quiseres.', blocks: ['text'] },
];

let counter = 0;
const nextKey = () => `b${++counter}`;

export function emptyBlock(type: BlockType): BlockDraft {
  const key = nextKey();
  switch (type) {
    case 'list': return { key, type, items: [''], ordered: false };
    case 'choice': return { key, type, text: '', items: ['', ''], correct: 0, explanation: '' };
    case 'callout': return { key, type, text: '', tone: 'tip' };
    case 'image': return { key, type, url: '', alt: '', caption: '' };
    default: return { key, type, text: '' };
  }
}

export const templateBlocks = (template: Template): BlockDraft[] => template.blocks.map(emptyBlock);

const IMAGE_URL = /^\/uploads\/images\/post\/[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(png|jpe?g|webp)$/i;
export const isPostImage = (url: string | undefined): boolean => !!url && IMAGE_URL.test(url) && !url.includes('..');

const clean = (s: string | undefined) => (s ?? '').trim();

/** Um bloco só entra na publicação se tiver conteúdo: o construtor abre com blocos vazios que o aluno não preencheu. */
export function isFilled(b: PostBlock): boolean {
  switch (b.type) {
    case 'list': return (b.items ?? []).some((i) => clean(i));
    case 'image': return !!clean(b.url);
    case 'choice': return !!clean(b.text) || (b.items ?? []).some((i) => clean(i));
    default: return !!clean(b.text);
  }
}

/** O bloco como vai no pedido: aparado, sem o `key`, sem campos que o tipo não usa e, na lista e nas opções, sem linhas vazias. */
export function toPayload(b: PostBlock): PostBlock {
  const text = clean(b.text);
  switch (b.type) {
    case 'list': return { type: 'list', items: (b.items ?? []).map(clean).filter(Boolean), ordered: !!b.ordered };
    case 'callout': return { type: 'callout', text, tone: b.tone ?? 'info' };
    case 'image': return { type: 'image', url: clean(b.url), ...(clean(b.alt) ? { alt: clean(b.alt) } : {}), ...(clean(b.caption) ? { caption: clean(b.caption) } : {}) };
    case 'choice': {
      const items = (b.items ?? []).map(clean);
      // A opção certa é uma posição: tirar as vazias não pode deslocá-la.
      const right = items[b.correct ?? 0] ? items.slice(0, b.correct ?? 0).filter(Boolean).length : -1;
      return { type: 'choice', text, items: items.filter(Boolean), correct: right, ...(clean(b.explanation) ? { explanation: clean(b.explanation) } : {}) };
    }
    default: return { type: b.type, text };
  }
}

export const payloadOf = (blocks: PostBlock[]): PostBlock[] => blocks.filter(isFilled).map(toPayload);

/** O texto simples dos blocos: o mesmo resumo que o backend guarda em `content`. */
export function summaryOf(blocks: PostBlock[]): string {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.type === 'list') (b.items ?? []).forEach((i) => out.push(`- ${i}`));
    else if (b.type === 'choice') { out.push(b.text ?? ''); (b.items ?? []).forEach((i) => out.push(`- ${i}`)); }
    else if (b.type !== 'image') out.push(b.text ?? '');
  }
  return out.map((s) => s.trim()).filter(Boolean).join('\n').slice(0, 2000).trim();
}

const weight = (b: PostBlock) => (b.text?.length ?? 0) + (b.items ?? []).reduce((n, i) => n + i.length, 0) + (b.explanation?.length ?? 0);

/** O primeiro motivo pelo qual a publicação ainda não pode sair, ou null. Recebe os blocos já limpos (`payloadOf`). */
export function problemOf(kind: BuiltKind, title: string, blocks: PostBlock[]): string | null {
  if (title.trim().length > LIMITS.title) return `O título tem no máximo ${LIMITS.title} caracteres.`;
  if (blocks.length === 0) return 'Preenche pelo menos um bloco.';
  if (blocks.length > LIMITS.blocks) return `Uma publicação tem no máximo ${LIMITS.blocks} blocos.`;
  if (blocks.filter((b) => b.type === 'image').length > LIMITS.images) return `Uma publicação tem no máximo ${LIMITS.images} imagens.`;
  if (blocks.reduce((n, b) => n + weight(b), 0) > LIMITS.totalText) return `O texto tem no máximo ${LIMITS.totalText} caracteres no total.`;
  for (const b of blocks) {
    const text = b.text ?? '';
    const cap = { heading: LIMITS.heading, text: LIMITS.text, formula: LIMITS.formula, callout: LIMITS.callout, choice: LIMITS.question }[b.type as 'heading'];
    if (cap && text.length > cap) return `${BLOCK_LABEL[b.type]}: no máximo ${cap} caracteres.`;
    if (b.type === 'list' && (b.items ?? []).some((i) => i.length > LIMITS.item)) return `Lista: cada linha tem no máximo ${LIMITS.item} caracteres.`;
    if (b.type === 'image' && !isPostImage(b.url)) return 'Escolhe a imagem outra vez: não foi enviada.';
    if (b.type === 'image' && ((b.alt?.length ?? 0) > 150 || (b.caption?.length ?? 0) > LIMITS.caption)) return 'Imagem: a descrição e a legenda têm no máximo 150 caracteres.';
    if (b.type === 'choice') {
      const items = b.items ?? [];
      if (!text) return 'Escreve a pergunta do desafio.';
      if (items.length < 2 || items.length > 5) return 'Um desafio tem de 2 a 5 opções.';
      if (items.some((i) => i.length > LIMITS.option)) return `Cada opção tem no máximo ${LIMITS.option} caracteres.`;
      if (b.correct == null || b.correct < 0 || b.correct >= items.length) return 'Marca qual é a opção certa.';
      if ((b.explanation?.length ?? 0) > LIMITS.explanation) return `A explicação tem no máximo ${LIMITS.explanation} caracteres.`;
    }
  }
  if (kind === 'challenge' && !blocks.some((b) => b.type === 'choice')) return 'Um desafio precisa de uma pergunta com opções.';
  // O backend exige 5 caracteres de texto no resumo; uma imagem sozinha não chega.
  if (summaryOf(blocks).length < 5) return 'Escreve pelo menos 5 caracteres de texto.';
  return null;
}

export function moved<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length || from === to) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}
