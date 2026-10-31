/** Regras de apresentação das pautas do aluno, sem React nem rede: testáveis com `node --test`. */

export type RowStatus = 'POSITIVA' | 'NEGATIVA' | 'INCOMPLETA';

/** `GET /me/term-sheets` (kixi#506): a linha do próprio aluno em cada pauta fechada. Notas a `null` = sem nota (faltou), nunca zero. */
export interface MyTermSheet {
  sheetId: string;
  termNumber: number;
  schoolYear: string;
  subjectName: string;
  subjectCode: string;
  className: string;
  row: { mac: number | null; p1: number | null; p2: number | null; mt: number | null; status: RowStatus };
}

export const NOTA_POSITIVA = 10;
export const SEM_NOTA = '—';

export function formatGrade(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return SEM_NOTA;
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const isNegative = (mt: number | null | undefined): boolean => mt !== null && mt !== undefined && mt < NOTA_POSITIVA;

export const STATUS_LABEL: Record<RowStatus, string> = { POSITIVA: 'Positiva', NEGATIVA: 'Negativa', INCOMPLETA: 'Incompleta' };

export const termLabel = (n: number) => `${n}.º trimestre`;

export type TermGroup = { key: string; schoolYear: string; termNumber: number; sheets: MyTermSheet[]; average: number | null };

/** A média das MT do trimestre, só das disciplinas que têm nota; sem nenhuma, não há média (não é zero). */
export function averageOf(sheets: readonly MyTermSheet[]): number | null {
  const marks = sheets.map((s) => s.row.mt).filter((n): n is number => n !== null);
  return marks.length ? Math.round((marks.reduce((a, b) => a + b, 0) / marks.length) * 100) / 100 : null;
}

/** Os trimestres, o ano mais recente primeiro e dentro dele por ordem; as disciplinas por nome. */
export function groupByTerm(list: readonly MyTermSheet[]): TermGroup[] {
  const groups = new Map<string, TermGroup>();
  for (const s of list) {
    const key = `${s.schoolYear}|${s.termNumber}`;
    const g = groups.get(key) ?? { key, schoolYear: s.schoolYear, termNumber: s.termNumber, sheets: [], average: null };
    g.sheets.push(s);
    groups.set(key, g);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, sheets: [...g.sheets].sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'pt')), average: averageOf(g.sheets) }))
    .sort((a, b) => b.schoolYear.localeCompare(a.schoolYear) || a.termNumber - b.termNumber);
}
