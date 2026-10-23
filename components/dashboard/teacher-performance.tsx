'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Clock, GraduationCap, Target, Users } from 'lucide-react';
import { getClassDashboard, getDashboard } from '@/app/actions/analytics';
import { ACTION_TIMEOUT_MS, withDeadline } from '@/lib/timeout';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { NativeSelect } from '@/components/ui/native-select';
import { ActivityChart } from './lazy-charts';
import { KpiCard } from './kpi-card';
import { SectionError, SectionState } from './section-state';
import { TONE_BAR, TONE_TEXT, formatDuration, formatInt, formatPercent, scoreTone } from '@/lib/format';
import type { ActivityPoint, ClassDashboard, ClassStats, ClassStudentStats, Dashboard, HardQuestion, Section } from '@/types/analytics';

const STATUS: Record<ClassStudentStats['status'], { label: string; variant: 'destructive' | 'secondary' | 'success' }> = {
  AT_RISK: { label: 'Em risco', variant: 'destructive' },
  NO_ACTIVITY: { label: 'Sem atividade', variant: 'secondary' },
  OK: { label: 'Bem', variant: 'success' },
};

/** Uma secção que não chegou porque a chamada falhou — nunca fica pendente. */
const failed = <T,>(message = 'Não foi possível carregar. Tente novamente.'): Section<T> => ({ ok: false, error: message });

/**
 * O dashboard do professor (FE-16): uma turma de cada vez, com o que pede ação
 * primeiro. A questão mais falhada aparece logo ao abrir, sem clicar em nada:
 * o critério da #27 é chegar a ela em dois cliques, e o primeiro é abrir a página.
 *
 * Os números vêm já filtrados pelo backend (BE-15): o professor só recebe as
 * turmas e as provas do par turma e disciplina que dá.
 */
export function TeacherPerformance() {
  const [base, setBase] = useState<Dashboard | null>(null);
  const [baseError, setBaseError] = useState<string | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ClassDashboard | null>(null);
  const request = useRef(0);

  const loadBase = useCallback(async () => {
    setBase(null);
    setBaseError(null);
    try {
      const result = await withDeadline(getDashboard(30), ACTION_TIMEOUT_MS);
      setBase(result);
      const first = result.classes.ok ? result.classes.data[0] : undefined;
      if (first) setClassId((current) => current ?? first.id);
    } catch {
      // A própria chamada à server action falhou (rede em baixo): sem isto o
      // esqueleto ficava para sempre. Erro explícito com "Tentar novamente" (#191).
      setBaseError('Não foi possível contactar o servidor. Tente novamente.');
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void loadBase(), 0);
    return () => window.clearTimeout(task);
  }, [loadBase]);

  const loadDetail = useCallback(async (id: number) => {
    const mine = ++request.current;
    setDetail(null);
    try {
      const result = await withDeadline(getClassDashboard(id), ACTION_TIMEOUT_MS);
      if (mine === request.current) setDetail(result);
    } catch {
      if (mine === request.current) setDetail({ students: failed(), weekly: failed(), questions: failed() });
    }
  }, []);

  useEffect(() => {
    if (classId == null) return;
    const task = window.setTimeout(() => void loadDetail(classId), 0);
    return () => window.clearTimeout(task);
  }, [classId, loadDetail]);

  const classes = base?.classes.ok ? base.classes.data : null;
  const current: ClassStats | null = classes?.find((c) => c.id === classId) ?? null;
  const retry = () => (classId != null ? void loadDetail(classId) : void loadBase());

  // O gráfico da atividade lê `date`; a semana chega como `weekStart`.
  const weekly = useMemo<Section<ActivityPoint[]> | null>(() => {
    if (!detail) return null;
    if (!detail.weekly.ok) return detail.weekly;
    return {
      ok: true,
      data: detail.weekly.data.map((w) => ({ date: w.weekStart, finished: w.finished, averageScorePercent: w.averageScorePercent })),
    };
  }, [detail]);

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-6 md:p-8 lg:p-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl leading-tight tracking-tight text-foreground">Desempenho da turma</h1>
          <p className="mt-1 text-muted-foreground">Onde a turma falha, quem precisa de ajuda e como evolui.</p>
        </div>
        {classes && classes.length > 1 ? (
          <NativeSelect
            aria-label="Turma"
            className="w-64"
            value={classId ?? ''}
            onChange={(e) => setClassId(Number(e.target.value))}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.code ?? `${c.grade}.ª`} · {c.course}</option>
            ))}
          </NativeSelect>
        ) : null}
      </div>

      {baseError ? (
        <Card><CardContent><SectionError message={baseError} onRetry={() => void loadBase()} /></CardContent></Card>
      ) : base && !base.classes.ok ? (
        <Card><CardContent><SectionError message={base.classes.error} onRetry={() => void loadBase()} /></CardContent></Card>
      ) : classes && classes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Ainda não tem turmas atribuídas. Peça ao administrador da escola para o atribuir a uma turma e disciplina.
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label="Indicadores da turma" className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard label="Alunos" accent="brand" icon={Users} loading={!current} value={formatInt(current?.students)} hint={current ? `${formatInt(current.statements)} provas` : undefined} />
            <KpiCard label="Nota média" accent="brand" icon={GraduationCap} loading={!current} value={formatPercent(current?.averageScorePercent)} hint={current?.averageScorePercent == null && current ? 'sem simulações concluídas' : 'das simulações concluídas'} />
            <KpiCard label="Simulações" accent="radar" icon={Target} loading={!current} value={formatInt(current?.finishedSimulations)} hint="concluídas" />
            <KpiCard label="Tempo médio" accent="radar" icon={Clock} loading={!current} value={formatDuration(current?.averageTimeSeconds)} hint="por simulação" />
          </section>

          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">Questões mais falhadas</CardTitle>
                <CardDescription>Só as de escolha, corrigidas automaticamente. A primeira é a lacuna mais urgente.</CardDescription>
              </CardHeader>
              <CardContent>
                <SectionState
                  section={detail?.questions ?? null}
                  onRetry={retry}
                  isEmpty={(items) => items.length === 0}
                  empty="Ainda não há respostas suficientes nas provas desta turma."
                >
                  {(items) => <HardQuestions items={items} />}
                </SectionState>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-foreground">Alunos</CardTitle>
                <CardDescription>Os que precisam de ajuda primeiro.</CardDescription>
              </CardHeader>
              <CardContent>
                <SectionState
                  section={detail?.students ?? null}
                  onRetry={retry}
                  isEmpty={(items) => items.length === 0}
                  empty="Ainda não há alunos matriculados nesta turma."
                >
                  {(items) => <Students items={items} />}
                </SectionState>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-foreground">Evolução por semana</CardTitle>
              <CardDescription>Simulações concluídas e nota média, nas últimas 8 semanas.</CardDescription>
            </CardHeader>
            <CardContent>
              <SectionState
                section={weekly}
                onRetry={retry}
                chart
                skeletonClassName="h-72"
                isEmpty={(points) => points.every((p) => p.finished === 0)}
                empty="Ainda não há simulações concluídas nestas semanas."
              >
                {(points) => <ActivityChart points={points} />}
              </SectionState>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function HardQuestions({ items }: { items: HardQuestion[] }) {
  const [first, ...rest] = items;
  return (
    <div className="space-y-4">
      <div role="note" className="rounded-lg border border-warning/40 bg-warning-soft p-4">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-warning">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> A mais falhada
        </p>
        <p className="mt-2 font-semibold text-foreground">Questão {first.number} · {first.statementTitle ?? `Prova ${first.statementId}`}</p>
        <p className="mt-1 line-clamp-3 text-sm text-foreground">{first.text}</p>
        <p className="mt-2 text-sm">
          <span className={`font-semibold tabular-nums ${TONE_TEXT[scoreTone(first.correctPercent)]}`}>{formatPercent(first.correctPercent)}</span>
          <span className="text-muted-foreground"> de acerto em {formatInt(first.attempts)} {first.attempts === 1 ? 'tentativa' : 'tentativas'}</span>
        </p>
        <Link href={`/statements/${first.statementId}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
          Ver a prova <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
      {rest.length ? (
        <ol className="space-y-3" start={2}>
          {rest.map((q) => (
            <li key={q.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1">
              <span className="truncate text-sm">
                <span className="font-medium">Q{q.number}</span>
                <span className="text-muted-foreground"> · {q.statementTitle ?? `Prova ${q.statementId}`}</span>
              </span>
              <span className={`text-sm font-semibold tabular-nums ${TONE_TEXT[scoreTone(q.correctPercent)]}`}>{formatPercent(q.correctPercent)}</span>
              <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                <div className={`h-full rounded-full ${TONE_BAR[scoreTone(q.correctPercent)]}`} style={{ width: `${q.correctPercent ?? 0}%` }} />
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function Students({ items }: { items: ClassStudentStats[] }) {
  const atRisk = items.filter((s) => s.status === 'AT_RISK').length;
  return (
    <div className="space-y-3">
      {atRisk ? (
        <p className="text-sm text-destructive">{atRisk === 1 ? '1 aluno está' : `${atRisk} alunos estão`} abaixo de metade da nota.</p>
      ) : null}
      <ul className="divide-y rounded-md border">
        {items.map((s) => (
          <li key={s.accountId} className="flex items-center gap-3 px-3 py-2.5">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">
                {formatInt(s.finishedSimulations)} {s.finishedSimulations === 1 ? 'prova' : 'provas'}
              </span>
            </span>
            <span className={`text-sm font-semibold tabular-nums ${TONE_TEXT[scoreTone(s.averageScorePercent)]}`}>{formatPercent(s.averageScorePercent)}</span>
            <Badge variant={STATUS[s.status].variant}>{STATUS[s.status].label}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
