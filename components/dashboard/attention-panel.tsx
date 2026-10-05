import { CheckCircle2, FileSearch, KeyRound, PlayCircle } from 'lucide-react';
import type { Overview } from '@/types/analytics';
import { formatInt } from '@/lib/format';

/** What needs a human right now: drafts to review, exams that cannot be graded, attempts in flight. */
export function AttentionPanel({ overview }: { overview: Overview }) {
  const items = [
    {
      count: overview.statements.needingReview,
      icon: FileSearch,
      label: 'provas por rever',
      hint: 'Importadas por OCR e ainda não aprovadas.',
      warn: true,
    },
    {
      count: overview.statements.missingAnswerKey,
      icon: KeyRound,
      label: 'provas sem gabarito completo',
      hint: 'Não podem ser publicadas nem corrigidas automaticamente.',
      warn: true,
    },
    {
      count: overview.simulations.inProgress,
      icon: PlayCircle,
      label: 'simulações em curso',
      hint: 'Estudantes a fazer uma prova neste momento.',
      warn: false,
    },
  ];

  const needsAction = items.some((i) => i.warn && i.count > 0);

  return (
    <div className="space-y-3">
      {!needsAction && (
        <p className="flex items-center gap-2 rounded-md border-2 border-primary/40 bg-accent px-3 py-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Tudo em dia: nenhuma prova à espera de revisão ou gabarito.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map(({ count, icon: Icon, label, hint, warn }) => (
          <li key={label} className="flex items-start gap-3 rounded-md border-2 border-border p-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border-2 border-current/40 ${
                warn && count > 0 ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-foreground">
                <span className="mr-1 text-base tabular-nums">{formatInt(count)}</span>
                {label}
              </p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
