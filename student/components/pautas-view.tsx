import { TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatGrade, groupByTerm, isNegative, SEM_NOTA, STATUS_LABEL, termLabel, type MyTermSheet, type RowStatus } from '@/lib/pautas-rules';

const VARIANT: Record<RowStatus, 'success' | 'destructive' | 'secondary'> = { POSITIVA: 'success', NEGATIVA: 'destructive', INCOMPLETA: 'secondary' };

function Grade({ value, strong = false }: { value: number | null; strong?: boolean }) {
  if (value === null) return <span className="text-muted-foreground" aria-label="sem nota">{SEM_NOTA}</span>;
  return <span className={strong ? 'font-bold' : undefined}>{formatGrade(value)}</span>;
}

/**
 * As minhas pautas, por trimestre: só a linha do aluno, em pautas fechadas. A MT negativa não depende só da cor: o estado
 * leva o texto e um triângulo. Uma disciplina sem nota (faltou) mostra «Incompleta» e travessões, nunca zero.
 */
export function PautasView({ sheets }: { sheets: MyTermSheet[] }) {
  const groups = groupByTerm(sheets);
  return (
    <div className="grid gap-4 py-4">
      {groups.map((g) => (
        <Card key={g.key} className="gap-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-3">
            <h2 className="text-base font-bold">{termLabel(g.termNumber)} <span className="font-normal text-muted-foreground">· {g.schoolYear}</span></h2>
            <p className="text-sm text-muted-foreground tabular-nums">Média do trimestre <strong className="text-foreground">{formatGrade(g.average)}</strong></p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">As minhas notas do {termLabel(g.termNumber)}, {g.schoolYear}</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-medium">Disciplina</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">MAC</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">P1</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">P2</th>
                  <th scope="col" className="px-2 py-2 text-right font-medium">MT</th>
                  <th scope="col" className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {g.sheets.map((s) => {
                  const negative = isNegative(s.row.mt);
                  return (
                    <tr key={s.sheetId} className="border-t">
                      <th scope="row" className="px-4 py-2.5 text-left font-medium">{s.subjectName}</th>
                      <td className="px-2 py-2.5 text-right tabular-nums"><Grade value={s.row.mac} /></td>
                      <td className="px-2 py-2.5 text-right tabular-nums"><Grade value={s.row.p1} /></td>
                      <td className="px-2 py-2.5 text-right tabular-nums"><Grade value={s.row.p2} /></td>
                      <td className={`px-2 py-2.5 text-right tabular-nums ${negative ? 'underline decoration-destructive decoration-2 underline-offset-4' : ''}`}><Grade value={s.row.mt} strong /></td>
                      <td className="px-4 py-2.5">
                        <Badge variant={VARIANT[s.row.status]}>
                          {negative ? <TriangleAlert aria-hidden className="size-3" /> : null}
                          {STATUS_LABEL[s.row.status]}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ))}
    </div>
  );
}
