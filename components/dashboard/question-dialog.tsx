'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getStatementQuestions } from '@/app/actions/analytics';
import { TONE_BAR, TONE_TEXT, formatPercent, scoreTone } from '@/lib/format';
import type { QuestionStats, Section, StatementStats } from '@/types/analytics';
import { SectionState } from './section-state';

const TYPE_LABEL: Record<string, string> = {
  multiple_choice: 'Escolha múltipla',
  true_false: 'Verdadeiro/Falso',
  short_answer: 'Resposta curta',
  development: 'Desenvolvimento',
  unknown: 'Outro',
};

/** Question-by-question results of one statement, hardest first, to spot learning gaps. */
export function QuestionDialog({ statement, onClose }: { statement: StatementStats | null; onClose: () => void }) {
  const [section, setSection] = useState<Section<QuestionStats[]> | null>(null);
  const id = statement?.id;

  // Bumped by "Tentar novamente" to re-run the fetch effect.
  const [attempt, setAttempt] = useState(0);

  // The parent re-mounts this component per statement (key), so state starts fresh as `null` (loading).
  useEffect(() => {
    if (id == null) return;
    let cancelled = false;
    void getStatementQuestions(id).then((result) => {
      if (!cancelled) setSection(result);
    });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const retry = () => {
    setSection(null);
    setAttempt((n) => n + 1);
  };

  return (
    <Dialog open={statement !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{statement?.title ?? 'Prova'}</DialogTitle>
          <DialogDescription>
            Percentagem de estudantes que acertaram cada questão. Questões não respondidas contam como erradas.
          </DialogDescription>
        </DialogHeader>

        <SectionState
          section={section}
          onRetry={retry}
          skeletonClassName="h-48"
          isEmpty={(questions) => questions.length === 0}
          empty="Esta prova ainda não tem questões."
        >
          {(questions) => {
            const hardest = [...questions]
              .filter((q) => q.correctPercent != null)
              .sort((a, b) => (a.correctPercent ?? 0) - (b.correctPercent ?? 0))[0];
            return (
              <div className="space-y-4">
                {hardest && (
                  <p className="rounded-[4px] border-2 border-tiro-edge bg-tiro-tint px-3 py-2 text-sm text-tiro-ink">
                    Questão mais difícil: <strong>Q{hardest.number}</strong> ({formatPercent(hardest.correctPercent)} de acertos).
                  </p>
                )}
                <ol className="space-y-3">
                  {questions.map((q) => {
                    const tone = scoreTone(q.correctPercent);
                    return (
                      <li key={q.id} className="rounded-[4px] border-2 border-border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm text-foreground">
                            <span className="mr-2 font-semibold">Q{q.number}</span>
                            {q.text}
                          </p>
                          <span className={`shrink-0 text-sm font-semibold tabular-nums ${TONE_TEXT[tone]}`}>
                            {formatPercent(q.correctPercent)}
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden border border-border bg-surface-sunken" aria-hidden>
                          <div
                            className={`h-full ${TONE_BAR[tone]}`}
                            style={{ width: `${q.correctPercent ?? 0}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {TYPE_LABEL[q.questionType] ?? q.questionType}
                          {q.correctPercent == null
                            ? ' · correção manual (não entra na nota automática)'
                            : ` · ${q.correct} de ${q.attempts} acertaram`}
                          {q.maxScore != null && ` · ${q.maxScore} pts`}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            );
          }}
        </SectionState>
      </DialogContent>
    </Dialog>
  );
}
