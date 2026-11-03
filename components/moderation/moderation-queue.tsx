'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Flag, ScrollText } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { FilterTabs, filterPanelProps } from '@/components/crud/filter-tabs';
import { Pagination } from '@/components/crud/pagination';
import { QueueShortcuts } from '@/components/crud/queue-shortcuts';
import { ShortcutsHint } from '@/components/crud/shortcuts-hint';
import { focusQueueItem } from '@/hooks/use-queue-shortcuts';
import { useQueryChoice, useQueryPage } from '@/hooks/use-query-state';
import { paginate } from '@/lib/queue-state';
import { decideReport, listReports } from '@/app/actions/moderation';
import {
  DECISION_LABEL,
  DECISION_NOTE,
  DECISIONS,
  NOTA_MINIMA,
  REASON_LABEL,
  STATUS_LABEL,
  TARGET_LABEL,
  contarPorMotivo,
  decisionExigeNota,
  decisionValida,
  notaDecisaoError,
  porAlvo,
  type Decision,
  type Report,
} from '@/lib/moderation/model';
import {
  DECIDED_PAGE_SIZE,
  DEFAULT_MODERATION_FILTER,
  moderationCounts,
  MODERATION_FILTER_KEYS,
  MODERATION_FILTERS,
} from '@/lib/moderation/queue';

/** O verbo da decisão, para o `data-testid` se ler como a acção e não como o
 *  participio: `moderacao-ignore-12`, e não `moderacao-ignored-12`. */
const VERBO: Record<Decision, string> = { IGNORED: 'ignore', HIDDEN: 'hide', SUSPENDED: 'suspend' };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' }) : '—');

/**
 * A fila de moderação (#323).
 *
 * A decisão de cada denúncia pede uma nota e escreve no registo de auditoria. A nota
 * é o que separa «não se confirma» de «confirmou-se e ocultámos»: sem ela, daqui a seis
 * meses ninguém sabe porque é que um perfil desapareceu.
 */
export function ModerationQueue() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aAbrir, setAAbrir] = useState<{ report: Report; decision: Decision } | null>(null);
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  /** O erro de uma decisão falhada vive dentro do diálogo (por cima do footer),
   *  com `role="alert"`: fora dele o overlay tapa-o e o Radix põe a página em
   *  `aria-hidden`, por isso nem o leitor de ecrã o anunciava. */
  const [erroDialogo, setErroDialogo] = useState<string | null>(null);
  const notaRef = useRef<HTMLTextAreaElement>(null);
  /** Quem abriu o diálogo: o Esc e o cancelar devolvem-lhe o foco. */
  const openerRef = useRef<HTMLButtonElement | null>(null);

  // O foco vai para a nota depois de o diálogo montar: com `autoFocus` o React
  // focava antes de o FocusScope do Radix registar o botão que abriu, e no
  // fechar ele restaurava o foco para o campo desmontado (caía no `body`).
  useEffect(() => {
    if (!aAbrir) return;
    const task = window.setTimeout(() => notaRef.current?.focus(), 0);
    return () => window.clearTimeout(task);
  }, [aAbrir]);
  // O separador e a página vivem no endereço: sobrevivem ao recarregamento e podem ir numa ligação.
  const [separador, setSeparador] = useQueryChoice('filtro', MODERATION_FILTER_KEYS, DEFAULT_MODERATION_FILTER);
  const [pagina, setPagina] = useQueryPage();

  const carregar = useCallback(async () => {
    const r = await listReports(null);
    if (r.ok) setReports(r.data);
    else setErro(r.error);
  }, []);

  // O `setTimeout` a zero é o mesmo desvio que a `VerificationList` usa: o lint
  // (`react-hooks/set-state-in-effect`) recusa um `setState` directo dentro de um
  // efeito, e carregar dados no cliente é precisamente esse caso.
  useEffect(() => {
    const task = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(task);
  }, [carregar]);

  const porDecidir = useMemo(() => (reports ?? []).filter((r) => r.status === 'OPEN'), [reports]);
  const decididas = useMemo(() => (reports ?? []).filter((r) => r.status !== 'OPEN'), [reports]);
  const motivos = useMemo(() => contarPorMotivo(reports ?? []), [reports]);
  const grupos = useMemo(() => porAlvo(porDecidir), [porDecidir]);
  const contagens = useMemo(() => moderationCounts(reports ?? []), [reports]);
  const paginaDecididas = useMemo(() => paginate(decididas, pagina, DECIDED_PAGE_SIZE), [decididas, pagina]);

  function abrir(report: Report, decision: Decision, opener: HTMLButtonElement | null) {
    setNota('');
    setErroDialogo(null);
    openerRef.current = opener;
    setAAbrir({ report, decision });
  }

  function fechar() {
    // Com pedido em curso não se fecha: o resultado chegaria a um ecrã fechado,
    // com o erro invisível. O cancelar já vem desativado; o Esc e o clique fora
    // travam aqui.
    if (ocupado) return;
    setErroDialogo(null);
    setAAbrir(null);
  }

  async function confirmar() {
    if (!aAbrir) return;
    // A barreira repete-se aqui: o botão já vem desativado sem nota válida,
    // mas a decisão é um endpoint e valida-se de novo antes de a pedir.
    if (notaDecisaoError(aAbrir.decision, nota)) return;
    setOcupado(true);
    setErroDialogo(null);
    try {
      const r = await decideReport(aAbrir.report.id, aAbrir.decision, aAbrir.report.target, nota);
      if (!r.ok) {
        setErroDialogo(r.error);
        return;
      }
      setAAbrir(null);
      await carregar();
    } catch (e: unknown) {
      // A rede lança no cliente, fora do `guard` do servidor.
      setErroDialogo(e instanceof Error && e.message ? e.message : 'Não foi possível contactar o servidor.');
    } finally {
      setOcupado(false);
    }
  }

  // Ocultar e suspender pedem nota escrita (mínimo): sem ela o confirmar nem ativa.
  const erroNota = aAbrir ? notaDecisaoError(aAbrir.decision, nota) : null;

  if (erro && !reports) return <p className="text-sm text-destructive">{erro}</p>;
  if (!reports) return <p className="text-sm text-muted-foreground">A carregar denúncias…</p>;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Moderação</h1>
          <p className="text-sm text-muted-foreground">
            Denúncias de perfis e de escolas. Só o administrador decide, e cada decisão fica registada.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/moderacao/auditoria">
            <ScrollText size={16} aria-hidden /> Ver auditoria
          </Link>
        </Button>
      </header>

      <FilterTabs
        group="moderacao"
        label="Denúncias"
        value={separador}
        onChange={(next) => {
          setSeparador(next);
          setPagina(1);
        }}
        tabs={MODERATION_FILTERS.map((f) => ({ key: f.key, label: f.label, count: contagens[f.key] }))}
      />

      <div {...filterPanelProps('moderacao', separador)} className="grid gap-6">
        {separador === 'por-decidir' && motivos.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Por decidir, por motivo</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {motivos.map((m) => (
                <Badge key={m.reason} variant="outline">{REASON_LABEL[m.reason]} · {m.total}</Badge>
              ))}
            </CardContent>
          </Card>
        )}

        {erro && <p className="text-sm text-destructive" role="alert">{erro}</p>}

        {separador === 'por-decidir' && (
          <section aria-label="Denúncias por decidir" className="grid gap-4">
            <h2 className="text-lg font-semibold">Por decidir</h2>
            {porDecidir.length === 0 && (
              <p className="text-sm text-muted-foreground">Não há nada por decidir.</p>
            )}
            {[...grupos.entries()].map(([chave, doGrupo]) => {
              const primeiro = doGrupo[0]!;
              const extra = doGrupo.length - 1;
              return (
                <Card key={chave}>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
                      <span>{primeiro.targetName}</span>
                      <Badge variant="outline">{TARGET_LABEL[primeiro.target]}</Badge>
                      {extra > 0 && <span className="text-sm font-normal text-muted-foreground">+{extra} denúncia(s) do mesmo alvo</span>}
                      <span className="ml-auto">
                        {primeiro.target === 'INSTITUTION' ? (
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/institutions/${primeiro.targetId}/structure`}>Ver escola</Link>
                          </Button>
                        ) : (
                          // Por id e não por nome: o nome da denúncia vive no registo
                          // da pessoa, e na lista de contas só há o username
                          // («Administrador Kixi» vs `admin`) — homónimos incluídos.
                          // O destino direto por id é o registo da conta.
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/accounts/${primeiro.targetId}/edit`} title="Ver a conta denunciada">
                              Ver conta
                            </Link>
                          </Button>
                        )}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3">
                    {doGrupo.map((r) => (
                      <div key={r.id} data-fila-item data-fila-id={r.id} tabIndex={-1} className="scroll-mt-20 grid gap-2 rounded-lg border p-3 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <Flag className="size-4 text-muted-foreground" aria-hidden />
                          <span className="font-medium">{REASON_LABEL[r.reason]}</span>
                          <span className="text-muted-foreground">· por {r.reporterName} · {when(r.createdAt)}</span>
                        </div>
                        {r.note && <p className="text-sm">{r.note}</p>}
                        <div className="flex flex-wrap gap-2">
                          {DECISIONS.filter((d) => decisionValida(r.target, d)).map((d) => (
                            <Button
                              key={d} size="sm"
                              variant={d === 'IGNORED' ? 'outline' : d === 'HIDDEN' ? 'destructive' : 'default'}
                              onClick={(e) => abrir(r, d, e.currentTarget)}
                              data-testid={`moderacao-${VERBO[d]}-${r.id}`}
                            >
                              {DECISION_LABEL[d]}
                              <span className="sr-only"> {primeiro.targetName}</span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              );
            })}
            {porDecidir.length > 0 && <ShortcutsHint items={[{ keys: ['J', 'K'], label: 'denúncia seguinte / anterior' }]} />}
          </section>
        )}

        {/* A decisão abre em diálogo modal: foco direto na nota, Esc fecha e o
            foco volta ao botão que abriu. Antes o painel nascia depois de toda a
            lista, fora do ecrã e sem scroll nem foco. */}
        <Dialog
          open={aAbrir !== null}
          onOpenChange={(aberto) => {
            if (!aberto) fechar();
          }}
        >
          <DialogContent
            onCloseAutoFocus={(e) => {
              // O regresso automático nem sempre acerta (o foco pode já ter
              // saído do botão quando o diálogo montou): devolve-se à mão.
              e.preventDefault();
              openerRef.current?.focus();
            }}
            onEscapeKeyDown={(e) => {
              if (ocupado) e.preventDefault();
            }}
            onPointerDownOutside={(e) => {
              if (ocupado) e.preventDefault();
            }}
          >
            {aAbrir && (
              <>
                <DialogHeader>
                  <DialogTitle>
                    {DECISION_LABEL[aAbrir.decision]} — {aAbrir.report.targetName}
                  </DialogTitle>
                  <DialogDescription>{DECISION_NOTE[aAbrir.decision]}</DialogDescription>
                </DialogHeader>
                <Textarea
                  ref={notaRef}
                  value={nota}
                  onChange={(e) => setNota(e.target.value)}
                  rows={3}
                  placeholder="Porquê esta decisão (fica no registo de auditoria)"
                  aria-label="Nota da decisão"
                  aria-invalid={!!erroNota}
                  aria-describedby="nota-decisao-dica"
                />
                <p id="nota-decisao-dica" className={erroNota ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}>
                  {erroNota ??
                    (decisionExigeNota(aAbrir.decision)
                      ? `Obrigatória, com pelo menos ${NOTA_MINIMA} caracteres: é ela que explica a decisão daqui a meses.`
                      : 'Opcional, fica no registo de auditoria.')}
                </p>
                {erroDialogo && (
                  <p role="alert" className="text-sm text-destructive">
                    {erroDialogo}
                  </p>
                )}
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={fechar} disabled={ocupado}>
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={confirmar} disabled={ocupado || !!erroNota} data-testid="moderacao-confirmar">
                    {ocupado ? 'A guardar…' : `Confirmar: ${DECISION_LABEL[aAbrir.decision]}`}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>

        {separador === 'decididas' && (
          <section aria-label="Denúncias decididas" className="grid gap-3">
            <h2 className="text-lg font-semibold">Decididas</h2>
            {decididas.length === 0 && <p className="text-sm text-muted-foreground">Ainda não foi decidida nenhuma.</p>}
            {paginaDecididas.items.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3 text-sm">
                <span className="font-medium">{r.targetName}</span>
                <Badge variant="outline">{STATUS_LABEL[r.status]}</Badge>
                <span className="text-muted-foreground">{REASON_LABEL[r.reason]}</span>
                <span className="text-muted-foreground">· por {r.decidedBy} · {when(r.decidedAt)}</span>
                {r.decisionNote && <span className="w-full text-muted-foreground">{r.decisionNote}</span>}
              </div>
            ))}
            <Pagination paged={paginaDecididas} noun="denúncias" onPage={setPagina} />
          </section>
        )}
      </div>
      <QueueShortcuts handlers={{ j: () => focusQueueItem(1), k: () => focusQueueItem(-1) }} enabled={separador === 'por-decidir'} />
    </div>
  );
}