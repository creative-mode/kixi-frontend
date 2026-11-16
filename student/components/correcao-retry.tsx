'use client';

import { Button } from '@/components/ui/button';
import { Spinner, RotateCcw } from 'lucide-react';
import { useState } from 'react';

interface CorrecaoRetryProps {
  /** Callback quando o aluno clica em "Tentar de novo". */
  aoTentarDeNovo: () => void;
  /** Label do botão. */
  label?: string;
  /** Se está a tentar. */
  tentando?: boolean;
}

export function CorrecaoRetry({ aoTentarDeNovo, label = 'Tentar de novo', tentando = false }: CorrecaoRetryProps) {
  const [localTentando, setLocalTentando] = useState(false);

  const handleClick = () => {
    setLocalTentando(true);
    aoTentarDeNovo();
    // Reset após um tempo razoável para permitir nova tentativa se falhar
    setTimeout(() => setLocalTentando(false), 10_000);
  };

  return (
    <Button
      variant="default"
      onClick={handleClick}
      disabled={localTentando || tentando}
      className="gap-2"
    >
      {(localTentando || tentando) ? <Spinner className="size-4" /> : <RotateCcw className="size-4" />}
      {label}
    </Button>
  );
}