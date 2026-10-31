import type { RowStatus, SheetStatus, TermSheetDetail, TermSheetRow, TermSheetSummary } from '@/types/term-sheets';

/** Regras de apresentação das pautas, sem React: ficam testáveis com `node --test`. */

export const NOTA_POSITIVA = 10;
export const SEM_NOTA = '—';

/** Uma nota (0 a 20) ou o travessão quando não há nenhuma. Médias levam até duas casas, as notas inteiras nenhuma. */
export function formatGrade(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return SEM_NOTA;
  return value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export const isNegative = (mt: number | null | undefined): boolean => mt !== null && mt !== undefined && mt < NOTA_POSITIVA;

export const ROW_STATUS_LABEL: Record<RowStatus, string> = {
  POSITIVA: 'Positiva',
  NEGATIVA: 'Negativa',
  INCOMPLETA: 'Incompleta',
};

export const SHEET_STATUS_LABEL: Record<SheetStatus, string> = {
  REGISTADA: 'Registada',
  FECHADA: 'Fechada',
  ANULADA: 'Anulada',
};

export const termLabel = (termNumber: number): string => `${termNumber}.º trimestre`;

/** Quem faltou fica incompleto: nenhuma componente é lida como zero. */
export const wasAbsent = (row: Pick<TermSheetRow, 'status' | 'mt'>): boolean => row.status === 'INCOMPLETA' || row.mt === null;

export type SheetFilters = { schoolYear: string; termNumber: string; classId: string; subjectId: string };
export const NO_FILTERS: SheetFilters = { schoolYear: '', termNumber: '', classId: '', subjectId: '' };

export type FilterOptions = {
  schoolYears: string[];
  terms: number[];
  classes: { id: number; label: string }[];
  subjects: { id: number; label: string }[];
};

/** As opções dos filtros saem das pautas que o utilizador pode ver: nunca se oferece uma turma sem pauta. */
export function filterOptions(sheets: readonly TermSheetSummary[]): FilterOptions {
  const classes = new Map<number, string>();
  const subjects = new Map<number, string>();
  for (const s of sheets) {
    classes.set(s.classId, `${s.grade}.ª ${s.className} · ${s.course}`);
    subjects.set(s.subjectId, s.subjectName);
  }
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, 'pt');
  return {
    schoolYears: [...new Set(sheets.map((s) => s.schoolYear))].sort().reverse(),
    terms: [...new Set(sheets.map((s) => s.termNumber))].sort((a, b) => a - b),
    classes: [...classes].map(([id, label]) => ({ id, label })).sort(byLabel),
    subjects: [...subjects].map(([id, label]) => ({ id, label })).sort(byLabel),
  };
}

export function applyFilters(sheets: readonly TermSheetSummary[], f: SheetFilters): TermSheetSummary[] {
  return sheets
    .filter(
      (s) =>
        (!f.schoolYear || s.schoolYear === f.schoolYear) &&
        (!f.termNumber || s.termNumber === Number(f.termNumber)) &&
        (!f.classId || s.classId === Number(f.classId)) &&
        (!f.subjectId || s.subjectId === Number(f.subjectId)),
    )
    .sort((a, b) => b.schoolYear.localeCompare(a.schoolYear) || a.termNumber - b.termNumber || a.subjectName.localeCompare(b.subjectName, 'pt'));
}

/** Só as pautas fechadas são definitivas: as registadas ainda esperam homologação. */
export const isFinal = (s: Pick<TermSheetSummary, 'status'>): boolean => s.status === 'FECHADA';

/** A frase que resume a pauta, para leitores de ecrã e para o cartão da lista. */
export function sheetTitle(s: TermSheetSummary): string {
  return `${s.subjectName} · ${s.grade}.ª ${s.className} · ${termLabel(s.termNumber)}`;
}

/**
 * Para o professor, uma pauta que não existe e uma que não é das suas turmas dão ambas 403 (o backend não revela que existem);
 * o administrador numa pauta inexistente recebe 404. O ecrã trata as duas respostas por igual.
 */
export const SHEET_UNAVAILABLE = 'Pauta não encontrada ou sem acesso.';
export const isUnavailableStatus = (status: number): boolean => status === 403 || status === 404;

/** `GET /term-sheets/{id}` devolve `{ sheet, rows }`; o ecrã trabalha com o resumo e as linhas juntos. Lança se a forma não for essa. */
export function parseDetail(body: unknown): TermSheetDetail {
  const b = body as { sheet?: unknown; rows?: unknown } | null;
  if (!b || typeof b !== 'object' || !b.sheet || typeof b.sheet !== 'object' || !Array.isArray(b.rows)) {
    throw new Error('Resposta da pauta inválida.');
  }
  return { ...(b.sheet as TermSheetSummary), rows: b.rows as TermSheetRow[] };
}
