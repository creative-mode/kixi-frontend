import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Page, PageHeader } from '@/components/page';
import { RefreshError } from '@/components/refresh-error';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getPerson } from '@/lib/profiles';

export async function generateMetadata({ params }: { params: Promise<{ accountId: string }> }) {
  const person = await getPerson(Number((await params).accountId));
  return { title: `${person.ok ? person.data.displayName : 'Perfil'} · Kixi` };
}

/** O perfil de outra pessoa, como a sua visibilidade deixa ver (#336). */
export default async function PessoaPage({ params }: { params: Promise<{ accountId: string }> }) {
  const id = Number((await params).accountId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const result = await getPerson(id);
  if (!result.ok) {
    if (result.status === 404) notFound();
    return <RefreshError title="Não foi possível carregar o perfil" message={result.message} status={result.status} back={{ href: "/inicio", label: "Início" }} />;
  }
  const p = result.data;
  const teacher = p.kind === 'TEACHER';

  return (
    <Page>
      <PageHeader title={p.displayName} kicker={teacher ? 'Professor' : 'Aluno'} back="/inicio" />
      <section aria-label="Pessoa" className="flex items-center gap-4">
        <UserAvatar name={p.displayName} src={p.photo} size={72} />
        <p className="flex items-center gap-1.5 text-lg font-semibold">
          {p.displayName}
          {p.verified && <VerifiedBadge label="Professor verificado" />}
        </p>
      </section>
      {p.restricted ? (
        <Card><CardContent className="text-sm text-muted-foreground">Esta pessoa escolheu não mostrar mais do que o nome e a foto.</CardContent></Card>
      ) : (
        <>
          {p.level !== null && (
            <Card className="flex-row justify-around gap-0 py-3 text-center">
              <div><p className="text-xl font-bold">{p.level}</p><p className="text-[13px] text-muted-foreground">Nível</p></div>
              <div><p className="text-xl font-bold">{p.xp ?? 0}</p><p className="text-[13px] text-muted-foreground">XP</p></div>
            </Card>
          )}
          <Card>
            <CardHeader><CardTitle>Escolas</CardTitle></CardHeader>
            <CardContent className="grid gap-2">
              {p.schools.length === 0 ? <p className="text-sm text-muted-foreground">Sem escola associada.</p> : p.schools.map((s) => (
                <Link key={s.id} href={`/escola/${s.id}`} className="flex items-center gap-1.5 rounded-md py-1 font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
                  {s.name}{s.verified && <VerifiedBadge />}
                </Link>
              ))}
            </CardContent>
          </Card>
          {p.badges.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Medalhas</CardTitle></CardHeader>
              <CardContent><ul className="flex flex-wrap gap-2 text-sm">{p.badges.map((b) => <li key={b} className="rounded-full bg-secondary px-3 py-1">{b}</li>)}</ul></CardContent>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
