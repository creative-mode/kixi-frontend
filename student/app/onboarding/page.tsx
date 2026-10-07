import { EmptyState } from '@/components/states';
import { OnboardingForm } from '@/components/onboarding-form';
import { RefreshError } from '@/components/refresh-error';
import { apiGet } from '@/lib/api';
import type { Class, Course, SchoolYear } from '@/lib/types';

/** Two choices, no free text: the whole screen is two selects so a new student is
 *  enrolled in well under a minute. Courses and classes come from the academic
 *  endpoints; the school year is not chosen, it is the current one, and each class
 *  carries its own so the pair sent to /enrollments always matches. */
export default async function OnboardingPage() {
  const [courses, classes, years] = await Promise.all([
    apiGet<Course[]>('/courses'),
    apiGet<Class[]>('/classes'),
    apiGet<SchoolYear[]>('/school-years'),
  ]);

  const failed = [courses, classes, years].find((r) => !r.ok);
  if (failed && !failed.ok) {
    return (
      <RefreshError
        title="Não conseguimos carregar os cursos"
        message={failed.message}
      />
    );
  }

  const allCourses = [...(courses.ok ? courses.data : [])].sort((a, b) =>
    a.name.localeCompare(b.name, 'pt'),
  );
  const allClasses = classes.ok ? classes.data : [];
  const allYears = years.ok ? years.data : [];

  if (allCourses.length === 0) {
    return (
      <EmptyState
        title="Ainda não há cursos"
        message="A tua escola ainda não publicou cursos. Volta mais tarde ou pergunta ao teu professor."
      />
    );
  }

  const current = [...allYears].sort((a, b) => b.startYear - a.startYear)[0];
  const forYear = current
    ? allClasses
        .filter((c) => c.schoolYear?.id === current.id)
        .sort((a, b) => (a.grade ?? 0) - (b.grade ?? 0) || a.code.localeCompare(b.code, 'pt'))
    : allClasses;

  return (
    <OnboardingForm
      courses={allCourses}
      classes={forYear}
      yearLabel={current ? `${current.startYear}/${current.endYear}` : undefined}
    />
  );
}
