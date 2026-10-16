import { Card } from '@/components/ui/card';
import { FolhaDaProva } from '@/components/folha-da-prova';
import { getQuestionImages, getStatementFull, loadPaperMeta } from '@/lib/exam';

/**
 * O enunciado da prova na folha oficial, só para ler, na página da prova: o aluno vê o que vai fazer antes de escolher
 * o modo. O servidor entrega a variante de aluno, sem a chave: a resposta certa só aparece na prova corrigida.
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
    <div className="mx-auto w-full max-w-[960px] px-4 pb-10 md:px-7">
      <Card className="gap-3 p-3 sm:p-5" aria-label="Enunciado da prova">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight">O enunciado</h2>
          <p className="text-sm text-muted-foreground">A prova como foi montada pelo professor. A chave só aparece depois de a corrigires.</p>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-muted/50 p-2 sm:p-3">
          <FolhaDaProva meta={meta} questions={questions} images={Object.fromEntries(entries)} />
        </div>
      </Card>
    </div>
  );
}
