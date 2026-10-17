import Link from 'next/link';
import { Page, PageHeader } from '@/components/page';
import { UserAvatar } from '@/components/user-avatar';
import { VerifiedBadge } from '@/components/verified-badge';
import { Card } from '@/components/ui/card';
import { searchSchools } from '@/lib/profiles';

export const metadata = { title: 'Pesquisar escolas · Kixi' };

export default async function PesquisaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  const result = await searchSchools(q);

  return (
    <Page>
      <PageHeader title="Pesquisar escolas" description="Encontra uma escola pelo nome ou código." />
      <form role="search" action="" className="flex gap-2">
        <label htmlFor="q" className="sr-only">Nome ou código da escola</label>
        <input id="q" name="q" type="search" defaultValue={q} minLength={2} placeholder="Ex.: ITEL" className="h-10 min-w-0 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30" />
        <button type="submit" className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">Pesquisar</button>
      </form>
      {q.length > 0 && q.length < 2 && <p className="text-sm text-muted-foreground">Escreve pelo menos 2 letras.</p>}
      {!result.ok && <p role="alert" className="text-sm text-destructive">{result.message}</p>}
      {result.ok && q.length >= 2 && result.data.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma escola encontrada para «{q}».</p>}
      {result.ok && result.data.length > 0 && (
        <ul className="grid gap-2">
          {result.data.map((s) => (
            <li key={s.id}>
              <Card className="py-0">
                <Link href={`/escola/${s.id}`} className="flex items-center gap-3 rounded-xl p-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40">
                  <UserAvatar name={s.shortName ?? s.name} src={s.logo} size={40} />
                  <span className="grid min-w-0">
                    <span className="flex items-center gap-1 truncate font-medium">{s.name}{s.verified && <VerifiedBadge />}</span>
                    <span className="text-[13px] text-muted-foreground">{s.code}</span>
                  </span>
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
