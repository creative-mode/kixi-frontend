import { EmptyState } from '@/components/states';
import { OnboardingForm } from '@/components/onboarding-form';
import { RefreshError } from '@/components/refresh-error';
import { apiGet } from '@/lib/api';
import { onboardingOptions } from '@/lib/onboarding-options';
import { currentSchoolYear, schoolYearLabel } from '@/lib/school-year';
import type { Class, Course, Institution, SchoolYear } from '@/lib/types';

export const metadata = { title: 'Começar · Kixi' };

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

  // O ano letivo primeiro: só se oferecem escolas, cursos e turmas que têm turmas nesse ano
  // (uma escola sem turmas no ano levava a um passo vazio sem saída).
  const years = await apiGet<SchoolYear[]>('/school-years');
  const year = currentSchoolYear(years.ok ? years.data : []);
  const yearText = year ? schoolYearLabel(year) : undefined;

  const [institutions, allCourses, allClasses] = await Promise.all([
    apiGet<Institution[]>('/institutions', year ? { onlyWithClassesInYear: year.id } : undefined),
    // Asked for as soon as a school is chosen, and never before.
    institutionId === null
      ? Promise.resolve({ ok: true as const, data: [] as Course[] })
      : apiGet<Course[]>('/courses', { institutionId }),
    institutionId === null
      ? Promise.resolve({ ok: true as const, data: [] as Class[] })
      : apiGet<Class[]>('/classes', { institutionId }),
  ]);

  const failed = [institutions, years, allCourses, allClasses].find((r) => !r.ok);
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
        title="Ainda não há turmas abertas"
        message={`Nenhuma escola tem turmas${yearText ? ` no ano letivo ${yearText}` : ''} ainda. Volta mais tarde ou pergunta ao teu professor.`}
      />
    );
  }

  // The browser never receives a class from a year that has already ended, nor a course
  // without classes in the year: the narrowing is on the server.
  const { courses, classes } = onboardingOptions(allCourses.ok ? allCourses.data : [], allClasses.ok ? allClasses.data : [], year?.id ?? null, courseId);

  return (
    <OnboardingForm
      schools={schools}
      courses={courses}
      classes={classes}
      institutionId={institutionId}
      courseId={courseId}
      yearLabel={yearText}
    />
  );
}