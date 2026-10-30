'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { FormSkeleton } from '@/components/crud/loading';
import { createRoom, roomContext, type RoomContext } from '@/app/actions/exam-rooms';
import { ACTION_TIMEOUT_MS, TIMEOUT_MESSAGE, isTimeout, withDeadline } from '@/lib/timeout';
import { draftProblem, formatWall, luandaNowInput, preselectFromStatement, statementFitsRoom, wallMinutes, type RoomDraft } from '@/lib/exam-rooms/model';
import { RoomHead } from './room-head';
import { useSessionAccount } from '@/components/session-account';
import { clearFormDraft, clearStaleFormDrafts, loadFormDraft, saveFormDraft } from '@/lib/form-drafts';
import { reportActionError } from '@/lib/notify-session-expired';

/** Soma minutos a um valor de `datetime-local`, sem passar pelo fuso do browser. */
function plusMinutes(input: string, minutes: number): string {
  const base = wallMinutes(input);
  if (base === null) return input;
  return new Date((base + minutes) * 60_000).toISOString().slice(0, 16);
}

/** Daqui a 5 minutos, arredondado aos 5, na hora de Luanda. */
function nextSlot(): string {
  const now = wallMinutes(luandaNowInput()) ?? 0;
  const slot = Math.ceil((now + 5) / 5) * 5;
  return new Date(slot * 60_000).toISOString().slice(0, 16);
}

export function RoomWizard({ initialStatementId = null }: { initialStatementId?: string | null }) {
  const router = useRouter();
  const accountId = useSessionAccount();
  const formId = `exam-room:new:${initialStatementId ?? 'livre'}`;
  const [draftReady, setDraftReady] = useState(false);
  const [restored, setRestored] = useState(false);
  const [ctx, setCtx] = useState<RoomContext | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [inviteClass, setInviteClass] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RoomDraft>(() => {
    const startsAt = nextSlot();
    return { classId: '', statementId: '', startsAt, endsAt: plusMinutes(startsAt, 100), durationMinutes: '90' };
  });
  const set = (patch: Partial<RoomDraft>) => setDraft((d) => ({ ...d, ...patch }));

  useEffect(() => {
    clearStaleFormDrafts(window.sessionStorage);
    const saved = accountId === null ? null : loadFormDraft<Partial<RoomDraft>>(window.sessionStorage, formId, accountId);
    if (saved) {
      setDraft((d) => ({ ...d, ...saved }));
      setRestored(true);
    }
    setDraftReady(true);
  }, [accountId, formId]);

  useEffect(() => {
    if (!draftReady || accountId === null) return;
    saveFormDraft(window.sessionStorage, formId, draft, accountId);
  }, [accountId, draft, draftReady, formId]);

  useEffect(() => {
    let alive = true;
    setCtx(null);
    setError(null);
    withDeadline(roomContext(), ACTION_TIMEOUT_MS).then((r) => {
      if (!alive) return;
      setError(null);
      if (!r.ok) return setError(r.error);
      setCtx(r.data);
      // Vindo de um enunciado (`?statementId=`), a turma e a prova já vêm escolhidas.
      const from = preselectFromStatement(r.data.statements, r.data.classes, initialStatementId, r.data.admin);
      if (from) {
        setDraft((d) => {
          const duration = from.durationMinutes ?? (Number(d.durationMinutes) || 90);
          return { ...d, classId: from.classId, statementId: from.statementId, durationMinutes: String(duration), endsAt: from.statementId ? plusMinutes(d.startsAt, duration + 10) : d.endsAt };
        });
      } else if (r.data.classes.length === 1) setDraft((d) => ({ ...d, classId: String(r.data.classes[0].id) }));
    }).catch((e) => {
      // A chamada à server action falhou ou excedeu o prazo do cliente: sem isto
      // ficava no esqueleto para sempre.
      if (alive) setError(isTimeout(e) ? TIMEOUT_MESSAGE : 'Não foi possível contactar o servidor. Tente novamente.');
    });
    return () => {
      alive = false;
    };
    // `attempt` só muda quando o professor pede para tentar de novo; o enunciado
    // de origem não muda enquanto o assistente está aberto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const statements = useMemo(
    () => (ctx && draft.classId ? ctx.statements.filter((s) => statementFitsRoom(s, Number(draft.classId), ctx.admin)) : []),
    [ctx, draft.classId],
  );
  const chosen = statements.find((s) => String(s.id) === draft.statementId) ?? null;
  const problem = draftProblem(draft);
  const windowMinutes = (wallMinutes(draft.endsAt) ?? 0) - (wallMinutes(draft.startsAt) ?? 0);

  function chooseStatement(id: string) {
    const st = statements.find((s) => String(s.id) === id);
    const duration = st?.durationMinutes && st.durationMinutes > 0 ? st.durationMinutes : Number(draft.durationMinutes) || 90;
    // A janela acompanha a duração da prova, com 10 minutos para todos entrarem.
    set({ statementId: id, durationMinutes: String(duration), endsAt: plusMinutes(draft.startsAt, duration + 10) });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (problem) return void toast.error(problem);
    setSaving(true);
    const res = await createRoom(draft, inviteClass);
    setSaving(false);
    if (!res.ok) return void reportActionError(res.error);
    clearFormDraft(window.sessionStorage, formId);
    if (res.data.warning) toast.warning(res.data.warning);
    else toast.success('Sala criada. Abra-a quando a turma estiver pronta.');
    router.push(`/exam-rooms/${res.data.id}`);
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <RoomHead
        title="Nova sala de prova"
        subtitle="Escolha a prova, a janela e quem entra. A sala fica em rascunho até a abrir."
        back={{ href: '/exam-rooms', label: 'Voltar às salas' }}
      />
      {restored ? <p role="status" className="mb-4 text-sm text-muted-foreground">Retomámos o que tinhas preenchido neste separador.</p> : null}
      {error ? (
        <Card>
          <CardContent role="status" className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <p className="max-w-sm text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : !ctx ? (
        <Card><CardContent className="p-6"><FormSkeleton fields={5} /></CardContent></Card>
      ) : ctx.classes.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Não tem turmas atribuídas. Peça ao administrador da escola para o atribuir a uma turma e disciplina.
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_18rem]">
          <div className="grid gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">1 · Turma e prova</CardTitle></CardHeader>
              <CardContent className="grid gap-5">
                <div className="grid gap-2">
                  <Label htmlFor="room-class">Turma</Label>
                  <NativeSelect id="room-class" value={draft.classId} onChange={(e) => set({ classId: e.target.value, statementId: '' })} required>
                    <option value="">Escolha a turma…</option>
                    {ctx.classes.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </NativeSelect>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="room-statement">Enunciado</Label>
                  <NativeSelect id="room-statement" value={draft.statementId} onChange={(e) => chooseStatement(e.target.value)} disabled={!draft.classId} required>
                    <option value="">{draft.classId ? (statements.length ? 'Escolha o enunciado…' : 'Sem enunciados desta turma') : 'Escolha primeiro a turma'}</option>
                    {statements.map((s) => (
                      <option key={s.id} value={s.id}>{s.title}{s.needsReview ? ' (por aprovar)' : ''}</option>
                    ))}
                  </NativeSelect>
                  {draft.classId && statements.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      A prova é dada a partir de um enunciado, numa sala. A sala usa um enunciado da mesma turma: <Link href="/exam-builder?importar=1" className="underline">importe a prova de uma imagem</Link> ou <Link href="/exam-builder" className="underline">monte-a</Link>, e associe-a a esta turma.
                    </p>
                  ) : null}
                  {chosen?.needsReview ? (
                    <p className="text-xs text-warning">Este enunciado ainda não foi aprovado: confirme o gabarito antes de abrir a sala, senão a correção automática não tem com que comparar.</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">2 · Janela e duração</CardTitle></CardHeader>
              <CardContent className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="room-start">Abre às</Label>
                  <Input id="room-start" type="datetime-local" value={draft.startsAt} onChange={(e) => set({ startsAt: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="room-end">Fecha às</Label>
                  <Input id="room-end" type="datetime-local" value={draft.endsAt} min={draft.startsAt} onChange={(e) => set({ endsAt: e.target.value })} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="room-duration">Duração da prova (min)</Label>
                  <Input id="room-duration" type="number" inputMode="numeric" min={1} step={1} value={draft.durationMinutes} onChange={(e) => set({ durationMinutes: e.target.value })} required />
                </div>
                <p className="self-end text-xs text-muted-foreground sm:pb-3">
                  Hora de Luanda. Cada aluno tem a duração a partir do momento em que entra, sem passar a hora de fecho.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">3 · Quem entra</CardTitle></CardHeader>
              <CardContent>
                <label className="flex items-start gap-3 text-sm">
                  <Checkbox checked={inviteClass} onCheckedChange={(v) => setInviteClass(v === true)} className="mt-0.5" />
                  <span>
                    <span className="font-medium">Convidar toda a turma</span>
                    <span className="block text-muted-foreground">Todos os alunos matriculados recebem a sala. Pode convidar mais tarde, no ecrã da sala.</span>
                  </span>
                </label>
              </CardContent>
            </Card>
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <Card>
              <CardHeader><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
              <CardContent className="grid gap-3 text-sm">
                <Summary label="Turma" value={ctx.classes.find((c) => String(c.id) === draft.classId)?.label ?? '—'} />
                <Summary label="Prova" value={chosen?.title ?? '—'} />
                <Summary label="Janela" value={`${formatWall(draft.startsAt)} → ${formatWall(draft.endsAt)}${windowMinutes > 0 ? ` (${windowMinutes} min)` : ''}`} />
                <Summary label="Duração" value={draft.durationMinutes ? `${draft.durationMinutes} min` : '—'} />
                <Summary label="Convidados" value={inviteClass ? 'Toda a turma' : 'Ninguém, por agora'} />
                {problem && (draft.classId || draft.statementId) ? <p role="alert" className="text-xs text-destructive">{problem}</p> : null}
                <Button type="submit" className="mt-2 w-full" disabled={saving || !!problem}>
                  {saving ? 'A criar…' : 'Criar sala'}
                </Button>
              </CardContent>
            </Card>
          </aside>
        </form>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
