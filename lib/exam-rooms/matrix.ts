/** A matriz da prova (matriz de especificação): os temas que saem, quantas questões e que cotação tem cada um, numa
 *  escala de 20 valores. É o que o professor carrega para uma prova agendada e o que o aluno vê em «Prepara-te para a
 *  prova». Regras puras, sem rede, para o `node --test` as alcançar. O contrato é o do backend (`/exam-rooms/{id}/matrix`). */

export const LEVELS = [
  { value: 'KNOWLEDGE', label: 'Conhecimento' },
  { value: 'COMPREHENSION', label: 'Compreensão' },
  { value: 'APPLICATION', label: 'Aplicação' },
  { value: 'ANALYSIS', label: 'Análise' },
] as const;

export type Level = (typeof LEVELS)[number]['value'];

/** Uma linha da matriz no editor: os números ficam em texto até se guardar, para o campo aceitar «4,5» a meio. */
export interface MatrixRow {
  /** Só para a chave do React; não vai para o servidor. */
  key: string;
  topic: string;
  count: string;
  points: string;
  level: Level | '';
}

export interface MatrixDraft {
  title: string;
  totalPoints: string;
  rows: MatrixRow[];
}

/** O corpo do `PUT /exam-rooms/{id}/matrix`. */
export interface MatrixPayload {
  title?: string;
  totalPoints: number;
  items: { topicName: string; questionCount: number; points?: number; cognitiveLevel?: Level }[];
}

/** A matriz como o servidor a devolve. */
export interface MatrixView {
  roomId: number;
  title: string | null;
  totalPoints: number;
  items: { id: number; topicId: number; topicName: string; questionCount: number; points: number | null; cognitiveLevel: Level | null }[];
}

const TOLERANCE = 0.01;

/** «4,5» e «4.5» são o mesmo número; texto vazio ou lixo é NaN, nunca zero. */
export function parseNumber(text: string): number {
  const clean = text.trim().replace(',', '.');
  return clean === '' ? Number.NaN : Number(clean);
}

/** Sem acentos e em minúsculas: «Aplicação» e «aplicacao» são o mesmo nível, «Sub-redes» e «sub redes» o mesmo tema. */
export function fold(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[\s-]+/g, ' ');
}

const LEVEL_WORDS: Record<string, Level> = {
  conhecimento: 'KNOWLEDGE', knowledge: 'KNOWLEDGE', memorizacao: 'KNOWLEDGE',
  compreensao: 'COMPREHENSION', comprehension: 'COMPREHENSION',
  aplicacao: 'APPLICATION', application: 'APPLICATION',
  analise: 'ANALYSIS', analysis: 'ANALYSIS',
};

export function levelFrom(text: string): Level | '' {
  return LEVEL_WORDS[fold(text)] ?? '';
}

let counter = 0;
export const newRow = (extra: Partial<MatrixRow> = {}): MatrixRow => ({ key: `r${++counter}`, topic: '', count: '', points: '', level: '', ...extra });

export const emptyDraft = (): MatrixDraft => ({ title: '', totalPoints: '20', rows: [newRow(), newRow()] });

const num = (n: number | null | undefined) => (n == null ? '' : String(n).replace('.', ','));

/** A matriz guardada, como rascunho para editar. */
export function draftFrom(view: MatrixView | null): MatrixDraft {
  if (!view) return emptyDraft();
  return {
    title: view.title ?? '',
    totalPoints: num(view.totalPoints),
    rows: view.items.map((i) => newRow({ topic: i.topicName, count: num(i.questionCount), points: num(i.points), level: i.cognitiveLevel ?? '' })),
  };
}

export interface MatrixTotals {
  questions: number;
  points: number;
  /** Quanto falta (positivo) ou sobra (negativo) para a escala da prova. */
  remaining: number;
}

export function totalsOf(draft: MatrixDraft): MatrixTotals {
  let questions = 0;
  let points = 0;
  for (const row of draft.rows) {
    const q = parseNumber(row.count);
    const p = parseNumber(row.points);
    if (Number.isFinite(q)) questions += q;
    if (Number.isFinite(p)) points += p;
  }
  const scale = parseNumber(draft.totalPoints);
  return { questions, points: Math.round(points * 100) / 100, remaining: Number.isFinite(scale) ? Math.round((scale - points) * 100) / 100 : Number.NaN };
}

/** Linhas vazias não contam: o professor deixa linhas em branco no fim do editor. */
const blank = (row: MatrixRow) => row.topic.trim() === '' && row.count.trim() === '' && row.points.trim() === '';

/** O que impede de guardar, por extenso e por ordem; vazio quando a matriz está pronta. */
export function problemsOf(draft: MatrixDraft): string[] {
  const out: string[] = [];
  const scale = parseNumber(draft.totalPoints);
  if (!Number.isFinite(scale) || scale <= 0) out.push('Indica a escala da prova, por exemplo 20 valores.');
  const rows = draft.rows.filter((r) => !blank(r));
  if (rows.length === 0) out.push('Acrescenta pelo menos um tema.');
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const at = `Linha ${i + 1}`;
    const key = fold(row.topic);
    if (key === '') out.push(`${at}: falta o tema.`);
    else if (seen.has(key)) out.push(`${at}: o tema «${row.topic.trim()}» já está na matriz.`);
    seen.add(key);
    const q = parseNumber(row.count);
    if (!Number.isInteger(q) || q < 1) out.push(`${at}: indica quantas questões saem (um número inteiro, pelo menos 1).`);
    if (row.points.trim() !== '') {
      const p = parseNumber(row.points);
      if (!Number.isFinite(p) || p <= 0) out.push(`${at}: a cotação tem de ser um número maior que zero.`);
    }
  });
  const withPoints = rows.filter((r) => r.points.trim() !== '');
  if (withPoints.length > 0) {
    if (withPoints.length < rows.length) out.push('Ou todos os temas têm cotação, ou nenhum.');
    else if (Number.isFinite(scale)) {
      const { points } = totalsOf({ ...draft, rows });
      if (Math.abs(points - scale) > TOLERANCE) out.push(`As cotações somam ${num(points)} e a prova vale ${num(scale)}.`);
    }
  }
  return out;
}

/** O corpo para o servidor; só chamar com `problemsOf` vazio. */
export function payloadOf(draft: MatrixDraft): MatrixPayload {
  const rows = draft.rows.filter((r) => !blank(r));
  return {
    ...(draft.title.trim() ? { title: draft.title.trim() } : {}),
    totalPoints: parseNumber(draft.totalPoints),
    items: rows.map((row) => ({
      topicName: row.topic.trim(),
      questionCount: parseNumber(row.count),
      ...(row.points.trim() !== '' ? { points: parseNumber(row.points) } : {}),
      ...(row.level ? { cognitiveLevel: row.level } : {}),
    })),
  };
}

export const CSV_TEMPLATE = 'tema;questões;cotação;nível\nEndereçamento IP;3;6;Aplicação\nSub-redes;3;7;Aplicação\nModelo OSI;2;4;Conhecimento\nProtocolos de rede;2;3;Compreensão\n';

/**
 * Lê uma matriz de texto (CSV ou colada do Excel): `tema;questões;cotação;nível`, com `;`, `,` ou tabulação, cabeçalho
 * opcional e linhas vazias ignoradas. Devolve as linhas para o professor rever no editor e os erros por linha: nada
 * é guardado só por ter sido importado.
 */
export function parseMatrixText(text: string): { rows: MatrixRow[]; errors: string[] } {
  const rows: MatrixRow[] = [];
  const errors: string[] = [];
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  lines.forEach((raw, index) => {
    if (raw.trim() === '') return;
    const sep = raw.includes(';') ? ';' : raw.includes('\t') ? '\t' : ',';
    // Com «,» como separador, uma cotação «4,5» já não cabe: só se trata assim quando não há «;» nem tabulação.
    const cells = raw.split(sep).map((c) => c.trim());
    const [topic = '', count = '', points = '', level = ''] = cells;
    const first = fold(topic);
    if (rows.length === 0 && errors.length === 0 && (first === 'tema' || first === 'conteudo' || first === 'unidade tematica') && Number.isNaN(parseNumber(count))) return;
    const at = `Linha ${index + 1}`;
    if (topic === '') return void errors.push(`${at}: falta o tema.`);
    const q = parseNumber(count);
    if (!Number.isInteger(q) || q < 1) return void errors.push(`${at}: «${count}» não é um número de questões.`);
    if (points !== '' && !(parseNumber(points) > 0)) return void errors.push(`${at}: «${points}» não é uma cotação.`);
    if (level !== '' && levelFrom(level) === '') return void errors.push(`${at}: o nível «${level}» não existe (conhecimento, compreensão, aplicação ou análise).`);
    rows.push(newRow({ topic, count: String(q), points: points.replace('.', ','), level: levelFrom(level) }));
  });
  return { rows, errors };
}
