'use client';

import { Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { QuestionEditor } from '../question-editor';
import { move, type ProblemDetail } from '@/lib/exam/draft';
import { emptyQuestion, type ExamItem } from '@/lib/exam/schools';


/** As questões, com a soma de cotação e os avisos por resolver. */
export function QuestoesCard({
  items, onItems, distribute, total, unscoredCount, questionCount, problemas, onIrParaQuestao, onOpenOriginal, originalAtivo,
}: {
  items: ExamItem[];
  onItems: (items: ExamItem[]) => void;
  distribute: () => void;
  /** Total da prova, pela soma das questões com cotação. */
  total: number;
  /** Quantas ficam sem cotação. */
  unscoredCount: number;
  questionCount: number;
  /** Os avisos por resolver (mensagem e questões a rever), ou vazio se está tudo bem. */
  problemas: ProblemDetail[];
  onIrParaQuestao: (question: number, label?: string) => void;
  onOpenOriginal?: (pageIndex: number) => void;
  originalAtivo: boolean;
}) {
  return (
    <Card id="builder-questoes" className="scroll-mt-24">
      <CardHeader>
        <CardTitle>Questões</CardTitle>
        <CardDescription>
          Escolha o tipo de cada questão: dissertativa, escolha múltipla, verdadeiro/falso ou com alíneas (a, b, c…). Escolha múltipla e verdadeiro/falso precisam de resposta marcada para a prova poder ser publicada.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid min-w-0 gap-3">
        {items.map((it, i) => (
          <QuestionEditor
            key={it.uid ?? i}
            item={it}
            index={i}
            total={items.length}
            onChange={(patch) => onItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
            onRemove={() => onItems(items.filter((_, j) => j !== i))}
            onMove={(direction) => onItems(move(items, i, direction))}
            onOpenOriginal={originalAtivo ? onOpenOriginal : undefined}
          />
        ))}
        <Button variant="outline" size="sm" className="justify-self-start" onClick={() => onItems([...items, emptyQuestion()])}><Plus aria-hidden /> Questão</Button>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-3 text-sm">
          <span className="text-muted-foreground">
            {questionCount} questão(s), <b className="text-foreground">{total} valores</b>
          </span>
          {total > 0 && total !== 20 && (
            // O construtor manual não tem um campo de total declarado — a soma É o total —,
            // ao contrário de `statement-review.tsx` (que valida contra a declaração do professor
            // com `answerKeyIssues`, em `lib/crud/answer-key.ts`). Por isso este aviso não bloqueia
            // e não reaproveita a mensagem de lá: só sinaliza que a soma difere da escala por
            // omissão de 20.
            <span className="text-warning" role="status">Total: {total} valores — a escala por omissão é 20. Se a prova não é de 20, está tudo bem.</span>
          )}
          {unscoredCount > 0 && (
            // A soma do servidor **filtra** as perguntas sem cotação em vez de as contar como zero.
            <span className="flex flex-wrap items-center gap-2 text-muted-foreground">
              {unscoredCount} sem cotação, e sem cotação não conta para o total
              <Button type="button" variant="outline" size="sm" onClick={distribute}>Distribuir por igual</Button>
            </span>
          )}
        </div>
        {problemas.length > 0 && (
          <ul role="status" className="grid gap-2 rounded-lg bg-warning-soft px-3 py-2 text-[13px] text-warning">
            {problemas.map((p) => (
              <li key={p.message} className="grid gap-1.5">
                <span>{p.message}</span>
                {p.targets.length > 0 && (
                  <span className="flex flex-wrap gap-1">
                    {p.targets.map((t) => (
                      <Button
                        key={`${t.question}-${t.label ?? ''}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`ir-para-questao-${t.question}${t.label ?? ''}`}
                        onClick={() => onIrParaQuestao(t.question, t.label)}
                      >
                        Rever a questão {t.question}{t.label ?? ''}
                      </Button>
                    ))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
