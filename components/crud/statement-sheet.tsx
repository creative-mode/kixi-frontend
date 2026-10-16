'use client';

import { useEffect, useState } from 'react';
import { FileText, KeyRound, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRow, getStatementForReview, listRows } from '@/app/actions/crud';
import { listQuestionImages } from '@/app/actions/media';
import { ExamSheet } from '@/components/exam/exam-sheet';
import { draftFromStatement } from '@/lib/exam/from-statement';
import type { ExamDraft, School } from '@/lib/exam/schools';
import type { Row } from '@/lib/crud/entities';

const name = async (key: string, id: unknown): Promise<Row | null> => {
  if (id == null) return null;
  const r = await getRow(key, Number(id));
  return r.ok ? r.data : null;
};

/** O que se vê da prova: o enunciado, como o aluno o recebe, ou a chave, com a resposta de cada questão. */
type View = 'enunciado' | 'chave';

/**
 * A folha de um enunciado guardado, **exactamente como o construtor a monta**: o mesmo molde (cabeçalho da escola,
 * questões numeradas, alíneas, opções, figuras, regras e rodapé), em duas vistas: o enunciado, sem a resposta, que é o
 * que o aluno leva; e a chave, com a opção certa, o V/F de cada afirmação e a resposta esperada das abertas. Cada
 * vista imprime-se tal como se vê.
 *
 * Carrega tudo ao abrir (escola, disciplina, classe, figuras e a chave, que só o pessoal recebe), para a lista de
 * enunciados não pagar por folhas que ninguém abriu.
 */
export function SheetView({ statementId }: { statementId: number }) {
  const [view, setView] = useState<View>('enunciado');
  const [sheet, setSheet] = useState<{ draft: ExamDraft; school: School } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const review = await getStatementForReview(statementId);
      if (!alive) return;
      if (!review.ok) return setError(review.error);
      const statement = review.data;
      const questions: Row[] = statement.questions ?? [];
      const [institution, subjects, klass, year, lists] = await Promise.all([
        name('institutions', statement.institutionId),
        // `/subjects/{x}` procura pelo código e não pelo id, por isso a disciplina sai da lista.
        listRows('subjects'),
        name('classes', statement.classId),
        name('school-years', statement.schoolYearId),
        Promise.all(questions.map(async (q) => {
          const r = await listQuestionImages(Number(q.id));
          return [Number(q.id), r.ok ? (r.data as Row[]).map((i) => ({ imageUrl: String(i.imageUrl), caption: i.caption ?? null })) : []] as const;
        })),
      ]);
      if (!alive) return;
      setSheet(draftFromStatement(statement, {
        institution: institution?.name ?? null,
        subject: subjects.ok ? (subjects.data.find((s) => Number(s.id) === Number(statement.subjectId))?.name ?? null) : null,
        grade: klass?.grade ?? null,
        schoolYear: year?.startYear ? `${year.startYear}/${year.endYear ?? ''}`.replace(/\/$/, '') : null,
        images: Object.fromEntries(lists),
      }));
    })();
    return () => { alive = false; };
  }, [statementId]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!sheet) {
    return <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />A montar a folha…</p>;
  }
  return (
    <div className="grid gap-3">
      <style>{`@media print{body *{visibility:hidden}#exam-sheet,#exam-sheet *{visibility:visible}#exam-sheet{position:absolute;left:0;top:0;width:100%;box-shadow:none}@page{size:A4;margin:10mm}}`}</style>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg border bg-card p-1" role="group" aria-label="Vista da folha">
          <Button type="button" size="sm" variant={view === 'enunciado' ? 'default' : 'ghost'} aria-pressed={view === 'enunciado'} onClick={() => setView('enunciado')}>
            <FileText aria-hidden />Enunciado
          </Button>
          <Button type="button" size="sm" variant={view === 'chave' ? 'default' : 'ghost'} aria-pressed={view === 'chave'} onClick={() => setView('chave')}>
            <KeyRound aria-hidden />Chave
          </Button>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
          <Printer aria-hidden />Imprimir {view === 'chave' ? 'a chave' : 'o enunciado'}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-muted/50 p-2 sm:p-4">
        <ExamSheet school={sheet.school} draft={sheet.draft} keyMode={view === 'chave' ? 'always' : 'never'} />
      </div>
    </div>
  );
}

/** O cartão do detalhe de um enunciado: a folha só se monta quando se pede. */
export function StatementSheet({ statementId }: { statementId: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Folha da prova</CardTitle>
        {open ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Fechar</Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}><FileText aria-hidden />Ver a folha</Button>
        )}
      </CardHeader>
      {open && <CardContent><SheetView statementId={statementId} /></CardContent>}
    </Card>
  );
}
