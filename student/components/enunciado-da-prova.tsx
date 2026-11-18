import { ChevronDown, FileText } from 'lucide-react';
import { FolhaDaProva } from '@/components/folha-da-prova';
import { getQuestionImages, getStatementFull, loadPaperMeta } from '@/lib/exam';

/**
 * O enunciado da prova na folha oficial, só para ler, na página da prova: o aluno vê o que vai fazer antes de escolher
 * o modo. O servidor entrega a variante de aluno, sem a chave: a resposta certa só aparece na prova corrigida.
 *
 * Fechado por omissão (#820): a folha inteira é o conteúdo mais pesado da página e é consulta, não decisão. O aluno
 * abre-a quando quer ver as questões; quem só quer a nota ou continuar não paga os dois ecrãs de rolo.
 */
export async function EnunciadoDaProva({ statementId }: { statementId: number }) {
  const full = await getStatementFull(statementId, { cached: true });
  if (!full.ok || full.data.questions.length === 0) return null;
  const questions = full.data.questions;
  const [meta, entries] = await Promise.all([
    loadPaperMeta(full.data),
    Promise.all(questions.map(async (q) => [q.id, await getQuestionImages(q.id)] as const)),
  ]);

  return (
    <div className="mx-auto w-full max-w-[960px] px-4 pb-24 md:px-7 md:pb-10">
      <details className="group rounded-xl border bg-card text-card-foreground">
        <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-5 py-3.5 [&::-webkit-details-marker]:hidden">
          <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="min-w-0">
            <span className="block text-[15px] font-bold leading-tight tracking-tight">Ver o enunciado</span>
            <span className="block text-[13px] text-muted-foreground">A prova como o professor a montou</span>
          </span>
          <ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="grid gap-3 border-t p-3 sm:p-5">
          <p className="text-sm text-muted-foreground">A chave só aparece depois de a corrigires.</p>
          <div className="overflow-x-auto rounded-lg border bg-muted/50 p-2 sm:p-3">
            <FolhaDaProva meta={meta} questions={questions} images={Object.fromEntries(entries)} />
          </div>
        </div>
      </details>
    </div>
  );
}
