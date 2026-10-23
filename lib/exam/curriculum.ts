// Que disciplinas e turmas se podem escolher para uma prova: o que o currículo do curso da turma permite
// e, ao professor, só o que lhe está atribuído. Puro, com testes.

export interface Choice { value: number; label: string }
export interface CurriculumChoices {
  /** Todas as disciplinas que algum currículo da escola dá, para a escola inteira. */
  subjects: Choice[];
  classes: Choice[];
  /** turma → disciplinas do currículo dela (curso + classe). */
  curriculum: Record<number, number[]>;
  /** turma+disciplina do professor; null para o administrador. */
  assignments: { classId: number; subjectId: number }[] | null;
}

/** Disciplinas da turma escolhida (ou, sem turma, de qualquer turma), limitadas às que o professor dá. */
export function subjectChoices(c: CurriculumChoices, classId?: number | null): Choice[] {
  return c.subjects.filter((s) => {
    const classes = classId ? [classId] : c.classes.map((k) => k.value);
    return classes.some((k) => (c.curriculum[k] ?? []).includes(s.value) && (!c.assignments || c.assignments.some((a) => a.classId === k && a.subjectId === s.value)));
  });
}

/** Turmas que dão a disciplina escolhida (ou, sem disciplina, todas as permitidas). */
export function classChoices<T extends Choice>(c: Omit<CurriculumChoices, 'classes'> & { classes: T[] }, subjectId?: number | null): T[] {
  return c.classes.filter((k) => {
    if (c.assignments && !c.assignments.some((a) => a.classId === k.value && (!subjectId || a.subjectId === subjectId))) return false;
    return !subjectId || (c.curriculum[k.value] ?? []).includes(subjectId);
  });
}

/** O currículo de uma turma é o do seu curso para a sua classe (CurriculumService.subjectsOfClass no backend):
 *  turmas com o mesmo curso e a mesma classe têm as mesmas disciplinas. Agrupa-as para se pedir o currículo
 *  uma vez por grupo, a uma turma qualquer dele, em vez de uma vez por turma (#389). Uma turma sem curso
 *  fica sozinha no seu grupo. */
export function curriculumGroups(classes: { id: number; courseId: number | null; grade: number | null }[]): { key: string; classId: number; classIds: number[] }[] {
  const groups = new Map<string, { key: string; classId: number; classIds: number[] }>();
  for (const c of classes) {
    const key = c.courseId == null ? `class:${c.id}` : `course:${c.courseId}:grade:${c.grade ?? '-'}`;
    const group = groups.get(key);
    if (group) group.classIds.push(c.id);
    else groups.set(key, { key, classId: c.id, classIds: [c.id] });
  }
  return [...groups.values()];
}

/** Junta os currículos das turmas: o conjunto de disciplinas oferecidas e o mapa turma → disciplinas. */
export function mergeCurricula(perClass: { classId: number; subjects: { subjectId: number; name: string }[] }[]): { subjects: Choice[]; curriculum: Record<number, number[]> } {
  const names = new Map<number, string>();
  const curriculum: Record<number, number[]> = {};
  for (const k of perClass) {
    curriculum[k.classId] = k.subjects.map((s) => s.subjectId);
    for (const s of k.subjects) names.set(s.subjectId, s.name);
  }
  return { subjects: [...names].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, 'pt')), curriculum };
}
