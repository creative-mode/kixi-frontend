import { EmptyState } from '@/components/states';
import { OnboardingForm } from '@/components/onboarding-form';
import { RefreshError } from '@/components/refresh-error';
import { apiGet } from '@/lib/api';
import { currentSchoolYear, schoolYearLabel } from '@/lib/school-year';
import type { Class, Course, Institution, SchoolYear } from '@/lib/types';

type Params = Promise<Record<string, string | string[] | undefined>>;

function one(raw: string | string[] | undefined): number | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** The step lives in the URL, so each one asks the backend only for what it shows.
 *
 *  That is what the review asked for and it also removes the reason the wizard needed
 *  JavaScript: the school and the course are chosen with plain GET forms, and the server
 *  narrows the list, so nothing is filtered in the browser and no class from another
 *  school is ever sent to the client. */
export default async function OnboardingPage({ searchParams }: { searchParams: Params }) {
  const params = await searchParams;
  const institutionId = one(params.escola);
  const courseId = one(params.curso);

  const [institutions, years, courses, classes] = await Promise.all([
    apiGet<Institution[]>('/institutions'),
    apiGet<SchoolYear[]>('/school-years'),
    // Asked for as soon as a school is chosen, and never before.
    institutionId === null
      ? Promise.resolve({ ok: true as const, data: [] as Course[] })
      : apiGet<Course[]>('/courses', { institutionId }),
    // Asked for only once there is a school and a course to narrow by.
    institutionId === null || courseId === null
      ? Promise.resolve({ ok: true as const, data: [] as Class[] })
      : apiGet<Class[]>('/classes', { institutionId, courseId }),
  ]);

  const failed = [institutions, years, courses, classes].find((r) => !r.ok);
  if (failed && !failed.ok) {
    return (
      <RefreshError
        title="Não conseguimos carregar as escolas"
        message={failed.message}
      />
    );
  }

  const schools = institutions.ok
    ? [...institutions.data].sort((a, b) => a.name.localeCompare(b.name, 'pt'))
    : [];

  if (schools.length === 0) {
    return (
      <EmptyState
        title="Ainda não há escolas"
        message="Nenhuma escola foi cadastrada ainda. Volta mais tarde ou pergunta ao teu professor."
      />
    );
  }

  const year = currentSchoolYear(years.ok ? years.data : []);
  const yearText = year ? schoolYearLabel(year) : undefined;

  // The backend has no school-year filter, so the year is applied here, on the server.
  // The browser never receives a class from a year that has already ended, which is the
  // whole point of narrowing on the server.
  const forYear = year ? (classes.ok ? classes.data : []).filter((c) => c.schoolYear?.id === year.id) : [];

  return (
    <OnboardingForm
      schools={schools}
      courses={courses.ok ? courses.data : []}
      classes={forYear}
      institutionId={institutionId}
      courseId={courseId}
      yearLabel={yearText}
    />
  );
}