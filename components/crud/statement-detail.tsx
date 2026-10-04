'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getStatementFull } from '@/app/actions/crud';
import { ENTITIES, type Row } from '@/lib/crud/entities';
import { PageHead } from './page-head';

export function StatementDetail({ id }: { id: number }) {
  const [s, setS] = useState<Row | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    getStatementFull(id).then((r) => (r.ok ? setS(r.data) : setError(r.error)));
  }, [id]);

  const entity = ENTITIES.statements;
  const questions: Row[] = s?.questions ?? [];
  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <PageHead entity={entity} title={s?.title ?? 'Enunciado'} subtitle={s ? `${s.examType}${s.variant ? ` · variante ${s.variant}` : ''}` : ''} back={{ href: '/statements', label: 'Voltar à lista' }} />
      {error ? (
        <p className="py-12 text-center text-sm text-destructive">{error}</p>
      ) : !s ? (
        <p className="py-12 text-center text-sm text-muted-foreground">A carregar…</p>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardContent className="grid gap-4 p-6 text-sm sm:grid-cols-4">
              <Info label="Duração" value={s.durationMinutes ? `${s.durationMinutes} min` : '—'} />
              <Info label="Cotação" value={s.totalMaxScore != null ? String(s.totalMaxScore).replace('.', ',') : '—'} />
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
                <div key={q.id} className="rounded-[4px] border-2 border-border p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <strong>Questão {q.number}</strong>
                    <Badge variant="outline">{q.questionType}</Badge>
                    {q.maxScore != null ? <span className="text-xs text-muted-foreground">{String(q.maxScore).replace('.', ',')} val.</span> : null}
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
                </div>
              ))}
            </CardContent>
          </Card>
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
