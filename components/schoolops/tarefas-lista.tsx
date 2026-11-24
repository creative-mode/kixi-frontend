'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { listarTarefas } from '@/app/actions/schoolops';
import { filtrarTarefas, SEM_FILTRO, type FiltroDeTarefas, type Tarefa } from '@/lib/schoolops/tarefas';

const data = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
const atrasada = (t: Tarefa) => t.prazo !== null && new Date(t.prazo).getTime() < Date.now();

export function TarefasLista() {
  const [tarefas, setTarefas] = useState<Tarefa[] | null>(null);
  const [total, setTotal] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<FiltroDeTarefas>(SEM_FILTRO);

  const carregar = useCallback(async () => {
    setErro(null);
    const r = await listarTarefas();
    if (r.ok) {
      setTarefas(r.data.tarefas);
      setTotal(r.data.total);
    }
    else {
      setTarefas([]);
      setErro(r.error);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => void carregar(), 0);
    return () => window.clearTimeout(t);
  }, [carregar]);

  const processos = useMemo(() => [...new Set((tarefas ?? []).map((t) => t.processo))].sort((a, b) => a.localeCompare(b, 'pt')), [tarefas]);
  // O relógio só se lê quando o filtro ou a lista mudam, não a cada render.
  const visiveis = useMemo(() => filtrarTarefas(tarefas ?? [], filtro, Date.now()), [tarefas, filtro]);

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      <header className="mb-6 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent text-primary">
          <ClipboardCheck size={20} />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tarefas das pautas</h1>
          <p className="text-sm text-muted-foreground">Correcções, validações e reclamações que esperam por si.</p>
        </div>
      </header>

      {tarefas === null ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : erro ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-3 text-sm text-destructive">{erro}</p>
            <Button size="sm" variant="outline" onClick={carregar}>Tentar de novo</Button>
          </CardContent>
        </Card>
      ) : tarefas.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">Não tem tarefas por fazer.</CardContent>
        </Card>
      ) : (
        <>
        {total > tarefas.length && (
          <p className="mb-3 text-sm text-muted-foreground">A mostrar as {tarefas.length} mais antigas de {total} tarefas.</p>
        )}
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Tipo</span>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filtro.processo} onChange={(e) => setFiltro((f) => ({ ...f, processo: e.target.value }))}>
              <option value="">Todos</option>
              {processos.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Prazo</span>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={filtro.prazo} onChange={(e) => setFiltro((f) => ({ ...f, prazo: e.target.value as FiltroDeTarefas['prazo'] }))}>
              <option value="todas">Todas</option>
              <option value="em-prazo">Dentro do prazo</option>
              <option value="atrasadas">Prazo ultrapassado</option>
            </select>
          </label>
          <p className="pb-2 text-sm text-muted-foreground" role="status">{visiveis.length} de {tarefas.length} tarefas</p>
        </div>
        {visiveis.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma tarefa corresponde ao filtro.</p>}
        <ul className="grid gap-3">
          {visiveis.map((t) => (
            <li key={t.key}>
              <Link
                href={`/tarefas/${t.key}`}
                className="group flex items-center gap-4 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <Badge variant="secondary">{t.processo}</Badge>
                    {atrasada(t) && <Badge variant="warning">Prazo ultrapassado</Badge>}
                  </div>
                  <p className="truncate font-medium">{t.nome}</p>
                  {t.detalhe && <p className="truncate text-sm text-muted-foreground">{t.detalhe}</p>}
                  <p className="text-xs text-muted-foreground">
                    Aberta a {data(t.criadaEm)}
                    {t.prazo && ` · prazo ${data(t.prazo)}`}
                  </p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          ))}
        </ul>
        </>
      )}
    </div>
  );
}
