'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { deleteRow, getStatementFull } from '@/app/actions/crud';
import { ENTITIES, type Row } from '@/lib/crud/entities';
import { Confirm, type ConfirmState } from './confirm';
import { PageHead } from './page-head';
import { QuestionImages } from './question-images';
import { DetailSkeleton } from './loading';

const QUESTION_TYPES: Record<string, string> = { MULTIPLE_CHOICE: 'Escolha múltipla', TRUE_FALSE: 'Verdadeiro/falso', OPEN: 'Resposta aberta', SHORT_ANSWER: 'Resposta curta', ESSAY: 'Desenvolvimento' };
const score = (n: number) => new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(n);

export function StatementDetail({ id }: { id: number }) {
  const router = useRouter();
  const [s, setS] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  useEffect(() => {
    getStatementFull(id).then((r) => (r.ok ? setS(r.data) : setError(r.error)));
  }, [id]);

  function askDelete() {
    setConfirm({
      title: 'Apagar enunciado?',
      description: `«${s?.title ?? 'Enunciado'}» vai para a lixeira e deixa de aparecer aos alunos. Pode restaurá-lo depois.`,
      action: 'Apagar',
      destructive: true,
      run: async () => {
        const res = await deleteRow('statements', id);
        if (res.ok) {
          toast.success('Enunciado movido para a lixeira');
          router.push('/statements');
          router.refresh();
        } else toast.error(res.error);
      },
    });
  }

  const entity = ENTITIES.statements;
  const questions: Row[] = s?.questions ?? [];
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHead
        entity={entity}
        title={s?.title ?? 'Enunciado'}
        subtitle={s ? `${s.examType}${s.variant ? ` · variante ${s.variant}` : ''}` : ''}
        back={{ href: '/statements', label: 'Voltar à lista' }}
        actions={
          s ? (
            <Button
              variant="outline"
              className="text-muted-foreground hover:bg-danger-soft hover:text-destructive"
              onClick={askDelete}
            >
              <Trash2 size={16} /> Apagar
            </Button>
          ) : null
        }
      />
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
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Questões ({questions.length})</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {questions.length === 0 ? <p className="text-sm text-muted-foreground">Ainda sem questões extraídas.</p> : null}
              {questions.map((q) => (
                <div key={q.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <strong>Questão {q.number}</strong>
                    <Badge variant="outline">{QUESTION_TYPES[q.questionType] ?? q.questionType}</Badge>
                    {q.maxScore != null ? <span className="text-xs text-muted-foreground">{score(q.maxScore)} val.</span> : null}
                    {q.needsReview ? <Badge variant="secondary">A rever</Badge> : null}
                  </div>
                  <p className="text-sm">{q.text}</p>
                  {q.options?.length ? (
                    <ul className="mt-3 space-y-1 text-sm">
                      {q.options.map((o: Row) => (
                        <li key={o.id} className={o.isCorrect ? 'font-semibold' : 'text-muted-foreground'}>
                          {o.optionLabel}) {o.optionText}{o.isCorrect ? ' ✓' : ''}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <QuestionImages questionId={q.id} />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      )}
      <Confirm state={confirm} onClose={() => setConfirm(null)} />
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
