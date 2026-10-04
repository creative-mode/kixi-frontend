'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, FileSearch } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KixiLogo } from '@/components/kixi-logo';
import { dashboardCounts } from '@/app/actions/crud';
import { fetchCurrentUser } from '@/lib/auth';
import { ENTITIES, NAV_KEYS } from '@/lib/crud/entities';

export default function ManagerDashboard() {
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    dashboardCounts().then((r) => (r.ok ? setCounts(r.data) : setError(r.error)));
    fetchCurrentUser().then((u) => setRole(u?.roles?.[0] ?? null));
  }, []);

  const value = (n?: number) => (counts == null ? '—' : n == null || n < 0 ? '!' : String(n));
  const review = counts?.review ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-pixel text-2xl leading-tight tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Bem-vindo ao painel de gestão do Kixi{role ? ` · ${role.toLowerCase()}` : ''}.
          </p>
        </div>
        <KixiLogo size={48} className="hidden md:inline-flex" />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {review > 0 ? (
        <Link href="/statements" className="flex items-center gap-4 rounded-[4px] border-2 border-tiro-edge bg-tiro-tint p-4 text-tiro-ink transition-colors hover:brightness-105">
          <FileSearch size={22} />
          <span className="font-semibold">
            {review} {review === 1 ? 'enunciado espera' : 'enunciados esperam'} revisão
          </span>
          <ArrowRight size={16} className="ml-auto" />
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
        {NAV_KEYS.map((k) => {
          const e = ENTITIES[k];
          const Icon = e.icon;
          return (
            <Link key={k} href={`/${e.path}`} className="group">
              <Card className="h-full transition-colors group-hover:border-primary">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{e.plural}</CardTitle>
                  <div className={`flex h-8 w-8 items-center justify-center rounded-[4px] border-2 border-current/40 ${e.tone}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="font-pixel text-2xl leading-tight text-foreground">{value(counts?.[k])}</div>
                  <p className="mt-1 text-xs text-muted-foreground">ativos</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
