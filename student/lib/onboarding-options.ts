/** O que o onboarding oferece: só cursos com turmas no ano, e só as turmas do curso escolhido. */
export function onboardingOptions<C extends { id: number }, K extends { schoolYear?: { id?: number } | null; course?: { id?: number } | null }>(
  courses: C[],
  classes: K[],
  yearId: number | null,
  courseId: number | null,
): { courses: C[]; classes: K[] } {
  const forYear = yearId == null ? [] : classes.filter((k) => k.schoolYear?.id === yearId);
  const withClasses = new Set(forYear.map((k) => k.course?.id));
  return {
    courses: courses.filter((c) => withClasses.has(c.id)),
    classes: courseId == null ? [] : forYear.filter((k) => k.course?.id === courseId),
  };
}
