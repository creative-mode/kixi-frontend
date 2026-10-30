import { TriangleAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatGrade, isNegative, ROW_STATUS_LABEL, SEM_NOTA, wasAbsent } from '@/lib/term-sheets';
import type { RowStatus, TermSheetRow } from '@/types/term-sheets';

const STATUS_VARIANT: Record<RowStatus, 'success' | 'destructive' | 'secondary'> = {
  POSITIVA: 'success',
  NEGATIVA: 'destructive',
  INCOMPLETA: 'secondary',
};

/** Uma nota ou «sem nota»: o travessão leva o texto para os leitores de ecrã, e nunca aparece um zero que não existe. */
function Grade({ value, emphasis = false }: { value: number | null; emphasis?: boolean }) {
  if (value === null) {
    return (
      <span className="text-muted-foreground" aria-label="sem nota">
        {SEM_NOTA}
      </span>
    );
  }
  return <span className={emphasis ? 'font-semibold' : undefined}>{formatGrade(value)}</span>;
}

/**
 * A pauta por aluno. A MT negativa não se distingue só pela cor: o estado traz o texto («Negativa») e um
 * triângulo, e a nota fica sublinhada. Quem faltou aparece como «Incompleta», com as notas por preencher.
 */
export function TermSheetTable({ rows, caption }: { rows: TermSheetRow[]; caption: string }) {
  return (
    <Table>
      <caption className="sr-only">{caption}</caption>
      <TableHeader>
        <TableRow>
          <TableHead scope="col" className="w-12">Nº</TableHead>
          <TableHead scope="col">Nome</TableHead>
          <TableHead scope="col" className="text-right">MAC</TableHead>
          <TableHead scope="col" className="text-right">P1</TableHead>
          <TableHead scope="col" className="text-right">P2</TableHead>
          <TableHead scope="col" className="text-right">MT</TableHead>
          <TableHead scope="col">Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {[...rows]
          .sort((a, b) => a.number - b.number)
          .map((row) => {
            const negative = isNegative(row.mt);
            return (
              <TableRow key={row.accountId} data-status={row.status}>
                <TableCell className="tabular-nums text-muted-foreground">{row.number}</TableCell>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell className="text-right tabular-nums"><Grade value={row.mac} /></TableCell>
                <TableCell className="text-right tabular-nums"><Grade value={row.p1} /></TableCell>
                <TableCell className="text-right tabular-nums"><Grade value={row.p2} /></TableCell>
                <TableCell className={`text-right tabular-nums ${negative ? 'underline decoration-destructive decoration-2 underline-offset-4' : ''}`}>
                  <Grade value={row.mt} emphasis />
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={STATUS_VARIANT[row.status]}>
                      {negative ? <TriangleAlert aria-hidden /> : null}
                      {ROW_STATUS_LABEL[row.status]}
                    </Badge>
                    {row.adjusted ? <Badge variant="outline">Ajustada</Badge> : null}
                    {wasAbsent(row) ? <span className="text-xs text-muted-foreground">faltou</span> : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}
