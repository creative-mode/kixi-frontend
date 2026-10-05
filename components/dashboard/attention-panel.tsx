import { CheckCircle2, FileSearch, KeyRound, PlayCircle } from 'lucide-react';
import type { Overview } from '@/types/analytics';
import { formatInt } from '@/lib/format';

/** What needs a human right now: drafts to review, exams that cannot be graded, attempts in flight. */
export function AttentionPanel({ overview }: { overview: Overview }) {
  const items = [
    {
      count: overview.statements.needingReview,
      icon: FileSearch,
      label: ['prova por rever', 'provas por rever'],
      hint: 'Importadas por OCR e ainda não aprovadas.',
      warn: true,
    },
    {
      count: overview.statements.missingAnswerKey,
      icon: KeyRound,
      label: ['prova sem gabarito completo', 'provas sem gabarito completo'],
      hint: 'Não podem ser publicadas nem corrigidas automaticamente.',
      warn: true,
    },
    {
      count: overview.simulations.inProgress,
      icon: PlayCircle,
      label: ['simulação em curso', 'simulações em curso'],
      hint: 'Estudantes a fazer uma prova neste momento.',
      warn: false,
    },
  ];

  const needsAction = items.some((i) => i.warn && i.count > 0);

  return (
    <div className="space-y-3">
      {!needsAction && (
        <p className="flex items-center gap-2 rounded-md border bg-accent px-3 py-2 text-sm text-primary">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          Tudo em dia: nenhuma prova à espera de revisão ou gabarito.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map(({ count, icon: Icon, label, hint, warn }) => (
          <li key={label[0]} className="flex items-start gap-3 rounded-md border p-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                warn && count > 0 ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </div>
            <div>
              <p className="text-sm text-foreground">
                <span className="mr-1 text-base tabular-nums">{formatInt(count)}</span>
                {count === 1 ? label[0] : label[1]}
              </p>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
