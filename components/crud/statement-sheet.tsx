'use client';

import { useState } from 'react';
import { FileText, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getRow } from '@/app/actions/crud';
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

/**
 * A folha da prova de um enunciado guardado, no molde do construtor: é como o aluno a recebe na sala e como o
 * professor a imprime. Só se carrega ao abrir (escola, disciplina, classe e figuras são pedidos à parte), porque
 * o enunciado já mostrado ao lado não precisa deles.
 */
export function StatementSheet({ statement }: { statement: Row }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sheet, setSheet] = useState<{ draft: ExamDraft; school: School } | null>(null);

  async function show() {
    setOpen(true);
    if (sheet) return;
    setLoading(true);
    const questions: Row[] = statement.questions ?? [];
    const [institution, subject, klass, year, lists] = await Promise.all([
      name('institutions', statement.institutionId),
      name('subjects', statement.subjectId),
      name('classes', statement.classId),
      name('school-years', statement.schoolYearId),
      Promise.all(questions.map(async (q) => {
        const r = await listQuestionImages(Number(q.id));
        return [Number(q.id), r.ok ? (r.data as Row[]).map((i) => ({ imageUrl: String(i.imageUrl), caption: i.caption ?? null })) : []] as const;
      })),
    ]);
    setSheet(draftFromStatement(statement, {
      institution: institution?.name ?? null,
      subject: subject?.name ?? null,
      grade: klass?.grade ?? null,
      schoolYear: year?.startYear ? `${year.startYear}/${year.endYear ?? ''}`.replace(/\/$/, '') : null,
      images: Object.fromEntries(lists),
    }));
    setLoading(false);
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Folha da prova</CardTitle>
        {open ? (
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => window.print()} disabled={!sheet}><Printer aria-hidden />Imprimir</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Fechar</Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={show}><FileText aria-hidden />Ver a folha</Button>
        )}
      </CardHeader>
      {open && (
        <CardContent>
          <style>{`@media print{body *{visibility:hidden}#exam-sheet,#exam-sheet *{visibility:visible}#exam-sheet{position:absolute;left:0;top:0;width:100%;box-shadow:none}@page{size:A4;margin:10mm}}`}</style>
          {loading || !sheet ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" aria-hidden />A montar a folha…</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border bg-muted/50 p-2 sm:p-4">
              <ExamSheet school={sheet.school} draft={sheet.draft} />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
