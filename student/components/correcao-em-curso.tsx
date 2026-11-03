'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { faseDaEspera, passosDaEspera } from '@/lib/correcao-espera';

/**
 * A prova entregue ainda está a ser corrigida (kixi#542). Não há erro nem desistência: o ecrã tranquiliza, mostra em que
 * ponto está (entregue, a corrigir, resultado) e diz que o aluno pode sair; o resultado aparece nas provas assim que
 * estiver pronto. Enquanto o ecrã está à vista volta a ler o resultado, cada vez mais devagar, e pára quando está escondido.
 *
 * `desdeMs`: o tempo que já passou quando o ecrã abre (uma correção que o motor atrasou abre já na fase calma e longa).
 */
export function CorrecaoEmCurso({ desdeMs = 0 }: { desdeMs?: number }) {
  const router = useRouter();
  const inicio = useRef(Date.now() - desdeMs);
  const [decorrido, setDecorrido] = useState(desdeMs);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let parado = false;
    const passo = () => {
      if (parado) return;
      const agora = Date.now() - inicio.current;
      setDecorrido(agora);
      // Escondido (outro separador): não gasta leituras; volta a ler quando o aluno regressa.
      if (!document.hidden) router.refresh();
      timer = setTimeout(passo, faseDaEspera(agora).intervaloMs);
    };
    const aoVoltar = () => {
      if (!document.hidden && !parado) {
        clearTimeout(timer);
        passo();
      }
    };
    timer = setTimeout(passo, faseDaEspera(Date.now() - inicio.current).intervaloMs);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      parado = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [router]);

  const fase = faseDaEspera(decorrido);
  const passos = passosDaEspera();

  return (
    <div role="status" aria-live="polite" data-testid="correcao-em-curso" data-fase={fase.id} className="grid justify-items-center gap-5 px-2 py-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary motion-safe:animate-pulse" aria-hidden>
        <Clock className="size-7" />
      </span>

      <div className="grid max-w-md gap-2">
        <h2 className="text-lg font-bold leading-snug">{fase.titulo}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{fase.mensagem}</p>
      </div>

      <ol className="flex w-full max-w-sm items-start justify-between gap-2" aria-label="Em que ponto está a correção">
        {passos.map((p) => (
          <li key={p.id} aria-current={p.estado === 'atual' ? 'step' : undefined} className="grid flex-1 justify-items-center gap-1.5">
            <span
              className={
                'grid size-8 place-items-center rounded-full border text-xs font-bold ' +
                (p.estado === 'feito'
                  ? 'border-success bg-success text-white'
                  : p.estado === 'atual'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground')
              }
            >
              {p.estado === 'feito' ? <Check className="size-4" aria-hidden /> : p.estado === 'atual' ? <Spinner className="size-4" /> : null}
            </span>
            <span className={'text-xs ' + (p.estado === 'seguinte' ? 'text-muted-foreground' : 'font-semibold')}>
              {p.rotulo}
              <span className="sr-only">{p.estado === 'feito' ? ': feito' : p.estado === 'atual' ? ': agora' : ': a seguir'}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="flex max-w-md items-start gap-2 rounded-lg bg-secondary/70 px-4 py-3 text-left text-sm leading-relaxed">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
        <span>
          <b>Não precisas de esperar aqui.</b> Podes sair deste ecrã e usar o Kixi à vontade: o resultado aparece nas tuas provas
          assim que a correção terminar, e esta página também se atualiza sozinha.
        </span>
      </p>

      {fase.conselho ? <p className="max-w-md text-sm text-muted-foreground">{fase.conselho}</p> : null}

      <Button asChild variant="outline">
        <Link href="/provas">Ver as minhas provas</Link>
      </Button>
    </div>
  );
}
