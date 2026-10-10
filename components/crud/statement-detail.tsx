'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { approveStatement, getStatementFull, setCorrectOption, setStatementVisible } from '@/app/actions/crud';
import { ENTITIES, type Row } from '@/lib/crud/entities';
import { PageHead } from './page-head';
import { Confirm, type ConfirmState } from './confirm';
import { QuestionImages } from './question-images';
import { DetailSkeleton } from './loading';

const QUESTION_TYPES: Record<string, string> = { MULTIPLE_CHOICE: 'Escolha múltipla', multiple_choice: 'Escolha múltipla', TRUE_FALSE: 'Verdadeiro/falso', OPEN: 'Resposta aberta', open: 'Resposta aberta', SHORT_ANSWER: 'Resposta curta', ESSAY: 'Desenvolvimento' };
const score = (n: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(n);

/**
 * O enunciado como o professor o revê, e o sítio onde se publica.
 *
 * O botão de aprovar não é um formality: `POST /statements/{id}/approve` é o que
 * corre o gate do servidor, e o 422 que ele devolve — falta uma resposta correcta,
 * ou a soma das cotações não bate com o total — chega aqui com a frase do
 * servidor e a lista das questões. Publicar só por visibilidade saltaria o gate
 * inteiro, e é por isso que os dois botões andam juntos.
 */
export function StatementDetail({ id }: { id: number }) {
  const router = useRouter();
  const [s, setS] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const load = useCallback(async () => {
    const r = await getStatementFull(id);
    if (r.ok) { setS(r.data); setError(null); } else { setS(null); setError(r.error); }
  }, [id]);
  useEffect(() => {
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function mark(questionId: number, optionId: number) {
    const res = await setCorrectOption(questionId, optionId);
    if (!res.ok) return toast.error(res.error);
    toast.success('Resposta correcta marcada');
    load();
  }

  /** O 422 do gate diz o que falta e onde. Mostra-se tal e qual: traduzi-lo para
   *  uma mensagem genérica deixaria o professor a procurar as questões sem saber
   *  quais, e a lista de questões que a frase traz é a informação toda. */
  async function approve() {
    setBusy(true);
    setGate(null);
    const res = await approveStatement(id);
    setBusy(false);
    if (!res.ok) return setGate(res.error);
    toast.success('Enunciado aprovado');
    load();
  }

  function publish(visible: boolean) {
    setConfirm({
      title: visible ? 'Publicar a prova?' : 'Deixar de publicar a prova?',
      description: visible
        ? 'Os alunos da escola passam a vê-la e a poder simulá-la.'
        : 'Os alunos deixam de a ver. Continua guardada e pode ser publicada outra vez.',
      action: visible ? 'Publicar' : 'Ocultar',
      run: async () => {
        const res = await setStatementVisible(id, visible);
        if (res.ok) { toast.success(visible ? 'Prova publicada' : 'Prova oculta'); load(); router.refresh(); }
        else toast.error(res.error);
      },
    });
  }

  const entity = ENTITIES.statements;
  const questions: Row[] = s?.questions ?? [];
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHead entity={entity} title={s?.title ?? 'Enunciado'} subtitle={s ? `${s.examType}${s.variant ? ` · variante ${s.variant}` : ''}` : ''} back={{ href: '/statements', label: 'Voltar à lista' }} />
      {error ? (
        <p className="py-12 text-center text-sm text-destructive">{error}</p>
      ) : !s ? (
        <DetailSkeleton />
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="grid gap-4 p-6 text-sm sm:grid-cols-4">
              <Info label="Duração" value={s.durationMinutes ? `${s.durationMinutes} min` : '—'} />
              <Info label="Cotação" value={s.totalMaxScore != null ? score(s.totalMaxScore) : '—'} />
              <Info label="Origem" value={s.source ?? '—'} />
              <Info label="Confiança OCR" value={s.ocrConfidence != null ? `${Math.round(s.ocrConfidence * 100)}%` : '—'} />
            </CardContent>
            {s.instructions ? <CardContent className="border-t border-border p-6 text-sm text-muted-foreground">{s.instructions}</CardContent> : null}
            <div className="flex flex-wrap items-center gap-2 border-t p-4 print:hidden">
              <Badge variant={s.visible ? 'success' : 'secondary'}>{s.visible ? 'Publicada' : 'Oculta'}</Badge>
              {s.needsReview ? <Badge variant="warning">Por aprovar</Badge> : <Badge variant="info">Aprovada</Badge>}
              <span className="flex-1" />
              <Button variant="outline" onClick={approve} disabled={busy}>
                <Check aria-hidden />Aprovar
              </Button>
              {s.visible ? (
                <Button variant="outline" onClick={() => publish(false)}><EyeOff aria-hidden />Ocultar</Button>
              ) : (
                <Button onClick={() => publish(true)}><Eye aria-hidden />Publicar</Button>
              )}
            </div>
            {gate && (
              <div role="alert" className="border-t p-4 print:hidden">
                <p className="text-sm text-destructive">{gate}</p>
              </div>
            )}
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Questões ({questions.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {questions.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem questões.</p> : null}
              {questions.map((q) => (
                <div key={q.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <strong>Questão {q.number}</strong>
                    <Badge variant="outline">{QUESTION_TYPES[q.questionType] ?? q.questionType}</Badge>
                    {q.maxScore != null ? <span className="text-xs text-muted-foreground">{score(q.maxScore)} val.</span> : null}
                    {q.needsReview ? <Badge variant="secondary">A rever</Badge> : null}
                  </div>
                  <p className="text-sm">{q.text}</p>
                  {q.options?.length ? (
                    <ul className="mt-3 grid gap-1.5 text-sm">
                      {q.options.map((o: Row) => (
                        <li key={o.id}>
                          <button
                            type="button"
                            // O gabarito é o que separa "revistei" de "revisto e sei a
                            // resposta". Só o professor chega a esta resposta: o
                            // `StatementOcrResponse` esconde-a a quem não pode mudar o
                            // enunciado, e é o que o `/full` devolve a partir do BE-08.
                            aria-pressed={!!o.isCorrect}
                            aria-label={o.isCorrect ? `Opção ${o.optionLabel}, resposta correcta` : `Marcar a opção ${o.optionLabel} como resposta correcta`}
                            onClick={() => mark(q.id, o.id)}
                            className={`flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left transition-colors hover:bg-secondary ${o.isCorrect ? 'border-success bg-success-soft font-semibold' : 'border-transparent'}`}
                          >
                            <span className="tabular-nums">{o.optionLabel})</span>
                            <span className="flex-1">{o.optionText}</span>
                            {o.isCorrect && <Check className="size-4 shrink-0 text-success" aria-hidden />}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <QuestionImages questionId={q.id} />
                </div>
              ))}
            </CardContent>
          </Card>
          <Confirm state={confirm} onClose={() => setConfirm(null)} />
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}