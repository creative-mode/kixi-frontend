'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Archive, Check, DoorOpen, Eye, EyeOff, FileSearch, FileText, ScanText, Search, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { approveStatement, deleteRow, listOptions, listStatements, setStatementVisible } from '@/app/actions/crud';
import { EMPTY_FILTERS, activeFilters, distinct, filterStatements, idsUsed, type LibraryFilters } from '@/lib/exam/library';
import { SheetView } from './statement-sheet';
import { ENTITIES, type Row } from '@/lib/crud/entities';
import { statementInScope, useTeacherScope } from '@/hooks/use-teacher-scope';
import { Confirm, type ConfirmState } from './confirm';
import { PageHead } from './page-head';
import { TableRowsSkeleton } from './loading';

const entity = ENTITIES.statements;
const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'review', label: 'Para rever' },
  { key: 'ocr', label: 'Vindos do OCR' },
] as const;

export function StatementsManager() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  // A biblioteca: os enunciados de todas as escolas, filtrados no cliente (a lista já vem inteira) e abertos na folha.
  const [filters, setFilters] = useState<LibraryFilters>(EMPTY_FILTERS);
  const [names, setNames] = useState<{ institutions: Map<number, string>; subjects: Map<number, string>; years: Map<number, string> }>({ institutions: new Map(), subjects: new Map(), years: new Map() });
  const [viewing, setViewing] = useState<Row | null>(null);
  // O professor vê os enunciados que pode escrever (o ADMIN vê todos). Sem
  // scope resolvido fica null, e a tabela continua no esqueleto.
  const scope = useTeacherScope();
  const shown = useMemo(
    () => (rows && scope ? rows.filter((r) => statementInScope(scope, r)) : null),
    [rows, scope],
  );
  // A lixeira é gestão (o proxy não a abre ao professor), por isso só o ADMIN vê o link.
  const admin = scope ? !scope.restricted : false;

  useEffect(() => {
    let alive = true;
    (async () => {
      const [institutions, subjects, years] = await Promise.all([listOptions('institutions'), listOptions('subjects'), listOptions('school-years')]);
      if (!alive) return;
      const map = (r: typeof institutions) => new Map((r.ok ? r.data : []).map((o) => [o.value, o.label] as const));
      setNames({ institutions: map(institutions), subjects: map(subjects), years: map(years) });
    })();
    return () => { alive = false; };
  }, []);

  const visible = useMemo(() => (shown ? filterStatements(shown, filters) : null), [shown, filters]);
  const set = <K extends keyof LibraryFilters>(key: K, value: LibraryFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const used = useMemo(() => ({
    institutions: idsUsed(shown ?? [], 'institutionId'),
    subjects: idsUsed(shown ?? [], 'subjectId'),
    years: idsUsed(shown ?? [], 'schoolYearId'),
    kinds: distinct(shown ?? [], 'examType'),
    sources: distinct(shown ?? [], 'source'),
  }), [shown]);

  const load = useCallback(async () => {
    setError(null);
    setRows(null);
    const res = await listStatements(filter);
    if (res.ok) setRows(res.data);
    else {
      setRows([]);
      setError(res.error);
    }
  }, [filter]);
  useEffect(() => {
    const task = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(task);
  }, [load]);

  async function act(p: Promise<{ ok: boolean; error?: string }>, done: string) {
    const res = await p;
    if (res.ok) {
      toast.success(done);
      load();
    } else toast.error(res.error ?? 'Erro');
  }

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-8">
      <PageHead
        entity={entity}
        actions={
          <div className="flex gap-2">
            {admin ? (
              <Button asChild variant="outline">
                <Link href="/statements/trash"><Archive size={16} /> Lixeira</Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/exam-builder?importar=1"><ScanText size={16} /> Importar prova</Link>
            </Button>
          </div>
        }
      />
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Filtro">
        {FILTERS.map((f) => (
          <Button key={f.key} role="tab" aria-selected={filter === f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
            {f.label}
          </Button>
        ))}
      </div>
      <div className="mb-4 grid gap-2 rounded-lg border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4" role="search" aria-label="Filtrar enunciados">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={filters.q} onChange={(e) => set('q', e.target.value)} placeholder="Pesquisar por título, tipo ou série…" aria-label="Pesquisar enunciados" className="pl-9" />
        </div>
        <NativeSelect value={filters.institutionId} onChange={(e) => set('institutionId', e.target.value)} aria-label="Escola">
          <option value="">Todas as escolas</option>
          {[...names.institutions].filter(([id]) => used.institutions.has(String(id))).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </NativeSelect>
        <NativeSelect value={filters.subjectId} onChange={(e) => set('subjectId', e.target.value)} aria-label="Disciplina">
          <option value="">Todas as disciplinas</option>
          {[...names.subjects].filter(([id]) => used.subjects.has(String(id))).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </NativeSelect>
        <NativeSelect value={filters.examType} onChange={(e) => set('examType', e.target.value)} aria-label="Tipo de prova">
          <option value="">Todos os tipos</option>
          {used.kinds.map((k) => <option key={k} value={k}>{k}</option>)}
        </NativeSelect>
        <NativeSelect value={filters.schoolYearId} onChange={(e) => set('schoolYearId', e.target.value)} aria-label="Ano letivo">
          <option value="">Todos os anos</option>
          {[...names.years].filter(([id]) => used.years.has(String(id))).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </NativeSelect>
        <NativeSelect value={filters.state} onChange={(e) => set('state', e.target.value as LibraryFilters['state'])} aria-label="Estado">
          <option value="all">Qualquer estado</option>
          <option value="published">Publicados</option>
          <option value="hidden">Ocultos</option>
          <option value="review">Para rever</option>
        </NativeSelect>
        <NativeSelect value={filters.source} onChange={(e) => set('source', e.target.value)} aria-label="Origem">
          <option value="">Qualquer origem</option>
          {used.sources.map((k) => <option key={k} value={k}>{k}</option>)}
        </NativeSelect>
        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground sm:col-span-2 lg:col-span-4">
          <span role="status" aria-live="polite">
            {visible === null ? 'A carregar…' : `${visible.length} de ${shown?.length ?? 0} enunciados`}
          </span>
          {activeFilters(filters) > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}><X aria-hidden />Limpar filtros ({activeFilters(filters)})</Button>
          )}
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {entity.columns.map((c) => (
                  <TableHead key={c.label} className={`font-medium text-muted-foreground ${c.className ?? ''}`}>{c.label}</TableHead>
                ))}
                <TableHead className="font-medium text-muted-foreground">Escola · disciplina</TableHead>
                <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {error ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-destructive">{error}</TableCell></TableRow>
              ) : scope?.error ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-sm text-destructive">Não foi possível determinar as suas turmas, por isso a lista fica vazia: {scope.error}</TableCell></TableRow>
              ) : visible === null ? (
                <TableRowsSkeleton cols={7} />
              ) : visible.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-16 text-center text-sm text-muted-foreground">Nenhum enunciado com estes filtros.</TableCell></TableRow>
              ) : (
                visible.map((row) => (
                  <TableRow key={row.id} className="border-border hover:bg-accent/50">
                    {entity.columns.map((c) => (
                      <TableCell key={c.label} className={c.className}>{c.value(row)}</TableCell>
                    ))}
                    <TableCell className="text-sm text-muted-foreground">
                      {[names.institutions.get(Number(row.institutionId)), names.subjects.get(Number(row.subjectId))].filter(Boolean).join(' · ') || '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={row.visible ? 'default' : 'outline'}>{row.visible ? 'Publicado' : 'Oculto'}</Badge>
                        {row.needsReview ? <Badge variant="secondary">A rever</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" aria-label="Ver a folha e a chave" title="Ver a folha e a chave" onClick={() => setViewing(row)}>
                          <FileText size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" asChild aria-label="Ver questões" title="Ver questões">
                          <Link href={`/statements/${row.id}`}><FileSearch size={16} /></Link>
                        </Button>
                        {row.visible && !row.needsReview ? (
                          <Button variant="ghost" size="sm" asChild aria-label="Criar sala com este enunciado" title="Criar sala com este enunciado">
                            <Link href={`/exam-rooms/new?statementId=${row.id}`}><DoorOpen size={16} /></Link>
                          </Button>
                        ) : null}
                        {row.needsReview ? (
                          <Button variant="ghost" size="sm" aria-label="Aprovar revisão" title="Aprovar revisão" onClick={() => act(approveStatement(row.id), 'Revisão aprovada')}>
                            <Check size={16} />
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={row.visible ? 'Ocultar aos alunos' : 'Publicar aos alunos'}
                          title={row.visible ? 'Ocultar aos alunos' : 'Publicar aos alunos'}
                          onClick={() => act(setStatementVisible(row.id, !row.visible), row.visible ? 'Enunciado ocultado' : 'Enunciado publicado')}
                        >
                          {row.visible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="hover:bg-danger-soft hover:text-destructive"
                          aria-label="Mover para a lixeira"
                          onClick={() =>
                            setConfirm({
                              title: 'Mover para a lixeira?',
                              description: `«${row.title}» deixa de aparecer aos alunos. Pode restaurá-lo na lixeira.`,
                              action: 'Mover para a lixeira',
                              destructive: true,
                              run: () => act(deleteRow('statements', row.id), 'Enunciado movido para a lixeira'),
                            })
                          }
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <p className="mt-3 text-xs text-muted-foreground">Os enunciados chegam pelo OCR (Importar prova): aqui revê-se, publica-se e arquiva-se.</p>
      <Confirm state={confirm} onClose={() => setConfirm(null)} />
      <Dialog open={viewing !== null} onOpenChange={(open) => { if (!open) setViewing(null); }}>
        <DialogContent className="max-h-[92dvh] max-w-[min(960px,96vw)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.title ?? 'Enunciado'}</DialogTitle>
            <DialogDescription>O enunciado como o aluno o recebe, e a chave com a resposta de cada questão, no molde do construtor.</DialogDescription>
          </DialogHeader>
          {viewing && <SheetView statementId={Number(viewing.id)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
