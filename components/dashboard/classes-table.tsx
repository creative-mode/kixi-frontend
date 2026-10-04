import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDuration, formatInt } from '@/lib/format';
import type { ClassStats } from '@/types/analytics';
import { ScoreCell } from './score-cell';

export function ClassesTable({ classes }: { classes: ClassStats[] }) {
  return (
    <Table>
      <caption className="sr-only">Turmas</caption>
      <TableHeader>
        <TableRow>
          <TableHead>Turma</TableHead>
          <TableHead>Curso</TableHead>
          <TableHead className="text-right">Estudantes</TableHead>
          <TableHead className="text-right">Provas</TableHead>
          <TableHead className="text-right">Simulações</TableHead>
          <TableHead className="text-right">Nota média</TableHead>
          <TableHead className="text-right">Tempo médio</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {classes.map((c) => (
          <TableRow key={c.id}>
            <th scope="row" className="p-2 text-left align-middle font-semibold">
              {c.code ?? `${c.grade}ª classe`}
              <span className="ml-2 text-xs font-normal text-muted-foreground">{c.grade}ª classe</span>
            </th>
            <TableCell className="text-muted-foreground">
              {c.course}
              {c.institution && <span> · {c.institution}</span>}
            </TableCell>
            <TableCell className="text-right tabular-nums">{formatInt(c.students)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatInt(c.statements)}</TableCell>
            <TableCell className="text-right tabular-nums">{formatInt(c.finishedSimulations)}</TableCell>
            <TableCell><ScoreCell percent={c.averageScorePercent} /></TableCell>
            <TableCell className="text-right tabular-nums">{formatDuration(c.averageTimeSeconds)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
