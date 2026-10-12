// O estilo do tutor (FE-18, #29): o que o professor escreve nas suas atribuições e
// como o tutor o vai ler. Sem `server-only`, para correr no `node --test`.
//
// `previewStyle` é o espelho do `TutorStyleSanitizer` do backend (creative-mode/kixi#116):
// a pré-visualização mostra ao professor exactamente a linha que o tutor recebe, e não
// o texto como ele o escreveu. Se a regra mudar lá, muda aqui também.

/** O limite da coluna `teaching_assignments.tutor_style` e do `@Size` do backend. */
export const TUTOR_STYLE_MAX = 100;

/** Exemplos para quem não sabe por onde começar. Curtos, porque o limite é 100. */
export const TUTOR_STYLE_EXAMPLES = [
  'Explica com exemplos do dia a dia antes da fórmula.',
  'Passo a passo, com frases curtas e uma pergunta no fim.',
  'Começa pela regra geral e só depois resolve o exercício.',
  'Usa analogias com redes e computadores.',
] as const;

const ROLE_MARKERS: [string, string][] = [
  ['system:', 'sistema:'],
  ['assistant:', 'assistente:'],
  ['user:', 'utilizador:'],
  ['<|im_start|>', ''],
  ['<|im_end|>', ''],
  ['<|system|>', ''],
  ['<|user|>', ''],
  ['<|assistant|>', ''],
];

const DELIMITERS = ['---', '###', '«', '»'];

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** A linha que o tutor lê: uma só linha, sem marcadores de papel nem delimitadores, até 100. */
export function previewStyle(raw: string | null | undefined): string {
  if (!raw || !raw.trim()) return '';
  let text = raw.replace(/```[\s\S]*?```/g, ' ').replaceAll('```', ' ');
  for (const [marker, replacement] of ROLE_MARKERS) {
    text = text.replace(new RegExp(`\\s*${escapeRegex(marker)}\\s*`, 'gi'), replacement ? ` ${replacement} ` : ' ');
  }
  for (const delimiter of DELIMITERS) text = text.replaceAll(delimiter, ' ');
  text = text.replace(/\s+/g, ' ').trim();
  return text.length > TUTOR_STYLE_MAX ? text.slice(0, TUTOR_STYLE_MAX).trim() : text;
}

/** O que se envia ao backend: aparado, e `null` quando fica vazio (o backend limpa o estilo). */
export function styleToSave(raw: string): string | null {
  const text = raw.trim();
  return text ? text : null;
}

/** Quantos caracteres faltam, para o contador. Negativo quando passa do limite. */
export function remaining(raw: string): number {
  return TUTOR_STYLE_MAX - raw.trim().length;
}
