import { EmptyState } from '@/components/states';
import { OnboardingForm } from '@/components/onboarding-form';
import { RefreshError } from '@/components/refresh-error';
import { apiGet } from '@/lib/api';
import type { Class, Course, Institution, SchoolYear } from '@/lib/types';

/** Three choices, no free text: school, then course, then class, so a new student is
 *  enrolled in well under a minute.
 *
 *  The list narrows as the student goes: /courses?institutionId= and
 *  /classes?institutionId=&courseId= return only that school's (or that course's), so
 *  each step shows what is actually possible rather than everything to be filtered in
 *  the browser.
 *
 *  The school year is not chosen: it is the current one, and each class carries its own,
 *  so the pair sent to POST /enrollments always matches. */
export default async function OnboardingPage() {
  const [institutions, courses, classes, years] = await Promise.all([
    apiGet<Institution[]>('/institutions'),
    apiGet<Course[]>('/courses'),
    apiGet<Class[]>('/classes'),
    apiGet<SchoolYear[]>('/school-years'),
  ]);

  const failed = [institutions, courses, classes, years].find((r) => !r.ok);
  if (failed && !failed.ok) {
    return (
      <RefreshError
        title="Não conseguimos carregar as escolas"
        message={failed.message}
      />
    );
  }

  const allInstitutions = institutions.ok
    ? [...institutions.data].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    : [];
  const allCourses = courses.ok ? courses.data : [];
  const allClasses = classes.ok ? classes.data : [];
  const allYears = years.ok ? years.data : [];

  if (allInstitutions.length === 0) {
    return (
      <EmptyState
        title="Ainda não há escolas"
        message="Nenhuma escola foi cadastrada ainda. Volta mais tarde ou pergunta ao teu professor."
      />
    );
  }

  const current = [...allYears].sort((a, b) => b.startYear - a.startYear)[0];

  // Only the current school year. Without this, a class from a previous year is
  // offered, the student enrolls in it, and POST /enrollments creates an enrollment
  // for a year that has already ended.
  const forYear = current
    ? allClasses.filter((c) => c.schoolYear?.id === current.id)
    : allClasses;

  return (
    <OnboardingForm
      institutions={allInstitutions}
      courses={allCourses}
      classes={forYear}
      yearLabel={current ? `${current.startYear}/${current.endYear}` : undefined}
    />
  );
}
