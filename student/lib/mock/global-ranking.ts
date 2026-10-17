// O ranking global do mock (kixi#189, ADR-0013): só os alunos que consentiram, só as escolas com
// alunos suficientes, e cada aluno comparado pelo percentil dentro da própria escola.

/** Uma escola só entra se tiver pelo menos este número de alunos com nota e consentimento. */
export const MIN_STUDENTS_PER_INSTITUTION = 10;

export type Scored = { accountId: number; institutionId: number; average: number };

/** CUME_DIST dentro de cada escola, de 0 a 100: a fração da escola que está a par ou abaixo de mim. */
export function percentiles(rows: Scored[]): Map<number, number> {
  const out = new Map<number, number>();
  const byInstitution = new Map<number, Scored[]>();
  for (const row of rows) byInstitution.set(row.institutionId, [...(byInstitution.get(row.institutionId) ?? []), row]);
  for (const group of byInstitution.values()) {
    for (const row of group) {
      const atOrBelow = group.filter((other) => other.average <= row.average).length;
      out.set(row.accountId, (atOrBelow / group.length) * 100);
    }
  }
  return out;
}

/** Descarta em bloco as escolas abaixo do mínimo: com poucos alunos, um deles seria identificável. */
export function withinFloor(rows: Scored[], floor = MIN_STUDENTS_PER_INSTITUTION): Scored[] {
  const counts = new Map<number, number>();
  for (const row of rows) counts.set(row.institutionId, (counts.get(row.institutionId) ?? 0) + 1);
  return rows.filter((row) => (counts.get(row.institutionId) ?? 0) >= floor);
}

/** Ordena pelo percentil (e pela média no desempate), como o backend; devolve a posição de cada um, 1, 2, 2, 4. */
export function rankGlobal(rows: Scored[], floor = MIN_STUDENTS_PER_INSTITUTION) {
  const kept = withinFloor(rows, floor);
  const pct = percentiles(kept);
  const ordered = kept
    .map((row) => ({ ...row, percentile: pct.get(row.accountId) ?? 0 }))
    .sort((a, b) => b.percentile - a.percentile || b.average - a.average);
  let position = 0;
  let previous: { percentile: number; average: number } | null = null;
  return ordered.map((row, i) => {
    if (!previous || previous.percentile !== row.percentile || previous.average !== row.average) position = i + 1;
    previous = row;
    return { ...row, position };
  });
}

/** Quantas escolas contribuíram para a tabela. */
export const institutionsCounted = (rows: Scored[], floor = MIN_STUDENTS_PER_INSTITUTION) =>
  new Set(withinFloor(rows, floor).map((row) => row.institutionId)).size;
