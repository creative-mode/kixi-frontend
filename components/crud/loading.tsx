import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TableCell, TableRow } from '@/components/ui/table';

const WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/6', 'w-1/3'];

/** Linhas de tabela em esqueleto, para dentro de um `<TableBody>` enquanto a lista carrega. */
export function TableRowsSkeleton({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <TableRow key={r} aria-hidden className="hover:bg-transparent">
          {Array.from({ length: cols }, (_, c) => (
            <TableCell key={c}><Skeleton className={`h-4 ${c === cols - 1 ? 'ml-auto w-16' : WIDTHS[(r + c) % WIDTHS.length]}`} /></TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}

/** Formulário a carregar: rótulo + campo, repetidos, e os botões. */
export function FormSkeleton({ fields = 4 }: { fields?: number }) {
  return (
    <div role="status" aria-label="A carregar" className="grid gap-5">
      {Array.from({ length: fields }, (_, i) => (
        <div key={i} className="grid gap-2"><Skeleton className="h-3.5 w-24" /><Skeleton className="h-10 w-full" /></div>
      ))}
      <div className="flex justify-end gap-3 pt-2"><Skeleton className="h-10 w-24" /><Skeleton className="h-10 w-36" /></div>
    </div>
  );
}

/** Página de detalhe a carregar: cartão de dados e cartão de lista. */
export function DetailSkeleton() {
  return (
    <div role="status" aria-label="A carregar" className="grid gap-6">
      <Card><CardContent className="grid gap-4 p-6 sm:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="grid gap-2"><Skeleton className="h-3 w-16" /><Skeleton className="h-5 w-24" /></div>)}</CardContent></Card>
      <Card><CardContent className="grid gap-4 p-6">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 w-full" />)}</CardContent></Card>
    </div>
  );
}

/** Cabeçalho de página a carregar: ícone, título e descrição (o `PageHead`). */
function PageHeadSkeleton() {
  return (
    <div className="mb-8 flex items-center gap-3" aria-hidden>
      <Skeleton className="size-9" />
      <div className="grid gap-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-3.5 w-64 max-w-full" /></div>
    </div>
  );
}

/** Página de lista a carregar (`loading.tsx` das listas, #389): cabeçalho, pesquisa e linhas da tabela. */
export function ListPageSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div role="status" aria-label="A carregar" className="mx-auto max-w-7xl p-4 md:p-8">
      <PageHeadSkeleton />
      <Card>
        <div className="border-b border-border p-4"><Skeleton className="h-9 w-full max-w-sm" /></div>
        <CardContent className="p-0">
          <table className="w-full"><tbody><TableRowsSkeleton cols={cols} rows={8} /></tbody></table>
        </CardContent>
      </Card>
    </div>
  );
}
