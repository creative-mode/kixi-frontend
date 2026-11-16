'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Check, Clock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { faseDaEspera, passosDaEspera } from '@/lib/correcao-espera';
import { CorrecaoRetry } from '@/components/correcao-retry';

type CorrecaoEmCursoProps = {
  /** Tempo que já passou quando o ecrã abre. */
  desdeMs?: number;
  /** Se true, mostra o botão "Tentar de novo". */
  podeTentarDeNovo?: boolean;
  /** Callback quando o aluno clica em "Tentar de novo". */
  aoTentarDeNovo?: () => void;
  /** Nota provisória (apenas questões objectivas) quando disponível. */
  notaProvisoria?: { pontos: number; maximo: number } | null;
  /** Estado de erro específico. */
  erro?: 'recusada' | 'conflito' | 'falhou' | null;
  /** Mensagem de erro para mostrar ao aluno. */
  mensagemErro?: string;
};

/**
 * A prova entregue ainda está a ser corrigida (kixi#542). Não há erro nem desistência: o ecrã tranquiliza, mostra em que
 * ponto está (entregue, a corrigir, resultado) e diz que o aluno pode sair; o resultado aparece nas provas assim que
 * estiver pronto. Enquanto o ecrã está à vista volta a ler o resultado, cada vez mais devagar, e pára quando está escondido.
 *
 * `desdeMs`: o tempo que já passou quando o ecrã abre (uma correção que o motor atrasou abre já na fase calma e longa).
 */
export function CorrecaoEmCurso({
  desdeMs = 0,
  podeTentarDeNovo = false,
  aoTentarDeNovo,
  notaProvisoria = null,
  erro = null,
  mensagemErro,
}: CorrecaoEmCursoProps) {
  const inicio = useRef<number>(0);
  const [decorrido, setDecorrido] = useState(desdeMs);
  const inicializado = useRef(false);

  // Inicializa o ref no primeiro efeito para evitar chamada impura durante render.
  useEffect(() => {
    if (!inicializado.current) {
      inicio.current = Date.now() - desdeMs;
      inicializado.current = true;
    }
  }, [desdeMs]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let parado = false;
    const passo = () => {
      if (parado) return;
      const agora = Date.now() - inicio.current;
      setDecorrido(agora);
      // Escondido (outro separador): não gasta leituras; volta a ler quando o aluno regressa.
      if (!document.hidden) {
        // Força refresh via router se estiver disponível no contexto
        try {
          const router = (window as unknown as { __NEXT_ROUTER__?: { refresh: () => void } }).__NEXT_ROUTER__;
          router?.refresh?.();
        } catch {
          // Ignora se router não estiver disponível
        }
      }
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
  }, []);

  const fase = faseDaEspera(decorrido);
  const passos = passosDaEspera();

  // Quando há erro definitivo, ajustamos a fase para não enganar o aluno.
  const ehErroDefinitivo = erro === 'recusada' || erro === 'falhou';
  const titulo = ehErroDefinitivo && !podeTentarDeNovo
    ? 'Não foi possível corrigir'
    : fase.titulo;
  const mensagem = ehErroDefinitivo && !podeTentarDeNovo && mensagemErro
    ? mensagemErro
    : fase.mensagem;
  const conselho = ehErroDefinitivo ? null : fase.conselho;

  return (
    <div role="status" aria-live="polite" data-testid="correcao-em-curso" data-fase={fase.id} className="grid justify-items-center gap-5 px-2 py-4 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary motion-safe:animate-pulse" aria-hidden>
        {ehErroDefinitivo && !podeTentarDeNovo ? <AlertTriangle className="size-7 text-destructive" /> : <Clock className="size-7" />}
      </span>

      <div className="grid max-w-md gap-2">
        <h2 className="text-lg font-bold leading-snug">{titulo}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">{mensagem}</p>
      </div>

      {notaProvisoria && (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-secondary/50 px-4 py-3 text-sm" role="status" aria-live="polite">
          <span className="font-semibold text-primary">{notaProvisoria.pontos} de {notaProvisoria.maximo}</span>
          <span className="text-muted-foreground">(nota provisória — apenas questões objectivas)</span>
        </div>
      )}

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

      {conselho ? <p className="max-w-md text-sm text-muted-foreground">{conselho}</p> : null}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button asChild variant="outline">
          <Link href="/provas">Ver as minhas provas</Link>
        </Button>
        {podeTentarDeNovo && aoTentarDeNovo && (
          <CorrecaoRetry aoTentarDeNovo={aoTentarDeNovo} />
        )}
      </div>
    </div>
  );
}
