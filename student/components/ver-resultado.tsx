import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const VER_RESULTADO = 'Ver resultado';

/**
 * Um rótulo de acção numa linha só (#761). «Ver resultado» chegava a partir-se em duas
 * linhas e a sair descentrado quando a coluna apertava: `whitespace-nowrap` não o deixa
 * quebrar, `shrink-0` não o deixa encolher e a largura mínima mantém os botões da mesma
 * lista com o mesmo tamanho, seja qual for o texto.
 */
export const ACTION_LABEL = 'shrink-0 whitespace-nowrap min-w-32';

/** O botão que abre o resultado de uma tentativa corrigida, igual em todos os ecrãs. */
export function VerResultado({
  simulationId,
  variant = 'outline',
  size,
  className,
}: {
  simulationId: number | string;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm';
  className?: string;
}) {
  return (
    <Button asChild variant={variant} size={size} className={cn(ACTION_LABEL, className)}>
      <Link href={`/resultado?prova=${simulationId}`}>{VER_RESULTADO}</Link>
    </Button>
  );
}
