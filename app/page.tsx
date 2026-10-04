'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  BookOpenCheck,
  CheckCheck,
  Clock,
  ArrowRight,
  FileSearch,
  GraduationCap,
  Plus,
  RefreshCw,
  Target,
  Users,
} from 'lucide-react';
import { getDashboard } from '@/app/actions/analytics';
import { dashboardCounts } from '@/app/actions/crud';
import { ENTITIES, NAV_KEYS } from '@/lib/crud/entities';
import { ActivityChart } from '@/components/dashboard/activity-chart';
import { AttentionPanel } from '@/components/dashboard/attention-panel';
import { ClassesTable } from '@/components/dashboard/classes-table';
import { InstitutionPanel } from '@/components/dashboard/institution-panel';
import { KpiCard } from '@/components/dashboard/kpi-card';
import { SectionState } from '@/components/dashboard/section-state';
import { StatementsTable } from '@/components/dashboard/statements-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { formatDuration, formatInt, formatPercent } from '@/lib/format';
import type { Dashboard } from '@/types/analytics';

const PERIODS = [7, 30, 90] as const;
const REFRESH_MS = 60_000;

export default function ManagerDashboard() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<Dashboard | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  // Only the latest request may write state, so a slow response for an old period cannot overwrite a newer one.
  const requestId = useRef(0);

  const load = useCallback(async () => {
    const mine = ++requestId.current;
    setRefreshing(true);
    try {
      const result = await getDashboard(days);
      if (mine === requestId.current) setData(result);
    } catch (err) {
      // getDashboard reports per-section failures itself; reaching here means the session is gone.
      console.error('[dashboard]', err);
    } finally {
      if (mine === requestId.current) setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep the numbers fresh while the tab is visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    dashboardCounts().then((r) => { if (r.ok) setCounts(r.data); });
  }, []);
  const value = (n?: number) => (counts == null ? '—' : n == null || n < 0 ? '!' : String(n));
  const review = counts?.review ?? 0;

  const overview = data?.overview ?? null;
  const o = overview?.ok ? overview.data : null;
  const isAdmin = o?.scope === 'ADMIN';
  const loading = overview === null;
  const retry = () => void load();

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-pixel text-2xl leading-tight tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">
            Desempenho dos estudantes e estado das provas
            {o && !isAdmin ? ' nas suas turmas' : ''}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ToggleGroup
            type="single"
            value={String(days)}
            onValueChange={(v) => v && setDays(Number(v))}
            variant="outline"
            size="sm"
            aria-label="Período da atividade"
          >
            {PERIODS.map((p) => (
              <ToggleGroupItem
                key={p}
                value={String(p)}
                aria-label={`Últimos ${p} dias`}
                className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                {p} dias
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={retry} disabled={refreshing} aria-live="polite">
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
            {refreshing ? 'A atualizar' : 'Atualizar'}
          </Button>
          <Button asChild size="sm">
            <Link href="/school-year/new">
              <Plus size={14} aria-hidden />
              Novo ano letivo
            </Link>
          </Button>
        </div>
      </div>

      {/* Headline numbers */}
      {overview && !overview.ok ? (
        <SectionState section={overview} onRetry={retry}>{() => null}</SectionState>
      ) : (
        <section aria-label="Indicadores" className="grid grid-cols-2 gap-4 lg:grid-cols-3 2xl:grid-cols-6">
          <KpiCard
            label="Estudantes"
            accent="brand"
            icon={Users}
            loading={loading}
            value={formatInt(o?.students)}
            hint={o ? `${formatInt(o.classes)} turmas${isAdmin ? ` · ${formatInt(o.institutions)} instituições` : ''}` : undefined}
          />
          <KpiCard
            label="Provas publicadas"
            accent="tiro"
            icon={BookOpenCheck}
            loading={loading}
            value={formatInt(o?.statements.published)}
            hint={o ? `de ${formatInt(o.statements.total)} no total` : undefined}
          />
          <KpiCard
            label="Simulações concluídas"
            accent="radar"
            icon={CheckCheck}
            loading={loading}
            value={formatInt(o?.simulations.finished)}
            hint={o ? `${formatInt(o.simulations.uniqueStudents)} estudantes ativos` : undefined}
          />
          <KpiCard
            label="Nota média"
            accent="pop"
            icon={GraduationCap}
            loading={loading}
            value={formatPercent(o?.averageScorePercent)}
            hint={o?.averageScorePercent == null && o ? 'sem simulações concluídas' : 'das simulações concluídas'}
          />
          <KpiCard
            label="Aprovação"
            accent="lila"
            icon={Target}
            loading={loading}
            value={formatPercent(o?.passRatePercent)}
            hint="simulações com nota ≥ 50%"
          />
          <KpiCard
            label="Tempo médio"
            accent="radar"
            icon={Clock}
            loading={loading}
            value={formatDuration(o?.averageTimeSeconds)}
            hint="por simulação"
          />
        </section>
      )}

      {/* Atalhos e revisão */}
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

      {/* Needs attention */}
      {o && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Precisa de atenção</CardTitle>
            <CardDescription>Pendências que impedem provas de chegarem aos estudantes.</CardDescription>
          </CardHeader>
          <CardContent>
            <AttentionPanel overview={o} />
          </CardContent>
        </Card>
      )}

      {/* Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Atividade</CardTitle>
          <CardDescription>Simulações concluídas por dia e nota média nesse dia (últimos {days} dias).</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionState
            section={data?.activity ?? null}
            onRetry={retry}
            skeletonClassName="h-72"
            isEmpty={(points) => points.every((p) => p.finished === 0)}
            empty="Ainda não há simulações concluídas neste período."
          >
            {(points) => <ActivityChart points={points} />}
          </SectionState>
        </CardContent>
      </Card>

      {/* Institutions (administrators only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Instituições</CardTitle>
            <CardDescription>Comparação entre instituições com base nas simulações concluídas.</CardDescription>
          </CardHeader>
          <CardContent>
            <SectionState
              section={data?.institutions ?? null}
              onRetry={retry}
              isEmpty={(items) => items.length === 0}
              empty="Ainda não há instituições registadas."
            >
              {(items) => <InstitutionPanel institutions={items} />}
            </SectionState>
          </CardContent>
        </Card>
      )}

      {/* Classes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Turmas</CardTitle>
          <CardDescription>Desempenho por turma.</CardDescription>
        </CardHeader>
        <CardContent>
          <SectionState
            section={data?.classes ?? null}
            onRetry={retry}
            isEmpty={(items) => items.length === 0}
            empty="Ainda não há turmas para mostrar."
          >
            {(items) => <ClassesTable classes={items} />}
          </SectionState>
        </CardContent>
      </Card>

      {/* Statements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-foreground">Provas</CardTitle>
          <CardDescription>
            Selecione uma prova para ver o desempenho por questão e identificar lacunas de aprendizagem.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SectionState
            section={data?.statements ?? null}
            onRetry={retry}
            isEmpty={(items) => items.length === 0}
            empty="Ainda não há provas carregadas."
          >
            {(items) => <StatementsTable statements={items} />}
          </SectionState>
        </CardContent>
      </Card>

      {data && (
        <p className="text-right text-xs text-muted-foreground">
          Atualizado às{' '}
          {new Date(data.loadedAt).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  );
}
