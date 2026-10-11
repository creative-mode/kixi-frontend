// O que um professor (sem ADMIN) vê nas listas do gestor.
//
// A regra espelha o `StatementWriteAccessService.checkCanWrite` do backend: o
// professor vê o que pode escrever, nem mais nem menos. Ficar mais largo que o
// backend mostra provas que ele depois não consegue editar; ficar mais estreito
// esconde-lhe trabalho que é dele.
//
//   turma preenchida           → o par turma+disciplina tem de estar numa
//                                 atribuição dele (`requireTeaches`)
//   sem turma, sem escola      → enunciados antigos do OCR: qualquer professor
//                                 os pode escrever, por isso aparecem
//   sem turma, com escola      → só o ADMIN escreve: ficam de fora
//
// Este filtro corre no browser e não protege dados: `/api/v1/statements` ainda
// devolve tudo a quem é staff (creative-mode/kixi#174). As simulações e as
// respostas já vêm filtradas do servidor; aqui o filtro delas é só a mesma regra
// aplicada de novo, para o mock dar o mesmo resultado que a API.

export interface Assignment {
  classId: number;
  subjectId: number;
}

export interface TeachingScope {
  /** false só para o ADMIN, que vê tudo. */
  restricted: boolean;
  classIds: number[];
  /** As atribuições do professor: o par turma+disciplina que ele dá. */
  assignments: Assignment[];
  /** Enunciados que o professor pode escrever, para mapear as simulações. */
  statementIds: number[];
  /** Simulações cujo enunciado está em `statementIds`. */
  simulationIds: number[];
  /** Porque é que o scope está vazio, quando não foi possível carregá-lo. */
  error: string | null;
}

type Loose = Record<string, unknown>;

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const openScope = (): TeachingScope => ({
  restricted: false,
  classIds: [],
  assignments: [],
  statementIds: [],
  simulationIds: [],
  error: null,
});

/** Nada visível, com a razão para mostrar ao professor. */
export const closedScope = (error: string | null): TeachingScope => ({
  restricted: true,
  classIds: [],
  assignments: [],
  statementIds: [],
  simulationIds: [],
  error,
});

export function assignmentsFrom(rows: Loose[]): Assignment[] {
  const out: Assignment[] = [];
  for (const r of rows) {
    if (r.deletedAt) continue;
    const classId = num(r.classId);
    const subjectId = num(r.subjectId);
    if (classId !== null && subjectId !== null) out.push({ classId, subjectId });
  }
  return out;
}

/** O professor pode escrever este enunciado? Ver a tabela no topo do ficheiro. */
export function teacherCanWrite(assignments: Assignment[], statement: Loose): boolean {
  const classId = num(statement.classId);
  const subjectId = num(statement.subjectId);
  if (classId === null) return num(statement.institutionId) === null;
  // `requireTeaches` deixa passar uma turma sem disciplina; aqui pede-se pelo
  // menos que a turma seja dele.
  if (subjectId === null) return assignments.some((a) => a.classId === classId);
  return assignments.some((a) => a.classId === classId && a.subjectId === subjectId);
}

export function buildScope(assignmentRows: Loose[], statements: Loose[], simulations: Loose[]): TeachingScope {
  const assignments = assignmentsFrom(assignmentRows);
  const statementIds = statements
    .filter((s) => teacherCanWrite(assignments, s))
    .map((s) => num(s.id))
    .filter((n): n is number => n !== null);
  const allowed = new Set(statementIds);
  const simulationIds = simulations
    .filter((sim) => {
      const st = sim.statement as Loose | null | undefined;
      const id = num(st?.id ?? sim.statementId);
      return id !== null && allowed.has(id);
    })
    .map((sim) => num(sim.id))
    .filter((n): n is number => n !== null);
  return {
    restricted: true,
    classIds: [...new Set(assignments.map((a) => a.classId))],
    assignments,
    statementIds,
    simulationIds,
    error: null,
  };
}

// ── filtros das listas ─────────────────────────────────────────────────────
// `null` quer dizer "ainda por resolver": esconde, nunca mostra tudo.

export function classInScope(scope: TeachingScope | null, row: Loose): boolean {
  if (!scope) return false;
  if (!scope.restricted) return true;
  const id = num(row.id);
  return id !== null && scope.classIds.includes(id);
}

/** Decide pela própria linha (turma, disciplina, escola), e não por uma lista
 *  de ids: assim serve a `/statements`, a `/statements/review` e o resto. */
export function statementInScope(scope: TeachingScope | null, row: Loose): boolean {
  if (!scope) return false;
  if (!scope.restricted) return true;
  return teacherCanWrite(scope.assignments, row);
}

export function simulationInScope(scope: TeachingScope | null, row: Loose): boolean {
  if (!scope) return false;
  if (!scope.restricted) return true;
  const id = num(row.id);
  return id !== null && scope.simulationIds.includes(id);
}

export function answerInScope(scope: TeachingScope | null, row: Loose): boolean {
  if (!scope) return false;
  if (!scope.restricted) return true;
  const id = num(row.simulationId);
  return id !== null && scope.simulationIds.includes(id);
}
