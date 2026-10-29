'use client';

import { useActionState, useCallback, useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import Link from 'next/link';
import { unstable_rethrow } from 'next/navigation';
import { ChevronLeft, ChevronRight, Clock, FileText, Flag, ListChecks, Loader2, RefreshCw, ShieldAlert, TriangleAlert, WifiOff } from 'lucide-react';
import { guardarAction, submeterAction } from '@/lib/exam-actions';
import { createSaveQueue, type SaveQueue, type Snapshot } from '@/lib/save-queue';
import { aRecuperar, guardarRascunho, lerRascunho, limparRascunho, type Armazem } from '@/lib/draft-store';
import { guardarMarcadas, lerMarcadas, limparMarcadas } from '@/lib/flag-store';
import { PASTE_NOTICE, pasteBlocked } from '@/lib/integrity';
import { useIntegrity } from '@/components/use-integrity';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  backoffMs,
  cellState,
  displayRemainingMs,
  formatClock,
  isChoice,
  remainingMs,
  timer,
  urgencyOf,
  type CellState,
  type ExamQuestion,
} from '@/lib/exam-rules';
import type { RoomData } from '@/lib/exam';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { displayNumber } from '@/lib/question-number';
import { FolhaDaProva } from '@/components/folha-da-prova';
import { assetUrl } from '@/lib/assets';

const CELL = {
  done: 'border-transparent bg-accent text-accent-foreground',
  flag: 'border-transparent bg-warning-soft text-warning',
  empty: 'bg-card text-muted-foreground',
  unsaved: 'border-destructive/50 bg-destructive/10 text-destructive',
} as const;

/** The id of the one form that delivers the proof. Both submit buttons point at
 *  it, so there is a single `simulationId` and no nested form. */
const SUBMIT_FORM = 'entregar-prova';

const CELL_LABEL: Record<CellState, string> = {
  done: 'respondida',
  flag: 'marcada para rever',
  empty: 'por responder',
  unsaved: 'por guardar',
};

const CELL_TEXT: Record<CellState, string> = {
  done: 'Respondida',
  flag: 'Para rever',
  empty: 'Por responder',
  unsaved: 'Por guardar',
};

/** One question's draft: what is on screen, which may be ahead of the server. The
 *  `answerId` is not here — it belongs to the save queue, which reads it when a
 *  request leaves, not when the student taps. */
type Draft = Snapshot;

function draftFrom(data: RoomData): Record<number, Draft> {
  return Object.fromEntries(
    data.questions.map((q) => {
      const saved = data.saved[q.id];
      return [q.id, saved ? { optionId: saved.optionId, text: saved.text } : { optionId: null, text: '' }];
    }),
  );
}

/** O armazém local, ou null se o browser o bloqueia (modo privado, política da escola): a prova funciona na mesma, sem rascunho local. */
function armazemLocal(): Armazem | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isAnswered(question: ExamQuestion, draft: Draft | undefined): boolean {
  if (!draft) return false;
  return isChoice(question) ? draft.optionId !== null : draft.text.trim().length > 0;
}

/** Confirmation before handing the proof in, and the place where the student is
 *  told what is still unanswered: a submission cannot be undone.
 *
 *  It does not carry its own `<form>`. The submitting form lives once in the room
 *  and this button joins it through `form=`, because a form inside a form is
 *  invalid HTML and the browser drops the inner one — the delivery would silently
 *  never reach the server.
 *
 *  Handing in is blocked while an answer is still on its way or has failed: the
 *  server grades what it holds, so delivering now would grade a proof that is
 *  missing something the student believes they answered. */
function Confirmar({
  unanswered,
  saving,
  failed,
  marked,
  pending,
  error,
  onCancel,
  onRetry,
}: {
  unanswered: number;
  saving: boolean;
  failed: number;
  marked: number;
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // O diálogo aparece por cima de uma página que pode estar rolada até ao mapa:
  // sem trazê-lo à vista e dar-lhe o foco, quem usa teclado ou leitor de ecrã não
  // sabe que abriu.
  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const blocked = saving || failed > 0;
  return (
    <Card
      ref={ref}
      tabIndex={-1}
      className="gap-4 border-warning/50 bg-warning-soft/40 p-5"
      role="alertdialog"
      aria-labelledby="confirmar"
      aria-describedby="confirmar-texto"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
        <div className="min-w-0 flex-1">
          <h2 id="confirmar" className="text-[15px] font-bold">Entregar a prova?</h2>
          <p id="confirmar-texto" className="mt-1 text-sm text-muted-foreground">
            {failed > 0
              ? `${failed === 1 ? '1 resposta não foi guardada' : `${failed} respostas não foram guardadas`}. Tenta de novo antes de entregar, senão a prova segue sem ${failed === 1 ? 'ela' : 'elas'}.`
              : saving
                ? 'A guardar as tuas respostas… Já podes entregar a seguir.'
                : unanswered === 0
                  ? 'Depois de entregar não dá para alterar as respostas.'
                  : unanswered === 1
                    ? 'Ficou 1 questão por responder. Depois de entregar não dá para alterar.'
                    : `Ficaram ${unanswered} questões por responder. Depois de entregar não dá para alterar.`}
          </p>
        </div>
      </div>
      <p className="text-[13px] text-muted-foreground">
        <Flag className="mr-1 inline size-4" aria-hidden />
        {marked === 0 ? 'Nenhuma questão marcada para rever.' : `Marcadas (${marked}) para rever.`}
      </p>
      {error && <p role="alert" className="text-[13px] font-medium text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2.5">
        {failed > 0 && (
          <Button type="button" variant="outline" onClick={onRetry}>
            <RefreshCw aria-hidden />Tentar de novo
          </Button>
        )}
        <Button type="submit" form={SUBMIT_FORM} disabled={pending || blocked}>
          {pending || (saving && failed === 0) ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Entregar
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          Continuar a responder
        </Button>
      </div>
    </Card>
  );
}

/** O aviso de sair a meio (#192): a tentativa não termina, mas não se sai por um
 *  toque a mais. Recebe o foco ao abrir, como o `Confirmar`, para quem usa teclado
 *  ou leitor de ecrã dar por ele. */
function SairDaProva({ href, onCancel }: { href: string; onCancel: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);
  return (
    <div className="px-4 pt-3 md:px-6 lg:mx-auto lg:w-full lg:max-w-[1480px]">
      <Card ref={ref} tabIndex={-1} className="gap-3 p-4" role="alertdialog" aria-labelledby="sair-titulo" aria-describedby="sair-texto">
        <p id="sair-titulo" className="text-[15px] font-bold">Sair da prova?</p>
        <p id="sair-texto" className="text-sm text-muted-foreground">
          A tentativa fica aberta até ao fim do prazo — podes voltar e continuar. O tempo em que estiveres
          fora continua a contar.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={href}>Sair</Link>
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Continuar a prova
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** The questions map: one cell per question, to jump between them. Below `lg` it got
 *  pushed behind the statement, the images and the buttons of the room (M11, #488) —
 *  a visit per question to touch it. The room keeps it inline on desktop and in the
 *  bottom sheet of the fixed bar on phones; only one map exists in the DOM.
 *
 *  The cells ask for at least 44 px of a side: in `grid-cols-6`, a 320 px screen
 *  gave ~35 px — below what a finger lands on without a retry. `auto-fill` grows
 *  the cells as the map gains room (wide card, sheet) instead of adding columns. */
function MapaQuestoes({
  questions,
  index,
  answered,
  flagged,
  unsaved,
  onSelect,
}: {
  questions: ExamQuestion[];
  index: number;
  answered: ReadonlySet<number>;
  flagged: ReadonlySet<number>;
  unsaved: ReadonlySet<number>;
  onSelect: (index: number) => void;
}) {
  return (
    <Card className="gap-4" aria-label="Questões">
      <CardHeader><CardTitle>Questões</CardTitle></CardHeader>
      <CardContent className="grid gap-3.5">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(2.75rem,1fr))] gap-2">
          {questions.map((question, i) => {
            const status = cellState(question.id, answered, flagged, unsaved);
            return (
              <button
                key={question.id}
                type="button"
                aria-current={i === index}
                aria-label={`Questão ${displayNumber(question)}, ${CELL_LABEL[status]}`}
                onClick={() => onSelect(i)}
                className={cn('grid aspect-square place-items-center rounded-md border text-[13px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=true]:outline-2 aria-[current=true]:outline-offset-1 aria-[current=true]:outline-primary', CELL[status])}
              >
                {displayNumber(question)}
              </button>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
          {(['done', 'flag', 'empty', 'unsaved'] as const).map((key) => (
            <span key={key} className="inline-flex items-center gap-1.5">
              <i className={cn('inline-block size-2.5 rounded-[3px] border', CELL[key])} aria-hidden />
              {CELL_TEXT[key]}
            </span>
          ))}
        </div>
        <p className="text-[13px] text-muted-foreground">{answered.size} de {questions.length} respondidas</p>
      </CardContent>
    </Card>
  );
}

/** Debounce of an open answer: long enough not to send a request per keystroke,
 *  short enough that closing the lid right after typing loses little. */
const TEXT_DEBOUNCE_MS = 800;
/** Flush of everything still unsent when this much time is left, so the last words
 *  typed reach the server before the deadline closes the room. */
const FLUSH_BEFORE_END_MS = 4000;
/** Texto único do aviso de rede: o mesmo que o aluno lê na faixa e o teste procura. */
const OFFLINE_BANNER = 'Sem ligação. As respostas ficam neste aparelho e seguem quando voltares.';
const OFFLINE_DELIVERY = 'Sem ligação. As respostas continuam neste aparelho. Tenta entregar quando voltares a ter rede.';

export function SalaProva({ data, extraTime }: { data: RoomData; extraTime: boolean }) {
  const questions = data.questions;
  const [index, setIndex] = useState(0);
  const [flagged, setFlagged] = useState<ReadonlySet<number>>(() => new Set());
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => draftFrom(data));
  /** A synchronous mirror of `drafts`: a tap and a save happen in the same tick, and
   *  the state the closure sees is the one from before the tap. */
  const draftsRef = useRef(drafts);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const [, rerender] = useState(0);
  const [confirming, setConfirming] = useState(false);
  /** A barra fixa do mapa (#488): fechada, é o título «Questão X de Y»; aberta,
   *  é a folha inferior com o mapa. Só existe abaixo de `lg` — no desktop o
   *  card continua inline, ao lado da questão. */
  const [mapaAberto, setMapaAberto] = useState(false);
  const botaoMapa = useRef<HTMLButtonElement>(null);
  const folhaMapa = useRef<HTMLDivElement>(null);
  /** O enunciado recebe o foco quando a questão muda (#488): quem chega por
   *  setas, folha ou mapa não queda em cima do mapa que acabou de sair de vista. */
  const enunciado = useRef<HTMLParagraphElement>(null);
  const primeiroRender = useRef(true);
  /** Abaixo de `lg` cabe uma coisa de cada vez: a questão para responder, ou a folha para a ler inteira.
   *  Em ecrã largo as duas estão lado a lado e esta escolha não conta. */
  const [view, setView] = useState<'questao' | 'folha'>('questao');
  const paperBox = useRef<HTMLDivElement>(null);
  const [announcement, setAnnouncement] = useState('');
  /** The countdown ticks only once mounted, on purpose.
   *
   *  `Date.now()` during render would give a different value on the server and on the
   *  client — o cronómetro é calculado a partir de `now` — e o React accuse a
   *  divergência na hidratação. Renderiza-se sem prazo e o primeiro `setNow` no
   *  efeito é que o faz aparecer. */
  const [now, setNow] = useState<number | null>(null);
  /** `useActionState` for the same reason as the rest of the app: the error the
   *  server sends back has to land next to the button that caused it. Keep it as
   *  the form's action so the delivery still works without JavaScript (#485). */
  const [submitState, submit, submitting] = useActionState(submeterAction, undefined);
  /** Com JavaScript o formulário entrega-se à mão (#485): uma falha de rede entre o
   *  browser e a server action rejeita a promessa, e o `useActionState` sozinho
   *  deixava-a subir ao error boundary global, desmontando a sala. */
  const [deliveryError, setDeliveryError] = useState('');
  const [deliveryPending, startDelivery] = useTransition();
  const submitError = deliveryError || submitState?.error;
  const submitPending = deliveryPending || submitting;
  /** `navigator.onLine` só existe depois da hidratação. Começar em `true` evita
   *  divergir do HTML do servidor; o efeito abaixo corrige-o no primeiro tick. */
  const [online, setOnline] = useState(true);

  /** One queue per room: it serialises the writes of each question, retries the ones
   *  that fail for a transient reason, and is the only thing that knows which answers
   *  the server has confirmed. */
  const [queue] = useState<SaveQueue>(() => {
    const created = createSaveQueue({
      send: (questionId, snapshot, answerId) =>
        guardarAction({
          simulationId: data.simulationId,
          statementId: data.statementId,
          questionId,
          optionId: snapshot.optionId,
          text: snapshot.text,
          answerId,
          roomId: data.roomId ?? null,
        }),
      onChange: () => rerender((n) => n + 1),
      wait: (attempt) => new Promise((resolve) => setTimeout(resolve, backoffMs(attempt))),
    });
    for (const [questionId, saved] of Object.entries(data.saved)) {
      created.seed(Number(questionId), saved.answerId, { optionId: saved.optionId, text: saved.text });
    }
    return created;
  });

  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const current = questions[index];
  /** `null` enquanto o relógio não arrancou: sem ele não se sabe o que falta, e
   *  inventar um número no primeiro render seria pior do que um traço. */
  const left = now === null ? null : remainingMs(data.deadline, now);
  /** The same two conditions the server enforces on a write (SimulationAnswerService
   *  :107 and :125): not IN_PROGRESS, or past the deadline. Stopping the form here is
   *  what keeps the student from answering into a 409. `remainingMs` reads a missing
   *  deadline as "no limit" — which is what SimulationDeadlineService.java:89 means by
   *  a null deadline. Before the clock starts there is no reason to lock the form, so
   *  the room stays open. */
  const closed =
    (data.status ?? '').toUpperCase() !== 'IN_PROGRESS' ||
    (now !== null && left !== null && left <= 0);

  /** O modo de avaliação (#192): regista o que o browser vê — separador escondido,
   *  janela sem foco, o regresso — e avisa o aluno ao voltar. Só com a tentativa a
   *  decorrer: entregue ou expirada, não há nada para vigiar. Não bloqueia a prova. */
  const { notice: integrityNotice, dismiss: dismissIntegrityNotice, record } = useIntegrity({
    simulationId: data.simulationId,
    active: !closed,
  });
  /** Sair a meio não termina a tentativa, por isso é reversível — mas avisa-se,
   *  para não se sair por um toque a mais. */
  const [exitConfirm, setExitConfirm] = useState(false);
  /** A colagem recusada dava um "não aconteceu nada" silencioso. Este aviso é a
   *  resposta ao gesto, e limpa-se quando o aluno começa a escrever. */
  const [pasteNotice, setPasteNotice] = useState(false);

  /** What the header shows. 'a-contar' only exists during the first render, before
   *  the browser's clock starts ticking — the server rendered this component too, and
   *  its `Date.now()` is not the student's. 'sem-limite' is a real state: a statement
   *  without `durationMinutes` has no deadline and never expires. */
  const tempo = timer(data.deadline, now);

  const snapshotOf = useCallback((id: number): Snapshot => draftsRef.current[id] ?? { optionId: null, text: '' }, []);

  /** Hands the latest value of a question to the queue, cancelling its debounce. */
  const guardar = useCallback(
    (questionId: number) => {
      const timer = timers.current.get(questionId);
      if (timer) clearTimeout(timer);
      timers.current.delete(questionId);
      void queue.request(questionId, snapshotOf(questionId));
    },
    [queue, snapshotOf],
  );

  const flushAll = useCallback(() => {
    for (const question of data.questions) guardar(question.id);
    return queue.settled();
  }, [data.questions, guardar, queue]);

  // Sem rede a fila tenta quatro vezes e desiste; quando a ligação volta, o evento
  // `online` é o sinal para reenviar tudo o que ficou por confirmar (#485). A faixa
  // segue o mesmo evento, por isso aparece e desaparece sem refresh.
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    const onOnline = () => {
      setOnline(true);
      void flushAll();
    };
    sync();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', sync);
    };
  }, [flushAll]);

  // O que ainda não saiu não pode ficar só neste separador: ao esconder ou fechar a
  // página, e pouco antes de o tempo acabar, tudo o que está por enviar é enviado.
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') void flushAll(); };
    const onPageHide = () => void flushAll();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      for (const timer of timers.current.values()) clearTimeout(timer);
    };
  }, [flushAll]);

  const flushedAtEnd = useRef(false);
  useEffect(() => {
    if (left !== null && left <= FLUSH_BEFORE_END_MS && !flushedAtEnd.current) {
      flushedAtEnd.current = true;
      void flushAll();
    }
  }, [left, flushAll]);

  // Avisos falados aos 5 e a 1 minuto: o cronómetro visual não chega a quem usa
  // leitor de ecrã, e `role="timer"` não anuncia por si. Os limiares leem-se do
  // tempo que o aluno VÊ (`displayRemainingMs`), para o aviso e o número em tela
  // dizerem a mesma coisa — o prazo real corre 10 s à frente da tolerância.
  const visor = displayRemainingMs(left);
  const bucket = visor === null ? null : left !== null && left <= 0 ? 0 : visor <= 60_000 ? 1 : visor <= 300_000 ? 5 : 99;
  useEffect(() => {
    if (bucket === 5) setAnnouncement('Faltam 5 minutos para o fim da prova.');
    else if (bucket === 1) setAnnouncement('Falta 1 minuto para o fim da prova.');
    else if (bucket === 0) setAnnouncement('O tempo da prova terminou.');
  }, [bucket]);

  /** Quanto aperta o relógio para quem vê: âmbar nos 5 minutos, vermelho no minuto
   *  final (M11). Só com a prova a decorrer — entregue ou expirada, o estado de
   *  fechado já tem a sua cor e o seu cartão. */
  const urgencia = closed ? 'calmo' : urgencyOf(visor);
  /** Aviso visível do limiar a decorrer: 5 minutos, 1 minuto, ou nenhum. No último
   *  minuto o relógio visível chega a 0:00 enquanto a tolerância do servidor ainda
   *  corre — nesse vão não há «1 minuto» a dizer, senão o texto contrariava o
   *  número em tela; o relógio vermelho fica e o fechado acaba de chegar. */
  const limiar = urgencia === 'alerta' ? 5 : urgencia === 'critico' && visor !== null && visor > 0 ? 1 : null;
  /** Cada limiar anuncia-se uma vez: dispensar o aviso não o traz de volta dentro do
   *  mesmo limiar, e ao passar ao seguinte ele volta a aparecer (#487). */
  const [limiaresDispensados, setLimiaresDispensados] = useState<ReadonlySet<number>>(() => new Set());
  const avisoVisivel = limiar !== null && !limiaresDispensados.has(limiar);

  /** The map follows what the SERVER confirmed. A question whose latest value is not
   *  on the server (in flight, or failed) is `unsaved`, never `done`. */
  const unsaved = new Set(questions.filter((q) => queue.dirty(q.id, snapshotOf(q.id))).map((q) => q.id));
  const answered = new Set(
    questions.filter((q) => !unsaved.has(q.id) && isAnswered(q, drafts[q.id])).map((q) => q.id),
  );
  const failed = queue.failed();
  const saving = queue.busy() || unsaved.size > 0;
  /** O aviso nativo só faz sentido quando há mesmo algo por chegar ao servidor:
   *  uma resposta em voo, uma que falhou ou uma que ainda não foi pedida. */
  const haRespostasPorGuardar = queue.busy() || failed.length > 0 || unsaved.size > 0;

  // Respostas por confirmar sobrevivem a um separador fechado ou a uma rede em baixo (#587): guardam-se no browser enquanto o servidor não as
  // confirma e restauram-se ao reabrir a prova. Só o que ainda não está confirmado: se existe, é mais recente do que o do servidor.
  const [recuperadas, setRecuperadas] = useState(0);
  const [estadoLocalArmado, setEstadoLocalArmado] = useState(false);
  const jaRestaurou = useRef(false);
  useEffect(() => {
    if (jaRestaurou.current) return;
    jaRestaurou.current = true;
    const armazem = armazemLocal();
    if (armazem) {
      const restante = remainingMs(data.deadline, Date.now());
      const terminada = (data.status ?? '').toUpperCase() !== 'IN_PROGRESS' || (restante !== null && restante <= 0);
      if (terminada) {
        limparRascunho(armazem, data.simulationId); // já não se responde: um rascunho antigo não pode ressuscitar
        limparMarcadas(armazem, data.simulationId);
      } else {
        // As marcas (#486) são do aluno e sobrevivem a sair/voltar; só se aceitam
        // ids de questões que ainda existem nesta prova.
        const existentes = new Set(data.questions.map((q) => q.id));
        const marcadas = new Set([...lerMarcadas(armazem, data.simulationId)].filter((id) => existentes.has(id)));
        if (marcadas.size > 0) setFlagged(marcadas);
        const guardadoNoServidor = Object.fromEntries(Object.entries(data.saved).map(([id, v]) => [Number(id), { optionId: v.optionId, text: v.text }]));
        const restaurar = aRecuperar(lerRascunho(armazem, data.simulationId), data.questions.map((q) => q.id), guardadoNoServidor);
        const ids = Object.keys(restaurar).map(Number);
        if (ids.length > 0) {
          const next = { ...draftsRef.current };
          for (const id of ids) next[id] = restaurar[id];
          draftsRef.current = next;
          setDrafts(next);
          for (const id of ids) guardar(id);
          setRecuperadas(ids.length);
        }
      }
    }
    setEstadoLocalArmado(true); // só depois de restaurar: antes disso uma lista vazia apagaria o que está no browser
  }, [data, guardar]);

  const porConfirmar = JSON.stringify(Object.fromEntries([...unsaved].map((id) => [id, snapshotOf(id)])));
  useEffect(() => {
    if (!estadoLocalArmado) return;
    const armazem = armazemLocal();
    if (armazem) guardarRascunho(armazem, data.simulationId, JSON.parse(porConfirmar));
  }, [estadoLocalArmado, porConfirmar, data.simulationId]);

  // As marcas mudam com um toque e têm de sobreviver a recarregar a sala (#486).
  useEffect(() => {
    if (!estadoLocalArmado) return;
    const armazem = armazemLocal();
    if (armazem) guardarMarcadas(armazem, data.simulationId, flagged);
  }, [estadoLocalArmado, flagged, data.simulationId]);

  // Fechar ou recarregar com respostas por confirmar pede confirmação ao browser (as que já saíram não pedem nada).
  // A entrega em curso também conta: `submitPending` cobre o `useActionState` e a entrega manual (#485).
  useEffect(() => {
    if (!haRespostasPorGuardar || submitPending) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [haRespostasPorGuardar, submitPending]);

  function patch(questionId: number, change: Partial<Draft>) {
    const next = { ...draftsRef.current, [questionId]: { ...snapshotOf(questionId), ...change } };
    draftsRef.current = next;
    setDrafts(next);
  }

  function sairDaQuestao() {
    if (current) guardar(current.id);
  }

  function writeText(questionId: number, text: string) {
    patch(questionId, { text });
    const previous = timers.current.get(questionId);
    if (previous) clearTimeout(previous);
    timers.current.set(questionId, setTimeout(() => guardar(questionId), TEXT_DEBOUNCE_MS));
  }

  function retryAll() {
    for (const id of queue.failed()) void queue.retry(id);
  }

  function toggleFlag(questionId: number) {
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  }

  function openConfirm() {
    // Tudo o que está por enviar sai antes de confirmar: caso contrário a última
    // resposta escrita não chegava ao servidor e a prova saía sem ela.
    setDeliveryError('');
    void flushAll();
    setConfirming(true);
  }

  /** Uma mudança de questão: o que está por enviar sai primeiro, como no rodapé.
   *  Rodapé, folha, mapa e setas passam todos por aqui — e o foco segue no efeito
   *  sobre `index`. Navegar para a própria questão não é mudança nenhuma. */
  function irPara(target: number) {
    if (target < 0 || target >= questions.length || target === index) return;
    sairDaQuestao();
    setIndex(target);
  }

  function fecharMapa() {
    setMapaAberto(false);
    botaoMapa.current?.focus();
  }

  function escolherPeloMapa(target: number) {
    if (target === index) botaoMapa.current?.focus(); // sem mudança, o foco volta à barra…
    else irPara(target); // …com mudança, o efeito sobre `index` leva-o ao enunciado
    setMapaAberto(false);
  }

  // Setas ←/→ mudam de questão ao teclado (M11 #488). Três exclusões:
  //  - o que se escreve — o textarea das abertas e o `fieldset` de rádio usam as
  //    setas a sério (mover carreto, escolher opção): roubar-lhas era partir a
  //    escrita;
  //  - uma sobreposição aberta (entrega, sair, folha do mapa): saltar de questão
  //    «atrás» do diálogo é uma mudança que o aluno não vê;
  //  - modificadores, para não ficarmos com combinações do browser.
  useEffect(() => {
    function aoTeclar(event: KeyboardEvent) {
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      if (confirming || exitConfirm || mapaAberto || view !== 'questao') return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const alvo = event.target instanceof Element ? event.target : null;
      if (alvo?.closest('input, textarea, select, [contenteditable="true"], [contenteditable=""]')) return;
      event.preventDefault();
      irPara(event.key === 'ArrowLeft' ? index - 1 : index + 1);
    }
    document.addEventListener('keydown', aoTeclar);
    return () => document.removeEventListener('keydown', aoTeclar);
  }, [confirming, exitConfirm, mapaAberto, view, index]);

  // Mudança de questão → o foco vai ao enunciado. O primeiro render não é mudança
  // nenhuma: roubar o foco a quem abriu a prova seria pior que nenhum salto.
  useEffect(() => {
    if (primeiroRender.current) {
      primeiroRender.current = false;
      return;
    }
    enunciado.current?.focus();
  }, [index]);

  // A folha do mapa abre a receber o foco: quem a abriu por teclado vai entrar
  // nas células, e o `role="dialog"` pega a narrar onde se está.
  useEffect(() => {
    if (mapaAberto) folhaMapa.current?.focus();
  }, [mapaAberto]);

  /** Com JavaScript entrega-se aqui, não no `action` do form, para se poder apanhar
   *  a rejeição da server action. O `action` continua no form para o envio sem
   *  JavaScript (o fluxo testa-o) e para o `<form>` não ficar só no cliente. */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setDeliveryError('');
    startDelivery(async () => {
      try {
        const result = await submeterAction(undefined, new FormData(form));
        if (result?.error) setDeliveryError(result.error);
      } catch (error) {
        // `redirect()` e `notFound()` também lançam: são controlo de fluxo do Next,
        // não uma falha de rede, e têm de continuar a subir.
        unstable_rethrow(error);
        setDeliveryError(OFFLINE_DELIVERY);
      }
    });
  }

  function fecharConfirm() {
    setConfirming(false);
  }

  if (!current) {
    return (
      <div className="grid above-banner-min-h place-items-center p-6 text-center">
        <p className="text-muted-foreground">Esta prova não tem questões.</p>
      </div>
    );
  }

  return (
    <div className="flex above-banner-min-h flex-col">
      <header className="sticky top-0 z-10 border-b bg-card">
        <div className="flex items-center gap-3 px-4 py-2.5 md:px-5">
          {/* A tentativa a decorrer não se abandona por um toque a mais: sai-se pelo
              aviso. Fechada, o link direto chega. */}
          {closed ? (
            <Button asChild variant="ghost" size="icon" aria-label="Sair da prova">
              <Link href={data.roomId ? '/provas?aba=salas' : '/provas'}><ChevronLeft /></Link>
            </Button>
          ) : (
            <Button variant="ghost" size="icon" aria-label="Sair da prova" onClick={() => setExitConfirm(true)}>
              <ChevronLeft />
            </Button>
          )}
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-[15px] font-bold">{data.title}</h1>
            <div className="text-xs text-muted-foreground">{data.subtitle}</div>
          </div>
          <div
            className={cn(
              'ml-auto flex items-center gap-2 text-lg font-bold',
              closed
                ? 'text-destructive'
                : urgencia === 'alerta'
                  ? 'rounded-lg bg-warning-soft px-2 py-1 text-warning'
                  : urgencia === 'critico' && 'rounded-lg bg-danger-soft px-2 py-1 text-destructive',
            )}
            role="timer"
            aria-label={tempo === 'sem-limite' ? 'Sem limite de tempo' : 'Tempo restante'}
          >
            <Clock className="size-[18px]" aria-hidden />
            {/* Três estados, e não dois: sem limite é uma coisa real (uma prova sem
                `durationMinutes` nunca expira), e "ainda a contar" é o primeiro render,
                em que o relógio do browser ainda não arrancou. Dizer "Sem tempo" nos
                dois casos mentiria ao aluno sobre uma prova que está a contar. */}
            <span className="tabular-nums">
              {tempo === 'restante' ? formatClock(displayRemainingMs(left) ?? 0) : tempo === 'sem-limite' ? 'Sem tempo' : '—:—'}
            </span>
            {/* O limiar em palavras, sempre visível durante ele (M11: estilo E texto,
                nunca só a cor). Pequeno, porque o aviso destacável abaixo é que porta
                o apelo à entrega. */}
            {limiar === 5 && <small className="hidden text-xs font-semibold sm:inline">Faltam 5 minutos</small>}
            {limiar === 1 && <small className="hidden text-xs font-semibold sm:inline">Falta 1 minuto</small>}
            {extraTime && (
              <small className="hidden text-xs font-semibold text-muted-foreground sm:inline">+25% de tempo</small>
            )}
          </div>
          <Button
            variant={urgencia === 'critico' ? 'default' : 'outline'}
            size="sm"
            onClick={openConfirm}
            disabled={closed}
          >
            Entregar
          </Button>
        </div>
        {!online && (
          <p
            data-testid="sala-offline"
            role="status"
            className="flex items-center justify-center gap-2 border-t border-warning/30 bg-warning-soft px-4 py-2 text-center text-[13px] font-medium text-warning"
          >
            <WifiOff className="size-4 shrink-0" aria-hidden />
            {OFFLINE_BANNER}
          </p>
        )}
        {/* O limiar no cabeçalho fixo, onde sempre se vê (decisão tomada ao planear
            #487): apela à entrega junto do relógio que a provocou, e dispensa-se
            porque é um aviso, não um bloqueio. Sem `role` de resposta automática:
            quem usa leitor de ecrã já ouve a mensagem falada dos mesmos limiares,
            e era ouvida duas vezes. */}
        {avisoVisivel && limiar !== null && (
          <p
            data-testid="sala-tempo-aviso"
            className={cn(
              'flex flex-wrap items-center justify-center gap-2 border-t px-4 py-2 text-center text-[13px] font-medium',
              limiar === 5
                ? 'border-warning/30 bg-warning-soft text-warning'
                : 'border-destructive/30 bg-danger-soft text-destructive',
            )}
          >
            <Clock className="size-4 shrink-0" aria-hidden />
            {limiar === 5 ? 'Faltam 5 minutos para o fim da prova.' : 'Falta 1 minuto. Entrega o que tens guardado.'}
            <Button type="button" size="sm" onClick={openConfirm}>Entregar</Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={limiar === 5 ? 'text-warning' : 'text-destructive'}
              onClick={() => { if (limiar !== null) setLimiaresDispensados((v) => new Set(v).add(limiar)); }}
            >
              Fechar
            </Button>
          </p>
        )}
      </header>
      <p className="sr-only" role="status" aria-live="assertive">{announcement}</p>

      {/* O aviso do modo de avaliação: o aluno sai, volta, e vê que a saída ficou
          registada. Não acusa nem reprova — diz o que aconteceu e deixa continuar. */}
      {integrityNotice && (
        <Alert variant="info" className="mx-4 mt-3 md:mx-6 lg:mx-auto lg:w-full lg:max-w-[1480px]">
          <ShieldAlert aria-hidden />
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{integrityNotice}</span>
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={dismissIntegrityNotice}>
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {recuperadas > 0 && (
        <Alert variant="info" className="mx-4 mt-3 md:mx-6 lg:mx-auto lg:w-full lg:max-w-[1480px]">
          <RefreshCw aria-hidden />
          <AlertDescription role="status" className="flex flex-wrap items-center gap-3">
            <span>
              {recuperadas === 1
                ? 'Recuperámos 1 resposta que não tinha chegado ao servidor e estamos a enviá-la.'
                : `Recuperámos ${recuperadas} respostas que não tinham chegado ao servidor e estamos a enviá-las.`}
            </span>
            <Button type="button" variant="ghost" size="sm" className="ml-auto" onClick={() => setRecuperadas(0)}>
              Fechar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {exitConfirm && (
        <SairDaProva
          href={data.roomId ? '/provas?aba=salas' : '/provas'}
          onCancel={() => setExitConfirm(false)}
        />
      )}

      <div className="mx-auto grid w-full max-w-[1480px] flex-1 items-start gap-4 p-4 pb-24 md:gap-6 md:p-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:pb-6">
        {/* Abaixo de lg: a questão ou a folha, à escolha. */}
        <div className="flex gap-1 rounded-lg border bg-card p-1 lg:hidden" role="group" aria-label="O que ver">
          {([['questao', 'Questão', ListChecks], ['folha', 'Folha da prova', FileText]] as const).map(([key, label, Icon]) => (
            <Button key={key} type="button" size="sm" variant={view === key ? 'default' : 'ghost'} className="flex-1" aria-pressed={view === key} onClick={() => setView(key)}>
              <Icon aria-hidden />{label}
            </Button>
          ))}
        </div>

        {/* A folha da prova, como o professor a montou: grande, e a deslizar para a questão em que o aluno vai. */}
        <section aria-label="A folha da prova" className={cn('min-w-0 lg:order-1', view === 'folha' ? 'block' : 'hidden', 'lg:block')}>
          <div
            ref={paperBox}
            className="max-h-[calc(100dvh-11rem)] overflow-y-auto rounded-lg border bg-muted/50 p-2 sm:p-3 lg:sticky lg:top-[4.5rem] lg:max-h-[calc(100dvh-6rem)]"
          >
            <FolhaDaProva
              meta={data.paper ?? { kind: 'Prova' }}
              questions={questions}
              images={data.images}
              answers={drafts}
              current={current.id}
              scrollRef={paperBox}
              onSelect={(id) => {
                const target = questions.findIndex((q) => q.id === id);
                if (target < 0) return;
                sairDaQuestao();
                setIndex(target);
                // Em ecrã estreito a folha e a questão não cabem juntas: tocar numa questão leva para ela.
                if (!window.matchMedia('(min-width: 1024px)').matches) setView('questao');
              }}
            />
          </div>
        </section>

        <div className={cn('grid min-w-0 gap-4 lg:order-2', view === 'questao' ? 'grid' : 'hidden', 'lg:grid')}>
        <div className="grid min-w-0 gap-4">
          {/* One form for the whole room: the confirmation's submit button joins it
              through `form=`, and so does the "deliver what is saved" button shown
              once the time is up. */}
          <form id={SUBMIT_FORM} action={submit} onSubmit={handleSubmit}>
            <input type="hidden" name="simulationId" value={String(data.simulationId)} />
          </form>

          {confirming && (
            <Confirmar
              unanswered={questions.length - answered.size}
              saving={saving && failed.length === 0}
              failed={failed.length}
              marked={flagged.size}
              pending={submitPending}
              error={submitError}
              onCancel={fecharConfirm}
              onRetry={retryAll}
            />
          )}

          {closed && (
            <Card className="gap-1 border-destructive/40 bg-destructive/5 p-4" role="status">
              <p className="text-[15px] font-bold text-destructive">O tempo desta prova terminou</p>
              <p className="text-sm text-muted-foreground">
                O servidor já não aceita respostas. Entrega o que está guardado para veres a nota.
                {unsaved.size > 0 && ` ${unsaved.size === 1 ? '1 resposta' : `${unsaved.size} respostas`} não chegou ao servidor e vai ficar de fora.`}
              </p>
              {submitError && (
                <p role="alert" className="text-[13px] font-medium text-destructive">{submitError}</p>
              )}
              <Button type="submit" form={SUBMIT_FORM} size="sm" className="mt-2 justify-self-start" disabled={submitPending}>
                Entregar o que está guardado
              </Button>
            </Card>
          )}

          <Card className="gap-5 p-5 md:p-6" aria-labelledby="q-text">
            <div className="flex justify-between gap-3 text-[13px] font-semibold text-muted-foreground">
              {/* Uma alínea lê-se «3a», não «a 7.ª de 10»: o número interno nunca aparece. */}
              <span>Questão {displayNumber(current)} <span className="font-normal">({index + 1} de {questions.length})</span></span>
              <span>{current.maxScore != null ? `${current.maxScore} valores` : ''}</span>
            </div>
            {current.parentText ? (
              // O enunciado comum da questão: o aluno lê-o acima de cada alínea, sem ter de voltar atrás.
              <div className="grid gap-1 rounded-lg border border-dashed bg-secondary/60 px-4 py-3" data-testid="enunciado-comum">
                <p className="text-xs font-semibold text-muted-foreground">Questão {current.parentNumber ?? ''}</p>
                <p className="max-w-[60ch] text-[15px] leading-relaxed">{current.parentText}</p>
              </div>
            ) : null}
            <p id="q-text" ref={enunciado} tabIndex={-1} className="max-w-[60ch] scroll-mt-16 text-[17px] leading-relaxed outline-none md:text-[19px]">
              {current.label ? <span className="mr-2 font-semibold text-muted-foreground">{current.label})</span> : null}
              {current.text}
            </p>

            {isChoice(current) ? (
              <fieldset className="grid gap-2.5" aria-labelledby="q-text" disabled={closed}>
                {current.options.map((option, i) => (
                  <label
                    key={option.id}
                    className="relative flex min-h-14 cursor-pointer items-center gap-3.5 rounded-lg border border-input bg-card px-4 py-3 text-base transition-colors hover:bg-secondary has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40"
                  >
                    <input
                      className="peer sr-only"
                      type="radio"
                      name={`opcao-${current.id}`}
                      checked={drafts[current.id]?.optionId === option.id}
                      onChange={() => {
                        patch(current.id, { optionId: option.id });
                        guardar(current.id);
                      }}
                    />
                    <span className="grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] border-input text-[13px] font-bold text-muted-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
                      {option.optionLabel?.trim() || String.fromCharCode(65 + i)}
                    </span>
                    <span className="tabular-nums">{option.optionText}</span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor={`texto-${current.id}`}>A tua resposta</Label>
                <Textarea
                  id={`texto-${current.id}`}
                  rows={5}
                  value={drafts[current.id]?.text ?? ''}
                  disabled={closed}
                  onChange={(e) => {
                    setPasteNotice(false);
                    writeText(current.id, e.target.value);
                  }}
                  onBlur={sairDaQuestao}
                  onPaste={(e) => {
                    // Numa resposta aberta não há onde colar: o gesto é recusado e
                    // registado, em vez de deixar entrar texto de fora. A escolha
                    // múltipla não tem onde colar, por isso o teste é o mesmo da regra.
                    if (!pasteBlocked(current)) return;
                    e.preventDefault();
                    record('PASTE_BLOCKED', current.id);
                    setPasteNotice(true);
                  }}
                />
                {pasteNotice && (
                  <p role="status" className="text-[13px] font-medium text-destructive">
                    {PASTE_NOTICE}
                  </p>
                )}
                <p className="text-[13px] text-muted-foreground">As respostas abertas são corrigidas pelo professor.</p>
              </div>
            )}

            <div aria-live="polite" role="status" className="flex min-h-5 flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {(() => {
                const state = queue.status(current.id);
                if (state.status === 'error') {
                  return (
                    <>
                      <span className="text-destructive">{state.error ?? 'Não foi possível guardar.'}</span>
                      <Button type="button" variant="outline" size="sm" onClick={() => void queue.retry(current.id)}>
                        <RefreshCw aria-hidden />Tentar de novo
                      </Button>
                    </>
                  );
                }
                if (state.status === 'saving') return 'A guardar…';
                if (unsaved.has(current.id)) return 'Por guardar…';
                return answered.has(current.id) ? 'Resposta guardada. Podes mudá-la até entregares a prova.' : '';
              })()}
            </div>

            {data.images[current.id]?.length > 0 && (
              <div className="grid gap-2">
                {data.images[current.id].map((image) => (
                  <figure key={image.id} className="grid gap-1">
                    {/* A URL vem do armazenamento do backend, por isso é um img simples:
                        next/image exigiria o domínio na lista e um tamanho configurado
                        do lado de quem guarda a imagem. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={assetUrl(image.imageUrl, 768)} decoding="async" alt={image.caption ?? ''} className="w-full rounded-lg border" />
                    {image.caption && (
                      <figcaption className="text-[13px] text-muted-foreground">{image.caption}</figcaption>
                    )}
                  </figure>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              <Button
                variant="outline"
                disabled={index === 0}
                onClick={() => irPara(index - 1)}
              >
                <ChevronLeft />Anterior
              </Button>
              <Button
                variant="ghost"
                className="text-primary"
                aria-pressed={flagged.has(current.id)}
                onClick={() => toggleFlag(current.id)}
              >
                <Flag />{flagged.has(current.id) ? 'Marcada para rever' : 'Marcar para rever'}
              </Button>
              <span className="flex-1" />
              {/* Na última questão «Seguinte» ficava desactivado e a entrega só
                  existia no cabeçalho, todo lá em cima (M11): aqui onde a leitura
                  termina, o aluno fecha a prova. */}
              {index === questions.length - 1 ? (
                <Button onClick={openConfirm}><ListChecks aria-hidden />Rever e entregar</Button>
              ) : (
                <Button onClick={() => irPara(index + 1)}>Seguinte<ChevronRight /></Button>
              )}
            </div>
          </Card>
        </div>

        {/* No desktop o mapa está logo ali, ao lado da questão. Abaixo de lg ele
            vive na folha inferior da barra fixa — deixar os dois era dois mapas
            no DOM e duas origens de foco a discutir entre si. */}
        <div className="hidden lg:block">
          <MapaQuestoes
            questions={questions}
            index={index}
            answered={answered}
            flagged={flagged}
            unsaved={unsaved}
            onSelect={irPara}
          />
        </div>
        </div>
      </div>

      {/* Abaixo de lg, o mapa fica a um toque de qualquer ponto da página (M11
          #488): a barra fixa mostra onde o aluno vai e a folha inferior traz o
          mapa acima dela. Sem bloqueio nenhum — o scrim fecha ao toque e a
          página continua a rolar; o Escape fecha para quem vem pelo teclado. */}
      {mapaAberto && (
        <div
          className="fixed inset-0 z-20 bg-foreground/25 lg:hidden"
          onClick={fecharMapa}
          aria-hidden
        />
      )}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card lg:hidden" data-testid="sala-nav">
        {mapaAberto && (
          <div
            ref={folhaMapa}
            tabIndex={-1}
            role="dialog"
            aria-label="Mapa das questões"
            className="max-h-[60dvh] overflow-y-auto border-b outline-none"
            onKeyDown={(event) => { if (event.key === 'Escape') { event.stopPropagation(); fecharMapa(); } }}
          >
            <MapaQuestoes
              questions={questions}
              index={index}
              answered={answered}
              flagged={flagged}
              unsaved={unsaved}
              onSelect={escolherPeloMapa}
            />
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-2.5">
          <p className="text-[13px] font-medium">
            Questão <span className="font-bold">{displayNumber(current)}</span> de {questions.length}
          </p>
          <Button
            ref={botaoMapa}
            type="button"
            variant={mapaAberto ? 'default' : 'outline'}
            size="sm"
            className="ml-auto"
            aria-expanded={mapaAberto}
            onClick={() => (mapaAberto ? fecharMapa() : setMapaAberto(true))}
          >
            {mapaAberto ? 'Fechar mapa' : 'Ver questões'}
          </Button>
        </div>
      </div>
    </div>
  );
}
