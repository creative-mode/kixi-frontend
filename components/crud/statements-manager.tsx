'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, Check, Eye, EyeOff, FileSearch, ScanText, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { approveStatement, deleteRow, listStatements, setStatementVisible } from '@/app/actions/crud';
import { ENTITIES, type Row } from '@/lib/crud/entities';
import { Confirm, type ConfirmState } from './confirm';
import { PageHead } from './page-head';

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
    load();
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
            <Button asChild variant="outline">
              <Link href="/statements/trash"><Archive size={16} /> Lixeira</Link>
            </Button>
            <Button asChild>
              <Link href="/statements/import"><ScanText size={16} /> Importar prova</Link>
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
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                {entity.columns.map((c) => (
                  <TableHead key={c.label} className={`font-medium text-muted-foreground ${c.className ?? ''}`}>{c.label}</TableHead>
                ))}
                <TableHead className="font-medium text-muted-foreground">Estado</TableHead>
                <TableHead className="text-right font-medium text-muted-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows === null ? (
                <TableRow><TableCell colSpan={6} className="py-16 text-center text-muted-foreground">A carregar…</TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-sm text-destructive">{error}</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-16 text-center text-sm text-muted-foreground">Nenhum enunciado neste filtro.</TableCell></TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id} className="border-border hover:bg-accent/50">
                    {entity.columns.map((c) => (
                      <TableCell key={c.label} className={c.className}>{c.value(row)}</TableCell>
                    ))}
                    <TableCell>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant={row.visible ? 'default' : 'outline'}>{row.visible ? 'Publicado' : 'Oculto'}</Badge>
                        {row.needsReview ? <Badge variant="secondary">A rever</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" asChild aria-label="Ver questões" title="Ver questões">
                          <Link href={`/statements/${row.id}`}><FileSearch size={16} /></Link>
                        </Button>
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
    </div>
  );
}
