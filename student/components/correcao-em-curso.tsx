'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Bell, Check, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { tentarCorrecaoDeNovo } from '@/lib/correcao-actions';
import { previsaoEmTexto, progressoEmTexto, situacaoDaEspera } from '@/lib/correcao-previsao';
import { faseDaEspera, passosDaEspera, SEM_SAIDA_MS } from '@/lib/correcao-espera';
import { formatScore } from '@/lib/result-rules';
import type { MotivoDaFalha, ProgressoDoMotor } from '@/lib/schoolops/correcao-rules';

/**
 * A prova entregue ainda está a ser corrigida (kixi#542). Não há erro nem desistência: o ecrã tranquiliza, mostra em que
 * ponto está (entregue, a corrigir, resultado) e diz que o aluno pode sair; o resultado aparece nas provas assim que
 * estiver pronto. Enquanto o ecrã está à vista volta a ler o resultado, cada vez mais devagar, e pára quando está escondido.
 *
 * `desdeMs`: o tempo que já passou quando o ecrã abre (uma correção que o motor atrasou abre já na fase calma e longa).
 *
 * Nunca deixa o aluno sem saída (#787): passados 10 minutos, ou logo que o motor recusa o pedido ou a correção fica com um
 * incidente (`falha`), o ecrã mostra a nota das questões fechadas como provisória, diz que as abertas ficam por corrigir
 * e oferece «Tentar de novo», que volta a pedir a correção.
 *
 * Em qualquer momento da espera o aluno vê o que já está feito e uma previsão (#792): a nota das objectivas, como parcial,
 * as respostas abertas já corrigidas e quanto falta. `progresso` e `previsaoSegundos` vêm do motor; sem eles estima-se
 * pelo número de abertas da prova (`abertas`).
 */
export function CorrecaoEmCurso({
  desdeMs = 0,
  simulationId,
  provisoria = null,
  falha,
  abertas = 0,
  progresso,
  previsaoSegundos,
}: {
  desdeMs?: number;
  simulationId: number;
  provisoria?: { pontos: number; maximo: number } | null;
  falha?: MotivoDaFalha;
  abertas?: number;
  progresso?: ProgressoDoMotor;
  previsaoSegundos?: number;
}) {
  const router = useRouter();
  const inicio = useRef(Date.now() - desdeMs);
  const [decorrido, setDecorrido] = useState(desdeMs);

  useEffect(() => {
    if (falha) return; // o motor já disse que não corrige: não há nada para ler; a saída é «Tentar de novo»
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
  }, [router, falha]);

  const fase = faseDaEspera(decorrido);
  const passos = passosDaEspera();
  const semSaida = decorrido >= SEM_SAIDA_MS;
  const situacao = situacaoDaEspera({ progresso, previsaoSegundos, abertas, decorridoMs: decorrido });

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

      {provisoria ? (
        <section
          aria-label="Nota das questões objectivas"
          data-testid="nota-parcial"
          className="grid w-full max-w-md gap-1.5 rounded-xl border border-border bg-secondary/70 px-4 py-4 text-left"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">Objectivas, já corrigidas</h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">pelo gabarito</span>
          </div>
          <p className="tabular-nums">
            <span className="text-3xl font-bold">{formatScore(provisoria.pontos)}</span>{' '}
            <span className="text-muted-foreground">de {formatScore(provisoria.maximo)} valores</span>
          </p>
          <p className="text-sm text-muted-foreground">Nota parcial. A nota final junta as respostas abertas.</p>
        </section>
      ) : null}

      {situacao ? (
        <section aria-label="Respostas abertas" data-testid="progresso-abertas" data-origem={situacao.origem ?? 'sem-previsao'} className="grid w-full max-w-md gap-2 text-left">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold">Respostas abertas</h3>
            <p className="text-sm text-muted-foreground tabular-nums">
              <b className="text-foreground">{situacao.corrigidas} de {situacao.total}</b> corrigidas
            </p>
          </div>
          <Progress value={situacao.percentagem} aria-label={progressoEmTexto(situacao.corrigidas, situacao.total)} />
          <p data-testid="previsao" className="text-sm text-muted-foreground">
            {previsaoEmTexto(situacao.previsaoSegundos) ?? 'Estamos quase a acabar.'}
          </p>
        </section>
      ) : null}

      {!situacao && !provisoria ? (
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
      ) : null}

      <p className="flex w-full max-w-md items-start gap-3 rounded-xl border border-border px-4 py-3 text-left text-sm leading-relaxed">
        <Bell className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          <b>Podes sair deste ecrã.</b> Avisamos-te quando a nota estiver pronta, e esta página também se actualiza sozinha.
        </span>
      </p>

      {fase.conselho ? <p className="max-w-md text-sm text-muted-foreground">{fase.conselho}</p> : null}

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
