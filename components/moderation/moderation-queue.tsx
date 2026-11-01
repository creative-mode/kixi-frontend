'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Flag } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  REASON_LABEL,
  STATUS_LABEL,
  TARGET_LABEL,
  contarPorMotivo,
  decisionValida,
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
import { formatLuandaDateTime } from '@/lib/format';

/** O verbo da decisão, para o `data-testid` se ler como a acção e não como o
 *  participio: `moderacao-ignore-12`, e não `moderacao-ignored-12`. */
const VERBO: Record<Decision, string> = { IGNORED: 'ignore', HIDDEN: 'hide', SUSPENDED: 'suspend' };

const when = (iso: string | null) => formatLuandaDateTime(iso);

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

  function abrir(report: Report, decision: Decision) {
    setNota('');
    setAAbrir({ report, decision });
  }

  async function confirmar() {
    if (!aAbrir) return;
    setOcupado(true);
    setErro(null);
    const r = await decideReport(aAbrir.report.id, aAbrir.decision, aAbrir.report.target, nota);
    setOcupado(false);
    if (!r.ok) setErro(r.error);
    else {
      setAAbrir(null);
      await carregar();
    }
  }

  if (erro && !reports) return <p className="text-sm text-destructive">{erro}</p>;
  if (!reports) return <p className="text-sm text-muted-foreground">A carregar denúncias…</p>;

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="text-2xl font-bold text-foreground md:text-3xl">Moderação</h1>
        <p className="text-sm text-muted-foreground">
          Denúncias de perfis e de escolas. Só o administrador decide, e cada decisão fica registada.
        </p>
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
                    <CardTitle className="text-base">
                      {primeiro.targetName}
                      <Badge variant="outline" className="ml-2">{TARGET_LABEL[primeiro.target]}</Badge>
                      {extra > 0 && <span className="ml-2 text-sm font-normal text-muted-foreground">+{extra} denúncia(s) do mesmo alvo</span>}
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
                              onClick={() => abrir(r, d)}
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

        {separador === 'por-decidir' && aAbrir && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {DECISION_LABEL[aAbrir.decision]} — {aAbrir.report.targetName}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm text-muted-foreground">{DECISION_NOTE[aAbrir.decision]}</p>
              <Textarea
                value={nota} onChange={(e) => setNota(e.target.value)} rows={3}
                placeholder="Porquê esta decisão (fica no registo de auditoria)"
                aria-label="Nota da decisão"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setAAbrir(null)} disabled={ocupado}>Cancelar</Button>
                <Button size="sm" onClick={confirmar} disabled={ocupado} data-testid="moderacao-confirmar">
                  {ocupado ? 'A guardar…' : `Confirmar: ${DECISION_LABEL[aAbrir.decision]}`}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

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
