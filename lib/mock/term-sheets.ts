/**
 * As pautas do mock do gestor (kixi#506): dados coerentes com a escola semeada e as regras de acesso do contrato.
 * Puro (recebe o «mundo» por parâmetro): não importa o store, para se testar com `node --test` sem arrancar o mock.
 */

type Roles = readonly string[];
export type MockSheetRow = { accountId: number; number: number; name: string; mac: number | null; p1: number | null; p2: number | null; mt: number | null; status: 'POSITIVA' | 'NEGATIVA' | 'INCOMPLETA'; adjusted: boolean };
export type MockSheet = {
  sheetId: string; status: 'REGISTADA' | 'FECHADA' | 'ANULADA'; termNumber: number; schoolYear: string; classId: number; className: string; grade: number;
  course: string; subjectId: number; subjectName: string; subjectCode: string; updatedAt: string; rows: MockSheetRow[];
};
export type MockWorld = {
  classes: { id: number; code: string; grade: number; course: { code: string; name?: string }; schoolYear: { startYear: number; endYear: number } }[];
  subjects: { id: number; code: string; name: string }[];
  /** A conta do aluno semeado, que aparece como o Nº 1 das pautas da sua turma. */
  studentAccountId: number;
  studentName: string;
};
export type Viewer = { accountId: number; roles: Roles; teacherId?: number | null; assignments: { teacherId: number; classId: number; subjectId: number }[]; enrolledClassId?: number | null };

/** Alunos fictícios de cada turma; a Diana faltou sempre. Os ids ficam acima dos das contas semeadas. */
const PEERS: { accountId: number; name: string; scores: Record<number, [number, number, number]> }[] = [
  { accountId: 9001, name: 'Ana Domingos', scores: { 1: [15, 20, 20], 2: [16, 18, 17], 3: [15, 19, 18] } },
  { accountId: 9002, name: 'Bruno Neto', scores: { 1: [10, 5, 6], 2: [10, 12, 11], 3: [11, 12, 12] } },
  { accountId: 9003, name: 'Carlos Pedro', scores: { 1: [9, 15, 15], 2: [11, 14, 13], 3: [12, 13, 14] } },
];
const ABSENT = { accountId: 9004, name: 'Diana Lopes' };
const STUDENT_SCORES: Record<number, [number, number, number]> = { 1: [14, 13, 15], 2: [13, 15, 14], 3: [16, 15, 17] };

const round = (n: number) => Math.round(n);
const mean = (xs: number[]) => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 100) / 100 : null);

function rowsFor(w: MockWorld, term: number, withStudent: boolean, shift: number): MockSheetRow[] {
  const people = [
    ...(withStudent ? [{ accountId: w.studentAccountId, name: w.studentName, scores: STUDENT_SCORES }] : []),
    ...PEERS,
  ].sort((a, b) => a.name.localeCompare(b.name, 'pt'));
  const present = people.map((p, i) => {
    const [mac, p1, p2] = p.scores[term].map((n) => Math.max(0, Math.min(20, n + shift)));
    const mt = round((mac + p1 + p2) / 3);
    const row: MockSheetRow = { accountId: p.accountId, number: i + 1, name: p.name, mac, p1, p2, mt, status: mt >= 10 ? 'POSITIVA' : 'NEGATIVA', adjusted: false };
    return row;
  });
  // A Diana faltou: fica incompleta, sem nenhuma nota (nunca zero).
  const absent: MockSheetRow = { accountId: ABSENT.accountId, number: present.length + 1, name: ABSENT.name, mac: null, p1: null, p2: null, mt: null, status: 'INCOMPLETA', adjusted: false };
  return [...present, absent];
}

export function buildTermSheets(w: MockWorld): MockSheet[] {
  const klass = (code: string) => w.classes.find((c) => c.code === code);
  const subject = (code: string) => w.subjects.find((s) => s.code === code);
  const plan: { classCode: string; subjectCode: string; term: number; status: MockSheet['status']; withStudent: boolean; shift: number; adjustedNumber?: number }[] = [
    { classCode: '12B', subjectCode: 'RED', term: 1, status: 'FECHADA', withStudent: true, shift: 0 },
    { classCode: '12B', subjectCode: 'RED', term: 2, status: 'FECHADA', withStudent: true, shift: 0, adjustedNumber: 2 },
    { classCode: '12B', subjectCode: 'RED', term: 3, status: 'REGISTADA', withStudent: true, shift: 0 },
    // Uma negativa: o Bruno e o Carlos ficam abaixo de 10.
    { classCode: '12B', subjectCode: 'OGI', term: 1, status: 'FECHADA', withStudent: true, shift: -3 },
    // Anulada pelo motor: nunca se mostra a ninguém, nem ao administrador.
    { classCode: '12B', subjectCode: 'OGI', term: 2, status: 'ANULADA', withStudent: true, shift: 0 },
    { classCode: '11A', subjectCode: 'SO', term: 1, status: 'FECHADA', withStudent: false, shift: 0 },
    { classCode: '10A', subjectCode: 'RED', term: 1, status: 'FECHADA', withStudent: false, shift: 0 },
  ];
  const sheets: MockSheet[] = [];
  for (const [i, p] of plan.entries()) {
    const k = klass(p.classCode);
    const s = subject(p.subjectCode);
    if (!k || !s) continue;
    const rows = rowsFor(w, p.term, p.withStudent, p.shift);
    if (p.adjustedNumber) {
      const r = rows.find((x) => x.number === p.adjustedNumber);
      if (r) r.adjusted = true;
    }
    sheets.push({
      sheetId: `PT-MOCK${String(i + 1).padStart(4, '0')}`, status: p.status, termNumber: p.term, schoolYear: `${k.schoolYear.startYear}/${k.schoolYear.endYear}`,
      classId: k.id, className: k.code, grade: k.grade, course: k.course.name ?? k.course.code, subjectId: s.id, subjectName: s.name, subjectCode: s.code,
      updatedAt: `2026-0${p.term + 1}-1${i}T10:00:00`, rows,
    });
  }
  return sheets;
}

/** `statistics` do contrato, calculadas das linhas: o mock e o resumo nunca se contradizem. */
export function statisticsOf(rows: readonly MockSheetRow[]) {
  const graded = rows.filter((r) => r.mt !== null) as (MockSheetRow & { mt: number })[];
  return {
    media: mean(graded.map((r) => r.mt)), avaliados: graded.length, inscritos: rows.length, ausentes: rows.length - graded.length,
    positivas: graded.filter((r) => r.mt >= 10).length, negativas: graded.filter((r) => r.mt < 10).length,
    notaMaxima: graded.length ? Math.max(...graded.map((r) => r.mt)) : null, notaMinima: graded.length ? Math.min(...graded.map((r) => r.mt)) : null,
  };
}

export const summaryOf = (s: MockSheet) => ({ ...Object.fromEntries(Object.entries(s).filter(([k]) => k !== 'rows')), statistics: statisticsOf(s.rows) });

const has = (roles: Roles, ...r: string[]) => r.some((x) => roles.includes(x));

/** O contrato: ADMIN todas; TEACHER as pautas da turma e disciplina que lecciona; STUDENT nenhuma por aqui (só `/me/term-sheets`). */
export function canReadSheet(v: Viewer, s: Pick<MockSheet, 'classId' | 'subjectId'>): boolean {
  if (has(v.roles, 'ADMIN')) return true;
  if (!has(v.roles, 'TEACHER') || v.teacherId == null) return false;
  return v.assignments.some((a) => a.teacherId === v.teacherId && a.classId === s.classId && a.subjectId === s.subjectId);
}

/** Uma pauta anulada não se mostra a ninguém (kixi#506). */
export const isListable = (s: Pick<MockSheet, 'status'>) => s.status !== 'ANULADA';

export const visibleSheets = (v: Viewer, sheets: readonly MockSheet[]) => sheets.filter((s) => isListable(s) && canReadSheet(v, s));

/**
 * O detalhe de uma pauta, com as respostas do contrato: o professor que não a pode ver recebe 403 quer ela exista ou não (para não
 * revelar as pautas de outras turmas); o administrador numa pauta inexistente (ou anulada) recebe 404.
 */
export function lookupSheet(v: Viewer, sheets: readonly MockSheet[], sheetId: string): { sheet: MockSheet } | { status: 403 | 404 } {
  const found = sheets.find((s) => s.sheetId === sheetId && isListable(s));
  if (has(v.roles, 'ADMIN')) return found ? { sheet: found } : { status: 404 };
  return found && canReadSheet(v, found) ? { sheet: found } : { status: 403 };
}

/** `/me/term-sheets`: só a linha do próprio aluno, só em pautas fechadas, e só da sua turma. */
export function ownSheets(v: Viewer, sheets: readonly MockSheet[]) {
  if (!has(v.roles, 'STUDENT')) return [];
  return sheets
    .filter((s) => isListable(s) && s.status === 'FECHADA' && s.classId === v.enrolledClassId)
    .flatMap((s) => {
      const row = s.rows.find((r) => r.accountId === v.accountId);
      return row ? [{ sheetId: s.sheetId, termNumber: s.termNumber, schoolYear: s.schoolYear, subjectName: s.subjectName, subjectCode: s.subjectCode, className: s.className, row: { mac: row.mac, p1: row.p1, p2: row.p2, mt: row.mt, status: row.status } }] : [];
    });
}
