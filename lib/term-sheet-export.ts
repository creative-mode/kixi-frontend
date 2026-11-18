import type { Role } from '@/lib/roles';
import type { Assessment, TermPlan } from '@/types/term-plans';
import type { TermSheetSummary } from '@/types/term-sheets';

/**
 * Exportar a pauta em PDF (kixi-frontend#808), sem React: quem pode, que plano do trimestre é o da pauta, que nome leva o
 * ficheiro e que frase se mostra quando o backend recusa. O PDF é do motor; o gestor só o passa ao browser (kixi#622).
 */

/** Quem exporta é quem lê a pauta no gestor: o professor da turma, o coordenador e o ADMIN. O aluno nunca vê o botão. */
export function canExportSheets(roles: readonly Role[]): boolean {
  return roles.includes('ADMIN') || roles.includes('TEACHER') || roles.includes('COORDINATOR');
}

/** A pauta anulada não tem PDF que valha: o botão fica desativado com o motivo. */
export function exportBlockedReason(sheet: Pick<TermSheetSummary, 'status'>): string | null {
  return sheet.status === 'ANULADA' ? 'Pauta anulada: não há PDF para exportar.' : null;
}

/** Registada é provisória: ainda espera a homologação. */
export const isProvisional = (sheet: Pick<TermSheetSummary, 'status'>): boolean => sheet.status === 'REGISTADA';

type PlanKey = Pick<TermPlan, 'classId' | 'subjectId' | 'termNumber' | 'pautaRef'>;

/**
 * O backend exporta por plano do trimestre e a pauta conhece-se pelo id do motor. O plano certo é o que abriu essa pauta
 * (`pautaRef`); sem ele, o da mesma turma, disciplina e trimestre. A turma é de um só ano letivo, por isso estes três
 * bastam, mas só se houver exatamente um: na dúvida não se adivinha.
 */
export function planForSheet<P extends PlanKey>(sheet: Pick<TermSheetSummary, 'sheetId' | 'classId' | 'subjectId' | 'termNumber'>, plans: readonly P[]): P | null {
  const same = plans.filter((p) => p.classId === sheet.classId && p.subjectId === sheet.subjectId);
  const byRef = same.find((p) => p.pautaRef === sheet.sheetId);
  if (byRef) return byRef;
  const byTerm = same.filter((p) => p.termNumber === sheet.termNumber);
  return byTerm.length === 1 ? byTerm[0] : null;
}

/** As provas com resultado para exportar: as que têm enunciado (o motor conhece-as por ele) e não foram dispensadas. */
export function exportableAssessments<A extends Pick<Assessment, 'kind' | 'seq' | 'statementId' | 'status'>>(assessments: readonly A[]): A[] {
  const order: Record<string, number> = { MAC: 0, P1: 1, P2: 2 };
  return assessments
    .filter((a) => a.statementId !== null && a.status !== 'DISPENSED')
    .sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9) || a.seq - b.seq);
}

/** Uma parte do nome do ficheiro: sem acentos, minúsculas, só letras, algarismos e hífenes. */
export function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type NameSheet = Pick<TermSheetSummary, 'status' | 'subjectName' | 'grade' | 'className' | 'termNumber' | 'schoolYear'>;

/** A turma como se lê na escola: «12B». O código da turma às vezes já traz a classe à frente, e não se repete. */
const classPart = (s: Pick<TermSheetSummary, 'grade' | 'className'>): string =>
  s.className.startsWith(String(s.grade)) ? s.className : `${s.grade}${s.className}`;

/** `pauta-redes-12b-1t-2025-2026.pdf`, ou `resultado-p1-…` para uma prova; `-provisoria` quando ainda não está homologada. */
export function exportFileName(sheet: NameSheet, assessment?: { title: string } | null): string {
  const parts = [
    assessment ? `resultado-${slug(assessment.title)}` : 'pauta',
    slug(sheet.subjectName),
    slug(classPart(sheet)),
    `${sheet.termNumber}t`,
    slug(sheet.schoolYear),
    isProvisional(sheet) ? 'provisoria' : '',
  ];
  return `${parts.filter(Boolean).join('-')}.pdf`;
}

/** `Content-Disposition` com o nome em ASCII (o slug já o é) e em UTF-8, para os browsers que leem um ou o outro. */
export const attachmentHeader = (fileName: string): string => `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;

/** O nome que o servidor do gestor deu ao ficheiro, ou o de reserva. */
export function fileNameFrom(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* cai no nome simples */
    }
  }
  const plain = disposition.match(/filename="([^"]+)"/i);
  return plain ? plain[1] : fallback;
}

export const NO_PLAN = 'Esta pauta ainda não está ligada a um plano do trimestre: não há PDF para exportar.';
export const NO_PDF_YET = 'O PDF desta pauta ainda não existe. Volte a tentar depois de a pauta ser homologada.';
export const NO_STATEMENT = 'Esta prova ainda não tem enunciado, por isso não há resultado para exportar.';
export const ENGINE_DOWN = 'O motor das pautas está indisponível neste momento. Tente mais tarde.';
export const BAD_LINK = 'O motor devolveu uma ligação inválida ou já expirada. Exporte de novo.';

/**
 * A frase para cada recusa do backend (kixi#622). O corpo vem em inglês e pode trazer pormenores do motor, por isso nunca
 * se mostra tal e qual: só se usa para distinguir os 409.
 */
export function exportErrorMessage(status: number, body = ''): string {
  if (status === 401) return 'Sessão expirada. Inicie sessão novamente.';
  if (status === 403) return 'Sem permissão para exportar esta pauta.';
  if (status === 404) return 'Pauta ou prova não encontrada.';
  if (status === 409) {
    if (/no statement/i.test(body)) return NO_STATEMENT;
    return NO_PDF_YET;
  }
  if (status === 502) return BAD_LINK;
  if (status === 503 || status === 504) return ENGINE_DOWN;
  return `Não foi possível exportar o PDF (erro ${status}). Tente novamente.`;
}
