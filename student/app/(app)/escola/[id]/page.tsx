import { notFound } from 'next/navigation';
import { RefreshError } from '@/components/refresh-error';
import { SchoolView } from '@/components/school-view';
import { getSchool, getSchoolStatements, getSchoolTeachers } from '@/lib/profiles';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const school = await getSchool(Number((await params).id));
  return { title: `${school.ok ? school.data.name : 'Escola'} · Kixi` };
}

/** O perfil público de uma escola: identidade, selo, números, professores e enunciados. */
export default async function EscolaPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const school = await getSchool(id);
  if (!school.ok) {
    if (school.status === 404) notFound();
    return <RefreshError title="Não foi possível carregar a escola" message={school.message} status={school.status} back={{ href: "/pesquisa", label: "Pesquisar escolas" }} />;
  }
  const [teachers, statements] = await Promise.all([getSchoolTeachers(id), getSchoolStatements(id)]);
  const s = school.data;

  return <SchoolView school={s} teachers={teachers.ok ? teachers.data : []} statements={statements} />;
}
