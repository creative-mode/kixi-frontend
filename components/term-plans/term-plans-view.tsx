'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { approvePlan, concludeScheduling, createPlan, dispense, linkRoom, linkStatement, planContext, reschedule, type PlanContext, type RoomChoice, type StatementChoice } from '@/app/actions/term-plans';
import { ACTION_TIMEOUT_MS, withDeadline } from '@/lib/timeout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { SectionState } from '@/components/dashboard/section-state';
import { MAX_MAC, STATUS_LABEL, KIND_LABEL, LEVEL_LABEL, conclusionProblem, estadoDaPauta, draftProblem, formatDate, daysText, planTitle, progress, reminderText, remindersFirst, resizeMac, schedulingNote, statementTargets } from '@/lib/term-plans';
import type { Section } from '@/types/analytics';
import { listTermSheets } from '@/app/actions/term-sheets';
import type { TermSheetSummary } from '@/types/term-sheets';
import type { Assessment, PlanDraft, TermPlan } from '@/types/term-plans';

const EMPTY: PlanDraft = { classId: 0, subjectId: 0, termId: 0, p1Date: '', p2Date: '', macCount: 0, macDates: [], macTitles: [] };
const DONE_TONE = new Set(['GRADED', 'DISPENSED']);

/**
 * O plano do trimestre: o professor define P1, P2 e as avaliações de MAC com as datas; o ecrã mostra o estado de cada uma
 * (derivado pelo backend), lembra o que falta montar e deixa o coordenador aprovar e dispensar. A pauta só abre quando todas
 * as avaliações estão corrigidas ou dispensadas.
 */
export function TermPlansView() {
  const [state, setState] = useState<Section<PlanContext> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** As pautas que o utilizador vê: dizem se a de um plano já fechou. Uma falha aqui não derruba o ecrã (G11). */
  const [pautas, setPautas] = useState<TermSheetSummary[]>([]);

  const load = useCallback(async () => {
    try {
      const r = await withDeadline(planContext(), ACTION_TIMEOUT_MS);
      setState(r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error });
      const lista = await withDeadline(listTermSheets(), ACTION_TIMEOUT_MS).catch(() => null);
      setPautas(lista?.ok ? lista.data : []);
    } catch {
      setState({ ok: false, error: 'Não foi possível contactar o servidor. Tente novamente.' });
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const act = useCallback(async (run: () => Promise<{ ok: boolean; error?: string }>, done: string): Promise<boolean> => {
    setNotice(null);
    const r = await run();
    setNotice(r.ok ? done : (r.error ?? 'Não foi possível concluir.'));
    if (r.ok) await load();
    return r.ok;
  }, [load]);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 md:p-7">
      <header>
        <h1 className="text-[26px] font-extrabold tracking-tight">Plano do trimestre</h1>
        <p className="text-sm text-muted-foreground">P1, P2 e as avaliações de MAC com as datas. A pauta abre quando tudo estiver corrigido ou dispensado.</p>
      </header>
      {notice && <p role="status" className="rounded-md border bg-muted px-3 py-2 text-sm">{notice}</p>}
      <SectionState section={state} onRetry={() => void load()}>
        {(ctx) => (
          <>
            <Reminders ctx={ctx} />
            {ctx.canPlan && <NewPlan ctx={ctx} onCreate={async (d) => { await act(() => createPlan(d), 'Plano criado.'); }} />}
            {ctx.plans.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ainda não há planos{ctx.canPlan ? '. Crie o primeiro acima.' : ' visíveis para si.'}</p>
            ) : (
              ctx.plans.map((plan) => <PlanCard key={plan.id} plan={plan} ctx={ctx} act={act} pautas={pautas} />)
            )}
          </>
        )}
      </SectionState>
    </div>
  );
}

function Reminders({ ctx }: { ctx: PlanContext }) {
  const list = remindersFirst(ctx.reminders);
  if (list.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Lembretes</CardTitle>
        <CardDescription>O que falta preparar para as datas que definiu.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2 text-sm">
          {list.map((r) => (
            <li key={`${r.planId}-${r.assessmentId}`} className="flex flex-wrap items-center gap-2">
              <Badge variant={r.level === 'LATE' ? 'destructive' : 'secondary'}>{LEVEL_LABEL[r.level]}</Badge>
              <span>{reminderText(r)}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function NewPlan({ ctx, onCreate }: { ctx: PlanContext; onCreate: (d: PlanDraft) => Promise<void> }) {
  const [draft, setDraft] = useState<PlanDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [pair, setPair] = useState('');
  const problem = draftProblem(draft);
  const free = ctx.pairs.filter((p) => !ctx.plans.some((x) => x.classId === p.classId && x.subjectId === p.subjectId && x.termId === draft.termId));

  if (ctx.pairs.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo plano</CardTitle>
        <CardDescription>Um por turma, disciplina e trimestre.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (problem) return;
            setBusy(true);
            await onCreate(draft);
            setBusy(false);
            setDraft(EMPTY);
            setPair('');
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-pair">Turma e disciplina</Label>
            <NativeSelect id="plan-pair" value={pair} onChange={(e) => {
              const p = ctx.pairs.find((x) => `${x.classId}:${x.subjectId}` === e.target.value);
              setPair(e.target.value);
              setDraft((d) => ({ ...d, classId: p?.classId ?? 0, subjectId: p?.subjectId ?? 0 }));
            }}>
              <option value="">Escolha…</option>
              {free.map((p) => <option key={`${p.classId}:${p.subjectId}`} value={`${p.classId}:${p.subjectId}`}>{p.label}</option>)}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-term">Trimestre</Label>
            <NativeSelect id="plan-term" value={draft.termId || ''} onChange={(e) => setDraft((d) => ({ ...d, termId: Number(e.target.value) }))}>
              <option value="">Escolha…</option>
              {ctx.terms.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-p1">Data da P1</Label>
            <Input id="plan-p1" type="date" value={draft.p1Date} onChange={(e) => setDraft((d) => ({ ...d, p1Date: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="plan-p2">Data da P2</Label>
            <Input id="plan-p2" type="date" value={draft.p2Date} onChange={(e) => setDraft((d) => ({ ...d, p2Date: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5 md:col-span-2">
            <Label htmlFor="plan-mac">Quantas avaliações de MAC (0 a {MAX_MAC})?</Label>
            <Input id="plan-mac" type="number" min={0} max={MAX_MAC} className="max-w-32" value={draft.macCount}
              onChange={(e) => setDraft((d) => resizeMac(d, Number(e.target.value)))} />
          </div>
          {draft.macDates.map((date, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] items-end gap-2 md:col-span-2 md:max-w-xl">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`mac-t-${i}`}>MAC {i + 1}, título (opcional)</Label>
                <Input id={`mac-t-${i}`} value={draft.macTitles[i] ?? ''} placeholder={`MAC ${i + 1}`}
                  onChange={(e) => setDraft((d) => ({ ...d, macTitles: d.macTitles.map((t, k) => (k === i ? e.target.value : t)) }))} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={`mac-d-${i}`}>Data</Label>
                <Input id={`mac-d-${i}`} type="date" value={date}
                  onChange={(e) => setDraft((d) => ({ ...d, macDates: d.macDates.map((x, k) => (k === i ? e.target.value : x)) }))} />
              </div>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-3 md:col-span-2">
            <Button type="submit" disabled={busy || problem !== null}>{busy ? 'A criar…' : 'Criar plano'}</Button>
            {problem && draft.classId > 0 && <span className="text-sm text-muted-foreground">{problem}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

type Act = (run: () => Promise<{ ok: boolean; error?: string }>, done: string) => Promise<boolean>;

function PlanCard({ plan, ctx, act, pautas }: { plan: TermPlan; ctx: PlanContext; act: Act; pautas: TermSheetSummary[] }) {
  const pauta = estadoDaPauta(plan, pautas);
  const { done, total } = progress(plan);
  const mine = ctx.pairs.some((p) => p.classId === plan.classId && p.subjectId === plan.subjectId);
  const problem = conclusionProblem(plan);
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{planTitle(plan)}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{done}/{total} concluídas</Badge>
            {plan.approved && <Badge>Aprovado</Badge>}
            {pauta === 'fechada' ? <Badge variant="secondary">Pauta homologada</Badge> : pauta === 'anulada' ? <Badge variant="secondary">Pauta anulada</Badge> : plan.pautaOpened ? <Badge variant="secondary">Pauta aberta</Badge> : plan.schedulingConcluded ? <Badge variant="secondary">Agendamento concluído</Badge> : null}
          </div>
        </div>
        <CardDescription>
          {pauta === 'fechada' ? 'A pauta está fechada e homologada. Consulte as notas em Pautas.' : pauta === 'anulada' ? 'A pauta foi anulada. Consulte o estado em Pautas.' : plan.pautaOpened ? 'A pauta está aberta: cada componente espera pela sua data e a correção segue o fluxo. Acompanhe-a em Pautas.' : plan.schedulingConcluded ? schedulingNote(plan) : `Ligue o enunciado ${statementTargets(plan)} e conclua o agendamento: a pauta abre nesse momento e cada componente espera pela sua data.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <ul className="flex flex-col divide-y">
          {plan.assessments.map((a) => <AssessmentRow key={a.id} plan={plan} a={a} mine={mine} ctx={ctx} act={act} />)}
        </ul>
        {(mine || ctx.canDecide) && !plan.schedulingConcluded && !plan.pautaOpened && (
          <div className="flex flex-wrap items-center gap-2">
            <Button disabled={problem !== null} onClick={() => void act(() => concludeScheduling(plan.id), 'Agendamento concluído: a pauta vai abrir.')}>Concluir o agendamento</Button>
            {problem && <span className="text-sm text-muted-foreground">{problem}</span>}
          </div>
        )}
        {ctx.canDecide && !plan.approved && (
          <div><Button variant="outline" onClick={() => void act(() => approvePlan(plan.id), 'Plano aprovado.')}>Aprovar o plano</Button></div>
        )}
      </CardContent>
    </Card>
  );
}

function AssessmentRow({ plan, a, mine, ctx, act }: { plan: TermPlan; a: Assessment; mine: boolean; ctx: PlanContext; act: Act }) {
  const [room, setRoom] = useState('');
  const [statement, setStatement] = useState('');
  const [reason, setReason] = useState('');
  const [asking, setAsking] = useState(false);
  const [newDate, setNewDate] = useState('');
  const isExam = a.kind !== 'MAC';
  // Depois de reagendar ou dispensar com sucesso o formulário fecha e esquece os valores; se falhar fica, para se corrigir.
  const closeForm = (ok: boolean) => {
    if (!ok) return;
    setAsking(false);
    setReason('');
    setNewDate('');
  };
  const rooms = useMemo<RoomChoice[]>(() => ctx.rooms.filter((r) => r.classId === plan.classId), [ctx.rooms, plan.classId]);
  // Um enunciado da turma (ou livre, sem turma própria) e da disciplina do plano: a P1, a P2 e cada MAC escolhem-no
  // da mesma forma (kixi#623/kixi-frontend#809), antes ou em vez de lhe abrir sala.
  const statements = useMemo<StatementChoice[]>(
    () => ctx.statements.filter((s) => (s.classId === null || s.classId === plan.classId) && (s.subjectId === null || s.subjectId === plan.subjectId)),
    [ctx.statements, plan.classId, plan.subjectId],
  );
  const open = !DONE_TONE.has(a.status) || (ctx.canDecide && a.kind !== 'MAC' && !plan.pautaOpened && a.status === 'GRADED');
  return (
    <li className="flex flex-col gap-2 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="min-w-14 font-medium">{KIND_LABEL[a.kind]}{a.kind === 'MAC' ? ` ${a.seq}` : ''}</span>
        <span className="text-sm">{a.title !== KIND_LABEL[a.kind] && a.title !== `MAC ${a.seq}` ? a.title : ''}</span>
        <span className="text-sm text-muted-foreground">{formatDate(a.plannedDate)}{open ? ` (${daysText(a.daysLeft)})` : ''}</span>
        <Badge variant={a.status === 'GRADED' ? 'default' : a.status === 'DISPENSED' ? 'outline' : 'secondary'}>{STATUS_LABEL[a.status]}</Badge>
        {a.dispensedReason && <span className="text-xs text-muted-foreground">Motivo: {a.dispensedReason}</span>}
      </div>
      {open && (
        <div className="flex flex-col gap-2">
          {/* Ligar o enunciado e a sala são dois passos distintos (kixi-frontend#809): cada um na sua linha, com o
              seu rótulo, em vez de tudo espremido numa só — ligar a sala já traz o enunciado dela, por isso o
              enunciado só aparece sozinho quando faz sentido escolher um à parte (o caso em papel). */}
          {mine && a.statementId === null && statements.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor={`st-${a.id}`} className="w-20 shrink-0 text-xs text-muted-foreground">Enunciado</Label>
              <NativeSelect id={`st-${a.id}`} value={statement} onChange={(e) => setStatement(e.target.value)} className="max-w-64">
                <option value="">Escolher…</option>
                {statements.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </NativeSelect>
              <Button size="sm" variant="outline" disabled={!statement} onClick={() => void act(() => linkStatement(plan.id, a.id, Number(statement)), 'Enunciado ligado.')}>Ligar</Button>
            </div>
          )}
          {mine && a.roomId === null && rooms.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Label htmlFor={`rm-${a.id}`} className="w-20 shrink-0 text-xs text-muted-foreground">Sala</Label>
              <NativeSelect id={`rm-${a.id}`} value={room} onChange={(e) => setRoom(e.target.value)} className="max-w-64">
                <option value="">Escolher…</option>
                {rooms.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
              </NativeSelect>
              <Button size="sm" variant="outline" disabled={!room} onClick={() => void act(() => linkRoom(plan.id, a.id, Number(room)), 'Sala ligada.')}>Ligar</Button>
            </div>
          )}
          {ctx.canDecide && (
            <div className="flex flex-wrap items-center gap-2">
              {!asking && <Button size="sm" variant="ghost" onClick={() => setAsking(true)}>{isExam ? 'Reagendar…' : 'Dispensar…'}</Button>}
              {asking && (
                <>
                  {isExam && <Input aria-label="Nova data" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="max-w-40" />}
                  <Input aria-label={isExam ? 'Motivo do reagendamento' : 'Motivo da dispensa'} placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} className="max-w-64" />
                  {isExam
                    ? <Button size="sm" disabled={!reason.trim() || !newDate} onClick={() => void act(() => reschedule(plan.id, a.id, newDate, reason), 'Prova reagendada.').then(closeForm)}>Reagendar</Button>
                    : <Button size="sm" disabled={!reason.trim()} onClick={() => void act(() => dispense(plan.id, a.id, reason), 'Avaliação dispensada.').then(closeForm)}>Dispensar</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setAsking(false)}>Cancelar</Button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </li>
  );
}
