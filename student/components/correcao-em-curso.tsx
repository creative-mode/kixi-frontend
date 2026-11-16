'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { BASE_PATH } from '@/lib/base-path';
import { tentarCorrecaoDeNovo } from '@/lib/correcao-actions';
import { faseDaEspera, passosDaEspera, SEM_SAIDA_MS } from '@/lib/correcao-espera';
import { formatScore } from '@/lib/result-rules';
import type { MotivoDaFalha } from '@/lib/schoolops/correcao-rules';

/**
 * A prova entregue ainda está a ser corrigida (kixi#542). Não há erro nem desistência: o ecrã tranquiliza, mostra em que
 * ponto está (entregue, a corrigir, resultado) e diz que o aluno pode sair; o resultado aparece nas provas assim que
 * estiver pronto. Enquanto o ecrã está à vista volta a ler o estado da correcção, cada vez mais devagar, e pára quando está escondido.
 *
 * `desdeMs`: o tempo que já passou quando o ecrã abre (uma correção que o motor atrasou abre já na fase calma e longa).
 *
 * `correcaoId`: quando presente, a espera lê o estado pela rota leve `/api/correcao/status/{id}` em vez de
 * `router.refresh()` (uma chamada de rede por leitura, resposta em menos de 1 s — #794).
 *
 * Nunca deixa o aluno sem saída (#787): passados 10 minutos, ou logo que o motor recusa o pedido ou a correção fica com um
 * incidente (`falha`), o ecrã mostra a nota das questões fechadas como provisória, diz que as abertas ficam por corrigir
 * e oferece «Tentar de novo», que volta a pedir a correção.
 */
export function CorrecaoEmCurso({
  desdeMs = 0,
  simulationId,
  correcaoId,
  provisoria = null,
  falha,
}: {
  desdeMs?: number;
  simulationId: number;
  correcaoId?: string | null;
  provisoria?: { pontos: number; maximo: number } | null;
  falha?: MotivoDaFalha;
}) {
  const router = useRouter();
  const inicio = useRef(Date.now() - desdeMs);
  const [decorrido, setDecorrido] = useState(desdeMs);
  const [erroPoll, setErroPoll] = useState<string | null>(null);

  // Polling do estado da correção: rota leve quando há correcaoId (#794), router.refresh() como fallback.
  useEffect(() => {
    if (falha) return; // o motor já disse que não corrige: não há nada para ler; a saída é «Tentar de novo»
    let timer: ReturnType<typeof setTimeout> | undefined;
    let parado = false;
    const controller = new AbortController();

    const consultar = async () => {
      if (parado) return;
      if (correcaoId) {
        try {
          // BASE_PATH: a app serve em /aluno; um fetch do browser não o recebe de graça.
          const res = await fetch(
            `${BASE_PATH}/api/correcao/status/${encodeURIComponent(correcaoId)}?simulationId=${simulationId}`,
            { cache: 'no-store', signal: controller.signal },
          );
          if (res.ok) {
            const data = (await res.json()) as { kind: string };
            setErroPoll(null);
            // Se a correção terminou (corrigida, incompleta ou falhou), recarrega a página
            // uma vez para mostrar o resultado; enquanto "a-corrigir" continua a ler.
            if (data.kind !== 'a-corrigir') {
              router.refresh();
              return;
            }
          } else if (res.status === 404 || res.status === 403) {
            // 404/403: a correção não é nossa ou já não existe; não insistir.
            setErroPoll('Não foi possível confirmar o estado da correcção.');
            return;
          } else {
            // 5xx/503: motor ou backend em baixo; continua a tentar.
            setErroPoll('O servidor está a demorar a responder.');
          }
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
          setErroPoll('Sem ligação ao servidor.');
        }
      } else {
        // Sem correcaoId (ex.: ecrã aberto antes da entrega): recorre ao router.refresh() da página inteira.
        router.refresh();
      }
    };

    const passo = () => {
      if (parado) return;
      const agora = Date.now() - inicio.current;
      setDecorrido(agora);
      if (!document.hidden) {
        consultar();
      }
      timer = setTimeout(passo, faseDaEspera(agora).intervaloMs);
    };

    const aoVoltar = () => {
      if (!document.hidden && !parado) {
        clearTimeout(timer);
        passo();
      }
    };

    // Consulta inicial imediata
    consultar();
    timer = setTimeout(passo, faseDaEspera(Date.now() - inicio.current).intervaloMs);
    document.addEventListener('visibilitychange', aoVoltar);
    return () => {
      parado = true;
      controller.abort();
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', aoVoltar);
    };
  }, [router, falha, correcaoId, simulationId]);

  const fase = faseDaEspera(decorrido);
  const passos = passosDaEspera();
  const semSaida = decorrido >= SEM_SAIDA_MS;

  if (falha) {
    return (
      <div role="status" data-testid="correcao-falhou" data-motivo={falha} className="grid justify-items-center gap-5 px-2 py-4 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-warning/15 text-warning" aria-hidden>
          <AlertTriangle className="size-7" />
        </span>
        <div className="grid max-w-md gap-2">
          <h2 className="text-lg font-bold leading-snug">Não conseguimos corrigir a tua prova agora</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            A tua prova está guardada, só a correção automática não terminou. Podes tentar de novo daqui a pouco; se continuar assim, fala com o teu professor.
          </p>
        </div>
        <Saida simulationId={simulationId} provisoria={provisoria} />
      </div>
    );
  }

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

      {erroPoll ? (
        <p role="status" className="max-w-md rounded-lg bg-warning/10 px-4 py-2 text-sm text-warning">
          {erroPoll}
        </p>
      ) : null}

      {semSaida ? (
        <Saida simulationId={simulationId} provisoria={provisoria} />
      ) : (
        <Button asChild variant="outline">
          <Link href="/provas">Ver as minhas provas</Link>
        </Button>
      )}
    </div>
  );
}

/** A saída do aluno: a nota das questões fechadas como provisória, a nova tentativa e o regresso às provas. */
function Saida({ simulationId, provisoria }: { simulationId: number; provisoria: { pontos: number; maximo: number } | null }) {
  const router = useRouter();
  const [aTentar, tentar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const tentarDeNovo = () =>
    tentar(async () => {
      setErro(null);
      const r = await tentarCorrecaoDeNovo(simulationId).catch(() => ({ ok: false }));
      if (!r.ok) setErro('Ainda não foi possível. Tenta daqui a pouco.');
      router.refresh();
    });

  return (
    <div className="grid w-full max-w-md justify-items-center gap-4">
      {provisoria ? (
        <p data-testid="nota-provisoria" className="w-full rounded-lg border border-border bg-secondary/70 px-4 py-3 text-left text-sm leading-relaxed">
          <b>Nota provisória das questões fechadas: {formatScore(provisoria.pontos)} de {formatScore(provisoria.maximo)} valores.</b>{' '}
          As questões abertas ficam por corrigir e a nota final pode mudar.
        </p>
      ) : (
        <p className="w-full rounded-lg border border-border bg-secondary/70 px-4 py-3 text-left text-sm leading-relaxed">
          As questões abertas ficam por corrigir. Ainda não há nota.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-2.5">
        <Button type="button" onClick={tentarDeNovo} disabled={aTentar} aria-busy={aTentar}>
          {aTentar ? <Spinner className="size-4" /> : null}
          {aTentar ? 'A tentar…' : 'Tentar de novo'}
        </Button>
        <Button asChild variant="outline">
          <Link href="/provas">Ver as minhas provas</Link>
        </Button>
      </div>
      {erro ? <p role="alert" className="text-sm text-destructive">{erro}</p> : null}
    </div>
  );
}