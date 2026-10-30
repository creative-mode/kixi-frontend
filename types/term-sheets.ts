/** Contrato de leitura das pautas (kixi#506): resumos, detalhe por aluno e a vista do próprio aluno. */

export type SheetStatus = 'REGISTADA' | 'FECHADA' | 'ANULADA';
export type RowStatus = 'POSITIVA' | 'NEGATIVA' | 'INCOMPLETA';

export interface TermSheetStats {
  media: number | null;
  avaliados: number;
  inscritos: number;
  ausentes: number;
  positivas: number;
  negativas: number;
  notaMaxima: number | null;
  notaMinima: number | null;
}

export interface TermSheetSummary {
  sheetId: string;
  status: SheetStatus;
  termNumber: number;
  schoolYear: string;
  classId: number;
  className: string;
  grade: number;
  course: string;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  statistics: TermSheetStats;
  updatedAt: string;
}

/** `mac`, `p1`, `p2` e `mt` são `null` quando o aluno faltou: nunca zero. */
export interface TermSheetRow {
  accountId: number;
  number: number;
  name: string;
  mac: number | null;
  p1: number | null;
  p2: number | null;
  mt: number | null;
  status: RowStatus;
  adjusted: boolean;
}

export interface TermSheetDetail extends TermSheetSummary {
  rows: TermSheetRow[];
}
