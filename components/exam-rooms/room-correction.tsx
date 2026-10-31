'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCheck, KeyRound, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { gradeRoom, roomReview } from '@/app/actions/exam-rooms';
import { AI_LEVEL_LABEL, aiStateLabel, gradesToSend, invalidDrafts, type ReviewQuestion, type RoomReview, type ScoreDrafts } from '@/lib/exam-rooms/model';

const fmt = (n: number | null) => (n === null ? '—' : new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2 }).format(n));
const labelOf = (q: ReviewQuestion) => `${q.number ?? ''}${q.label ?? ''}`;

/**
 * A correcção das respostas abertas da sala, em massa: questão a questão, com a chave (resposta modelo) ao lado
 * e uma nota por aluno. "Corrigir pela chave" dá a cotação inteira às respostas que coincidem com a chave;
 * o resto fica para o professor, e tudo se grava de uma vez.
 */
export function RoomCorrection({ roomId, onChanged, onPlanLinked }: { roomId: number; onChanged: () => void; onPlanLinked?: (planLinked: boolean) => void }) {
  const [review, setReview] = useState<RoomReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<ScoreDrafts>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await roomReview(roomId);
    if (res.ok) {
      setReview(res.data);
      onPlanLinked?.(res.data.planLinked === true);
      setError(null);
    } else {
      setError(res.error);
    }
  }, [roomId, onPlanLinked]);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const toSend = useMemo(() => (review ? gradesToSend(review, drafts) : []), [review, drafts]);
  const invalid = useMemo(() => new Set(review ? invalidDrafts(review, drafts) : []), [review, drafts]);

  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!review) return <div className="flex justify-center py-6"><Spinner /></div>;
  if (review.questions.length === 0) return null;
  // As provas de um plano do trimestre são corrigidas pela IA no fluxo do motor: o professor só lê (kixi#542).
  if (review.planLinked) return <AiCorrection review={review} />;

  async function run(byKey: boolean) {
    if (invalid.size > 0) return void toast.error('Há notas inválidas: use um número entre 0 e a cotação da questão.');
    setBusy(true);
    const res = await gradeRoom(roomId, toSend, byKey);
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    const { graded, byKey: viaKey, failed } = res.data;
    if (failed.length) toast.error(`${failed.length} nota(s) não foram gravadas: ${[...new Set(failed.map((f) => f.message))].join(' · ')}`);
    if (graded > 0) toast.success(viaKey > 0 ? `${graded} resposta(s) corrigida(s), ${viaKey} pela chave.` : `${graded} nota(s) gravada(s).`);
    else if (!failed.length) toast.message(byKey ? 'Nenhuma resposta coincide com a chave.' : 'Não há notas por gravar.');
    setDrafts({});
    await load();
    onChanged();
  }

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Corrigir respostas abertas</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => run(true)} disabled={busy || review.pending === 0}>
            <KeyRound size={16} aria-hidden /> Corrigir pela chave
          </Button>
          <Button onClick={() => run(false)} disabled={busy || toSend.length === 0}>
            <Save size={16} aria-hidden /> Guardar notas{toSend.length ? ` (${toSend.length})` : ''}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6">
        <p className="text-sm text-muted-foreground">
          {review.pending === 0 ? 'Todas as respostas abertas estão corrigidas.' : `${review.pending} resposta(s) por corrigir.`}{' '}
          A chave é a resposta modelo da questão: «Corrigir pela chave» dá a cotação inteira às respostas iguais a ela
          (sem contar maiúsculas, acentos nem pontuação) e não mexe nas outras.
        </p>
        {review.questions.map((q) => (
          <section key={q.questionId} className="grid gap-3 rounded-lg border p-4" aria-label={`Questão ${labelOf(q)}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold">Questão {labelOf(q)}</h3>
              <span className="text-sm text-muted-foreground">Cotação: {fmt(q.maxScore)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{q.text}</p>
            <div className="rounded-md bg-muted/60 p-3 text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Chave</span>
              {q.modelAnswer?.trim() ? <span className="whitespace-pre-wrap">{q.modelAnswer}</span> : <span className="text-muted-foreground">Esta questão não tem resposta modelo: corrija à mão.</span>}
            </div>
            <ul className="divide-y">
              {q.answers.map((a) => {
                const pending = a.status === 'PENDING_REVIEW';
                return (
                  <li key={a.answerId} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_140px] sm:items-start">
                    <div className="min-w-0">
                      <b className="text-sm">{a.displayName ?? `Aluno ${a.accountId}`}</b>
                      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.answerText?.trim() ? a.answerText : 'Sem resposta'}</p>
                    </div>
                    {pending ? (
                      <div className="grid gap-1">
                        <div className="flex items-center gap-2">
                          <Input
                            inputMode="decimal"
                            aria-label={`Nota de ${a.displayName ?? a.accountId} na questão ${labelOf(q)}`}
                            aria-invalid={invalid.has(a.answerId) || undefined}
                            placeholder={`0–${fmt(q.maxScore)}`}
                            value={drafts[a.answerId] ?? ''}
                            onChange={(e) => setDrafts((d) => ({ ...d, [a.answerId]: e.target.value }))}
                          />
                          {q.maxScore != null ? (
                            <Button
                              type="button" size="icon" variant="ghost" aria-label="Cotação inteira"
                              onClick={() => setDrafts((d) => ({ ...d, [a.answerId]: String(q.maxScore) }))}
                            >
                              <CheckCheck size={16} aria-hidden />
                            </Button>
                          ) : null}
                        </div>
                        {invalid.has(a.answerId) ? <span className="text-xs text-destructive">Entre 0 e {fmt(q.maxScore)}.</span> : null}
                      </div>
                    ) : (
                      <Badge variant="success" className="justify-self-start sm:justify-self-end">Corrigida: {fmt(a.scoreObtained)}</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}

/**
 * A correção de uma sala de um plano do trimestre, só para leitura: a nota e a observação que a IA deu no fluxo do motor.
 * Não há campos de edição nem «Guardar»: quem quiser mudar uma nota apresenta uma reclamação (o único controlo humano),
 * e a sala já não fica à espera do professor para a pauta avançar.
 */
function AiCorrection({ review }: { review: RoomReview }) {
  const waiting = review.pending;
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Correção das respostas abertas</CardTitle>
        <Badge variant={waiting === 0 ? 'success' : 'secondary'}>
          {waiting === 0 ? 'Corrigida pela IA' : `${waiting} a aguardar correção automática`}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-6">
        <p className="text-sm text-muted-foreground">
          Esta prova é de um plano do trimestre: a correção das respostas abertas é feita pela IA no fluxo da pauta, sem passar
          pelo professor. Aqui lê o que ela deu a cada aluno; a nota só muda por reclamação.
        </p>
        {review.questions.map((q) => (
          <section key={q.questionId} className="grid gap-3 rounded-lg border p-4" aria-label={`Questão ${labelOf(q)}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h3 className="font-semibold">Questão {labelOf(q)}</h3>
              <span className="text-sm text-muted-foreground">Cotação: {fmt(q.maxScore)}</span>
            </div>
            <p className="whitespace-pre-wrap text-sm">{q.text}</p>
            <ul className="divide-y">
              {q.answers.map((a) => (
                <li key={a.answerId} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
                  <div className="min-w-0">
                    <b className="text-sm">{a.displayName ?? `Aluno ${a.accountId}`}</b>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{a.answerText?.trim() ? a.answerText : 'Sem resposta'}</p>
                  </div>
                  <div className="grid gap-1">
                    <Badge variant={a.status === 'PENDING_REVIEW' ? 'secondary' : 'success'} className="justify-self-start">
                      {aiStateLabel(a)}{a.status !== 'PENDING_REVIEW' ? `: ${fmt(a.scoreObtained)}` : ''}
                    </Badge>
                    {a.aiLevel ? <span className="text-xs text-muted-foreground">{AI_LEVEL_LABEL[a.aiLevel] ?? a.aiLevel}</span> : null}
                    {a.aiFeedback ? <p className="whitespace-pre-wrap text-sm">{a.aiFeedback}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
