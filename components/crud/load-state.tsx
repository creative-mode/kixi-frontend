import type { ReactNode } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TableCell, TableRow } from '@/components/ui/table';

/** O estado de uma leitura: a carregar, falhada (com saída), vazia ou pronta.
 *
 *  A regra que este componente impõe: uma falha do servidor nunca se pinta de
 *  "vazio" nem de esqueleto infinito. Falha é erro com "Tentar novamente";
 *  vazio é só quando a leitura correu bem e não há nada.
 */
export type LoadStatus =
  | { status: 'loading' }
  | { status: 'error'; message: string; onRetry: () => void }
  | { status: 'empty' }
  | { status: 'ok' };

/** Erro de leitura: o que falhou e o botão que tenta de novo. `role="alert"`
 *  para o leitor de ecrã anunciar a falha sem ser preciso procurá-la. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <TriangleAlert className="size-5 text-warning" aria-hidden />
      <p className="max-w-sm text-sm text-destructive">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="size-3.5" aria-hidden />
        Tentar novamente
      </Button>
    </div>
  );
}

/** Vazio verdadeiro: a leitura correu bem e não há nada. Sem live region —
 *  não é um acontecimento, é só ausência de conteúdo. */
export function LoadEmpty({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-16 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

/** Os três estados numa tabela: esqueleto, erro com retry ou vazio. O `ok`
 *  devolve `null` — quem chama pinta as linhas. */
export function LoadStateRow({
  state,
  cols,
  loading,
  empty,
}: {
  state: LoadStatus;
  cols: number;
  loading: ReactNode;
  empty: ReactNode;
}) {
  if (state.status === 'ok') return null;
  // O esqueleto pinta as suas próprias linhas: embrulhá-lo numa célula seria
  // uma tabela dentro de uma célula.
  if (state.status === 'loading') return <>{loading}</>;
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={cols} className="text-center">
        {state.status === 'error' ? (
          <LoadError message={state.message} onRetry={state.onRetry} />
        ) : (
          <LoadEmpty>{empty}</LoadEmpty>
        )}
      </TableCell>
    </TableRow>
  );
}
