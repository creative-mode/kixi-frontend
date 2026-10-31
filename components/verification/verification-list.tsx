'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { FilterTabs, filterPanelProps } from '@/components/crud/filter-tabs';
import { Pagination } from '@/components/crud/pagination';
import { QueueShortcuts } from '@/components/crud/queue-shortcuts';
import { ShortcutsHint } from '@/components/crud/shortcuts-hint';
import { focusedQueueId, focusQueueItem } from '@/hooks/use-queue-shortcuts';
import { useQueryChoice, useQueryPage } from '@/hooks/use-query-state';
import { paginate } from '@/lib/queue-state';
import {
  DEFAULT_VERIFICATION_FILTER,
  filterRequests,
  verificationCounts,
  VERIFICATION_FILTER_KEYS,
  VERIFICATION_FILTERS,
} from '@/lib/verification/queue';
import { listVerificationRequests, reviewVerification, revokeVerification } from '@/app/actions/verification';
import { formatLuandaDateTime } from '@/lib/format';
import {
  MAX_NOTE,
  STATUS_LABEL,
  canReview,
  canRevoke,
  safeDocumentUrl,
  type VerificationRequest,
  type VerificationStatus,
} from '@/lib/verification/model';

/** Cada página mostra 10 pedidos: a fila dos decididos cresce sem fim. */
const PAGE_SIZE = 10;

const VARIANT: Record<VerificationStatus, 'warning' | 'success' | 'outline' | 'info'> = {
  PENDING: 'warning',
  APPROVED: 'success',
  REJECTED: 'outline',
  REVOKED: 'outline',
};

const when = (iso: string) => formatLuandaDateTime(iso);

type Acting = { id: number; kind: 'approve' | 'reject' | 'revoke' } | null;

export function VerificationList() {
  // O filtro e a página vivem no endereço: sobrevivem ao recarregamento e podem ir numa ligação.
  const [filter, setFilter] = useQueryChoice('filtro', VERIFICATION_FILTER_KEYS, DEFAULT_VERIFICATION_FILTER);
  const [page, setPage] = useQueryPage();
  // Carrega-se tudo uma vez: as contagens e os filtros saem da mesma lista, sem um pedido por separador.
  const [all, setAll] = useState<VerificationRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<Acting>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await listVerificationRequests(null);
    if (res.ok) setAll(res.data);
    else {
      setAll(null);
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    const task = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(task);
  }, [load]);

  const counts = useMemo(() => (all ? verificationCounts(all) : null), [all]);
  const paged = useMemo(() => paginate(all ? filterRequests(all, filter) : [], page, PAGE_SIZE), [all, filter, page]);
  const items = all ? paged.items : null;

  const pick = (next: typeof filter) => {
    setActing(null);
    setFilter(next);
    setPage(1);
  };

  const open = (id: number, kind: 'approve' | 'reject' | 'revoke') => {
    setActing({ id, kind });
    setNote('');
    setActionError(null);
    setDone(null);
  };

  /** A e R abrem o mesmo painel que os botões, no pedido onde está o foco: não decidem nada sozinhos. */
  function decideFocused(kind: 'approve' | 'reject') {
    const id = focusedQueueId();
    const request = items?.find((r) => String(r.id) === id);
    if (!request) return void toast.message('Escolha um pedido com J ou K primeiro.');
    if (!canReview(request.status)) return void toast.message('Só se aprova ou recusa um pedido por rever.');
    open(request.id, kind);
    // O painel abre com o campo da nota: o foco vai para lá, para a tecla seguinte já escrever a nota.
    requestAnimationFrame(() => document.getElementById(`nota-${request.id}`)?.focus());
  }

  async function confirm(request: VerificationRequest) {
    if (!acting) return;
    setBusy(true);
    setActionError(null);
    const res =
      acting.kind === 'revoke'
        ? await revokeVerification(request.institutionId)
        : await reviewVerification(request.id, acting.kind, note);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.error);
      return;
    }
    setDone(
      acting.kind === 'approve'
        ? `${request.officialName} ficou verificada.`
        : acting.kind === 'reject'
          ? `Pedido de ${request.officialName} recusado. A escola vê o motivo.`
          : `O selo de ${request.officialName} foi revogado.`,
    );
    setActing(null);
    await load();
  }

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="rounded-md bg-accent p-2 text-primary"><BadgeCheck size={20} aria-hidden /></div>
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">Verificação</h1>
          <p className="text-sm text-muted-foreground">Pedidos do selo de escola verificada. Só o administrador aprova, recusa ou revoga.</p>
        </div>
      </div>

      <FilterTabs
        group="verificacao"
        label="Filtrar por estado"
        value={filter}
        onChange={pick}
        tabs={VERIFICATION_FILTERS.map((f) => ({ key: f.key, label: f.label, count: counts ? counts[f.key] : null }))}
      />

      <div role="status" aria-live="polite">
        {done && <p className="mb-4 rounded-md bg-success-soft px-3 py-2 text-sm text-success">{done}</p>}
      </div>

      <div {...filterPanelProps('verificacao', filter)}>
        {error ? (
          <Card><CardContent className="py-12 text-center">
            <p className="mb-3 text-sm text-destructive" role="alert">{error}</p>
            <Button size="sm" variant="outline" onClick={load}>Tentar de novo</Button>
          </CardContent></Card>
        ) : items === null ? (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">A carregar…</CardContent></Card>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
            {filter === 'todos' ? 'Ainda não há pedidos de verificação.' : `Não há pedidos «${(VERIFICATION_FILTERS.find((f) => f.key === filter)?.label ?? '').toLowerCase()}».`}
          </CardContent></Card>
        ) : (
          <ul className="grid gap-3">
            {items.map((r) => {
              const doc = safeDocumentUrl(r.documentUrl);
              const here = acting?.id === r.id ? acting : null;
              return (
                <li key={r.id} data-fila-item data-fila-id={r.id} tabIndex={-1} className="scroll-mt-20 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50">
                  <Card><CardContent className="grid gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="font-semibold">{r.officialName}</h2>
                        <p className="text-sm text-muted-foreground">NIF/registo {r.registrationNumber} · {r.contactEmail}</p>
                      </div>
                      <Badge variant={VARIANT[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                    </div>
                    <p className="text-sm tabular-nums text-muted-foreground">Pedido em {when(r.createdAt)}{r.reviewedAt ? ` · decidido em ${when(r.reviewedAt)}` : ''}</p>
                    {r.notes && <p className="text-sm">{r.notes}</p>}
                    {doc && <p className="text-sm"><a href={doc} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline">Abrir o documento<span className="sr-only"> de {r.officialName} (abre noutro separador)</span></a></p>}
                    {r.reviewNote && <p className="text-sm"><span className="font-medium">Nota:</span> {r.reviewNote}</p>}

                    {!here && (canReview(r.status) || canRevoke(r.status)) && (
                      <div className="flex flex-wrap gap-2">
                        {canReview(r.status) && (
                          <>
                            <Button size="sm" onClick={() => open(r.id, 'approve')}>Aprovar<span className="sr-only"> {r.officialName}</span></Button>
                            <Button size="sm" variant="outline" onClick={() => open(r.id, 'reject')}>Recusar<span className="sr-only"> {r.officialName}</span></Button>
                          </>
                        )}
                        {canRevoke(r.status) && <Button size="sm" variant="outline" onClick={() => open(r.id, 'revoke')}>Revogar selo<span className="sr-only"> de {r.officialName}</span></Button>}
                      </div>
                    )}

                    {here && (
                      <div className="grid gap-2 border-t pt-3">
                        {here.kind === 'revoke' ? (
                          <p className="text-sm">Revogar o selo tira o símbolo de verificada a esta escola e aos seus professores. Confirma?</p>
                        ) : (
                          <>
                            <label htmlFor={`nota-${r.id}`} className="text-sm font-medium">
                              {here.kind === 'reject' ? 'Motivo da recusa (a escola vê)' : 'Nota (opcional)'}
                            </label>
                            <Textarea id={`nota-${r.id}`} value={note} maxLength={MAX_NOTE} onChange={(e) => setNote(e.target.value)} />
                          </>
                        )}
                        {actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}
                        <div className="flex gap-2">
                          <Button size="sm" disabled={busy} aria-busy={busy} onClick={() => void confirm(r)}>
                            {busy ? 'A guardar…' : here.kind === 'approve' ? 'Confirmar aprovação' : here.kind === 'reject' ? 'Confirmar recusa' : 'Confirmar revogação'}
                          </Button>
                          <Button size="sm" variant="outline" disabled={busy} onClick={() => setActing(null)}>Cancelar</Button>
                        </div>
                      </div>
                    )}
                  </CardContent></Card>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <Pagination paged={paged} noun="pedidos" onPage={setPage} />
      {items && items.length > 0 && (
        <div className="mt-4">
          <ShortcutsHint items={[{ keys: ['J', 'K'], label: 'pedido seguinte / anterior' }, { keys: ['A'], label: 'aprovar o pedido em foco' }, { keys: ['R'], label: 'recusar o pedido em foco' }]} />
        </div>
      )}
      <QueueShortcuts handlers={{ j: () => focusQueueItem(1), k: () => focusQueueItem(-1), a: () => decideFocused('approve'), r: () => decideFocused('reject') }} />
    </div>
  );
}
