/**
 * A experiência de um perfil (cronologia por escola e ano lectivo) e o histórico académico de um ano.
 * Sem servidor e sem React, para o `node --test` as cobrir. Só organiza o que o backend devolveu.
 *
 * Contrato: `GET /profiles/accounts/{accountId}/experience` (público, sem notas) e
 * `GET /me/academic-history?schoolYearId=` (só o próprio aluno).
 */

export interface ExperienceEntry {
  schoolYearId: number | null;
  /** Ex.: «2026/2027». */
  schoolYear: string;
  schoolId: number | null;
  school: string;
  /** Aluno: curso e turma/classe. */
  course: string | null;
  className: string | null;
  grade: string | null;
  /** Professor: disciplinas que leccionou nesse ano e escola. */
  subjects: string[];
}

export interface AcademicRecord {
  id: number;
  title: string;
  subject: string | null;
  score: number | null;
  finishedAt: string | null;
}

export interface AcademicYear {
  schoolYearId: number;
  schoolYear: string | null;
  average: number | null;
  records: AcademicRecord[];
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' ? (v as Record<string, unknown>) : {});

/** Aceita uma lista solta ou `{ entries | items | experience: [...] }` e ignora linhas sem escola ou ano. */
export function parseExperience(raw: unknown): ExperienceEntry[] {
  const o = obj(raw);
  const list = Array.isArray(raw) ? raw : (o.entries ?? o.items ?? o.experience ?? o.content);
  if (!Array.isArray(list)) return [];
  const out: ExperienceEntry[] = [];
  for (const item of list) {
    const e = obj(item);
    const classes = Array.isArray(e.classes) ? e.classes.map(obj) : [];
    const school = str(obj(e.institution).name) ?? str(obj(e.school).name) ?? str(e.school) ?? str(e.schoolName) ?? str(e.institution) ?? str(e.institutionName);
    const year = str(obj(e.schoolYear).label) ?? str(e.schoolYear) ?? str(obj(e.schoolYear).name) ?? str(e.schoolYearName) ?? str(e.year);
    if (!school || !year) continue;
    out.push({
      schoolYearId: num(e.schoolYearId) ?? num(obj(e.schoolYear).id),
      schoolYear: year,
      schoolId: num(obj(e.institution).id) ?? num(e.schoolId) ?? num(e.institutionId) ?? num(obj(e.school).id),
      school,
      course: str(obj(e.course).name) ?? str(e.course) ?? str(e.courseName),
      className: (classes.length ? classes.map((c) => str(c.name)).filter(Boolean).join(', ') : null) ?? str(obj(e.class).code) ?? str(e.className) ?? str(e.classCode) ?? str(e.class),
      grade: (classes.length && num(classes[0].grade) !== null ? `${num(classes[0].grade)}.ª classe` : null) ?? str(e.grade) ?? str(e.gradeLevel) ?? str(e.classGrade),
      subjects: Array.isArray(e.subjects) ? e.subjects.map((s) => str(obj(s).name) ?? str(s)).filter((s): s is string => !!s) : [],
    });
  }
  return out;
}

/** O ano lectivo começa no ano da primeira metade: «2026/2027» → 2026; sem ano legível vai para o fim. */
const startYear = (label: string): number => Number(/\d{4}/.exec(label)?.[0] ?? 0);

export interface YearGroup { schoolYear: string; schoolYearId: number | null; entries: ExperienceEntry[] }

/** A cronologia: do ano mais recente para o mais antigo, com as escolas desse ano juntas. */
export function groupByYear(entries: ExperienceEntry[]): YearGroup[] {
  const groups = new Map<string, YearGroup>();
  for (const e of entries) {
    const g = groups.get(e.schoolYear) ?? { schoolYear: e.schoolYear, schoolYearId: e.schoolYearId, entries: [] };
    g.schoolYearId ??= e.schoolYearId;
    g.entries.push(e);
    groups.set(e.schoolYear, g);
  }
  return [...groups.values()].sort((a, b) => startYear(b.schoolYear) - startYear(a.schoolYear));
}

/** Uma linha de uma entrada: «Informática · Turma 12B · 12.ª classe» ou as disciplinas do professor. */
export function entrySummary(e: ExperienceEntry): string {
  const parts = e.subjects.length > 0 ? [e.subjects.join(', ')] : [e.course, e.className ? (/^turma/i.test(e.className) ? e.className : `Turma ${e.className}`) : null, e.grade];
  return parts.filter(Boolean).join(' · ');
}

export function parseAcademicYear(raw: unknown, schoolYearId: number): AcademicYear {
  const o = obj(raw);
  const list = o.exams ?? o.records ?? o.attempts ?? o.results ?? (Array.isArray(raw) ? raw : []);
  const records: AcademicRecord[] = [];
  if (Array.isArray(list)) {
    for (const item of list) {
      const r = obj(item);
      const id = num(r.id) ?? num(r.attemptId);
      const title = str(r.title) ?? str(r.statementTitle) ?? str(r.name);
      if (id === null || !title) continue;
      records.push({ id, title, subject: str(r.subject) ?? str(r.subjectName), score: num(r.score) ?? num(r.grade), finishedAt: str(r.finishedAt) ?? str(r.date) });
    }
  }
  const scores = records.map((r) => r.score).filter((n): n is number => n !== null);
  return {
    schoolYearId,
    schoolYear: str(obj(o.schoolYear).label) ?? str(o.schoolYear) ?? str(obj(o.schoolYear).name),
    average: num(obj(o.totals).average) ?? num(o.average) ?? (scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : null),
    records,
  };
}
