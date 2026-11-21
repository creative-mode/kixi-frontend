import type { RowStatus, SheetStatus, TermSheetDetail, TermSheetRow, TermSheetSummary } from '@/types/term-sheets';

/** Regras de apresentação das pautas, sem React: ficam testáveis com `node --test`. */

export const NOTA_POSITIVA = 10;

/** O id da pauta entra no caminho do pedido: só aceita o formato que o motor gera (PT-...), nada que mude o caminho. */
export const SHEET_ID = /^[A-Za-z0-9._-]{1,80}$/;
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

export const SEM_DISCIPLINA = 'Sem disciplina';
export const SEM_TURMA = 'Sem turma';
export const SEM_TRIMESTRE = 'Sem trimestre';
export const SEM_ANO_LETIVO = 'Sem ano letivo';

/** «2.º trimestre»; sem número (o motor aceitou uma pauta incompleta) diz-se, em vez de «0.º» ou «null.º». */
export const termLabel = (termNumber: number | null | undefined): string =>
  typeof termNumber === 'number' && Number.isFinite(termNumber) && termNumber > 0 ? `${termNumber}.º trimestre` : SEM_TRIMESTRE;

export const schoolYearLabel = (schoolYear: string | null | undefined): string => schoolYear?.trim() || SEM_ANO_LETIVO;
export const subjectLabel = (s: Pick<TermSheetSummary, 'subjectName'>): string => s.subjectName?.trim() || SEM_DISCIPLINA;

/** «12.ª M · SI»: só as partes que existem; sem nenhuma, «Sem turma». */
export function classLabel(s: Pick<TermSheetSummary, 'grade' | 'className' | 'course'>): string {
  const turma = [s.grade > 0 ? `${s.grade}.ª` : '', s.className].filter(Boolean).join(' ');
  return [turma, s.course].filter(Boolean).join(' · ') || SEM_TURMA;
}

const text = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const nullableNum = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const STATUSES: readonly SheetStatus[] = ['REGISTADA', 'FECHADA', 'ANULADA'];

/**
 * O motor aceita (200) pautas com campos em falta (só o `classId`, por exemplo) e o gestor lê-as todas juntas: uma só pauta
 * incompleta não pode derrubar a lista. Aqui os campos em falta ficam com um valor neutro (texto vazio, 0, sem nota), que os
 * rótulos acima transformam em «Sem disciplina» e afins. Sem `sheetId` não é uma pauta que se possa abrir: devolve `null`.
 * Idempotente: normalizar uma pauta já normalizada (ou completa) não muda nada.
 */
export function normalizeSummary(raw: unknown): TermSheetSummary | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const sheetId = text(r.sheetId).trim();
  if (!sheetId) return null;
  const st = (r.statistics && typeof r.statistics === 'object' ? r.statistics : {}) as Record<string, unknown>;
  return {
    sheetId,
    // Sem estado conhecido trata-se como registada: provisória, nunca definitiva por engano.
    status: STATUSES.includes(r.status as SheetStatus) ? (r.status as SheetStatus) : 'REGISTADA',
    termNumber: num(r.termNumber),
    schoolYear: text(r.schoolYear),
    classId: num(r.classId),
    className: text(r.className),
    grade: num(r.grade),
    course: text(r.course),
    subjectId: num(r.subjectId),
    subjectName: text(r.subjectName),
    subjectCode: text(r.subjectCode),
    statistics: {
      media: nullableNum(st.media),
      avaliados: num(st.avaliados),
      inscritos: num(st.inscritos),
      ausentes: num(st.ausentes),
      positivas: num(st.positivas),
      negativas: num(st.negativas),
      notaMaxima: nullableNum(st.notaMaxima),
      notaMinima: nullableNum(st.notaMinima),
    },
    updatedAt: text(r.updatedAt),
  };
}

const ROW_STATUSES: readonly RowStatus[] = ['POSITIVA', 'NEGATIVA', 'INCOMPLETA'];

/** Uma linha por aluno com campos em falta: sem nota (nunca zero), e «Incompleta» quando o estado não é conhecido. Não-objectos caem. */
export function normalizeRow(raw: unknown): TermSheetRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  return {
    accountId: num(r.accountId),
    number: num(r.number),
    name: text(r.name) || 'Aluno sem nome',
    ...(typeof r.processNumber === 'string' ? { processNumber: r.processNumber } : {}),
    mac: nullableNum(r.mac),
    p1: nullableNum(r.p1),
    p2: nullableNum(r.p2),
    mt: nullableNum(r.mt),
    status: ROW_STATUSES.includes(r.status as RowStatus) ? (r.status as RowStatus) : 'INCOMPLETA',
    adjusted: r.adjusted === true,
  };
}

/** `GET /term-sheets`: uma lista de pautas, cada uma normalizada; o que não é pauta (sem id) deixa-se de fora. Lança se não for uma lista. */
export function parseList(body: unknown): TermSheetSummary[] {
  if (!Array.isArray(body)) throw new Error('Resposta das pautas inválida.');
  return body.map(normalizeSummary).filter((s): s is TermSheetSummary => s !== null);
}

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
export function filterOptions(raw: readonly TermSheetSummary[]): FilterOptions {
  const sheets = raw.map(normalizeSummary).filter((s): s is TermSheetSummary => s !== null);
  const classes = new Map<number, string>();
  const subjects = new Map<number, string>();
  for (const s of sheets) {
    classes.set(s.classId, classLabel(s));
    subjects.set(s.subjectId, subjectLabel(s));
  }
  const byLabel = (a: { label: string }, b: { label: string }) => a.label.localeCompare(b.label, 'pt') || a.label.localeCompare(b.label);
  return {
    // Os anos e os trimestres em falta não entram nas opções: filtrar por «nada» não faz sentido (a pauta continua na lista sem filtro).
    schoolYears: [...new Set(sheets.map((s) => s.schoolYear).filter(Boolean))].sort().reverse(),
    terms: [...new Set(sheets.map((s) => s.termNumber).filter((t) => t > 0))].sort((a, b) => a - b),
    classes: [...classes].map(([id, label]) => ({ id, label })).sort(byLabel),
    subjects: [...subjects].map(([id, label]) => ({ id, label })).sort(byLabel),
  };
}

/** Os que não têm ano ou trimestre vão para o fim; o desempate final pelo id mantém a ordem estável e igual em cada render. */
export function applyFilters(raw: readonly TermSheetSummary[], f: SheetFilters): TermSheetSummary[] {
  const sheets = raw.map(normalizeSummary).filter((s): s is TermSheetSummary => s !== null);
  const termKey = (t: number) => (t > 0 ? t : Number.POSITIVE_INFINITY);
  return sheets
    .filter(
      (s) =>
        (!f.schoolYear || s.schoolYear === f.schoolYear) &&
        (!f.termNumber || s.termNumber === Number(f.termNumber)) &&
        (!f.classId || s.classId === Number(f.classId)) &&
        (!f.subjectId || s.subjectId === Number(f.subjectId)),
    )
    .sort((a, b) => {
      if (a.schoolYear !== b.schoolYear) return !a.schoolYear ? 1 : !b.schoolYear ? -1 : b.schoolYear.localeCompare(a.schoolYear);
      if (a.termNumber !== b.termNumber) return termKey(a.termNumber) < termKey(b.termNumber) ? -1 : 1;
      return subjectLabel(a).localeCompare(subjectLabel(b), 'pt') || a.sheetId.localeCompare(b.sheetId);
    });
}

/** Só as pautas fechadas são definitivas: as registadas ainda esperam homologação. */
export const isFinal = (s: Pick<TermSheetSummary, 'status'>): boolean => s.status === 'FECHADA';

/** A frase que resume a pauta, para leitores de ecrã e para o cartão da lista. */
export function sheetTitle(raw: TermSheetSummary): string {
  const s = normalizeSummary(raw) ?? raw;
  return `${subjectLabel(s)} · ${s.grade > 0 || s.className ? [s.grade > 0 ? `${s.grade}.ª` : '', s.className].filter(Boolean).join(' ') : SEM_TURMA} · ${termLabel(s.termNumber)}`;
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
  const sheet = normalizeSummary(b.sheet);
  if (!sheet) throw new Error('Resposta da pauta inválida.');
  return { ...sheet, rows: b.rows.map(normalizeRow).filter((x): x is TermSheetRow => x !== null) };
}
