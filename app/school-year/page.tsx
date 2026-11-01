'use client';

import { useEffect, useState } from 'react';
import { getActiveSchoolYears, restoreSchoolYear, softDeleteSchoolYear } from '@/app/actions/school-year';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, Edit, Trash2, Plus, Calendar, Archive } from 'lucide-react';
import type { SchoolYearResponse } from '@/types/school-year';
import { Spinner } from '@/components/ui/spinner';
import { TableRowsSkeleton } from '@/components/crud/loading';
import { Confirm, type ConfirmState } from '@/components/crud/confirm';

export default function SchoolYearsManager() {
  const [schoolYears, setSchoolYears] = useState<SchoolYearResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  useEffect(() => {
    loadSchoolYears();
  }, []);

  async function loadSchoolYears() {
    setLoading(true);
    try {
      const data = await getActiveSchoolYears();
      setSchoolYears(data);
    } catch (error: unknown) {
      console.error('Erro ao carregar anos letivos:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao carregar anos letivos');
    } finally {
      setLoading(false);
    }
  }

  async function handleSoftDelete(year: SchoolYearResponse): Promise<boolean> {
    setDeletingId(year.id);
    try {
      const result = await softDeleteSchoolYear(year.id);
      if (result.success) {
        toast.success(`Ano letivo ${year.startYear}–${year.endYear} movido para a lixeira`, {
          duration: 10_000,
          action: { label: 'Desfazer', onClick: async () => {
            const restored = await restoreSchoolYear(year.id);
            if (restored.success) { toast.success('Ano letivo restaurado'); await loadSchoolYears(); }
            else toast.error(restored.error || 'Erro ao restaurar');
          } },
        });
        await loadSchoolYears();
        return true;
      } else {
        toast.error(result.error || 'Erro ao eliminar');
        return false;
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Erro ao eliminar');
      return false;
    } finally {
      setDeletingId(null);
    }
  }

  function askSoftDelete(year: SchoolYearResponse) {
    setConfirm({
      title: 'Mover para a lixeira?',
      description: `O ano letivo ${year.startYear}–${year.endYear} poderá ser restaurado pela lixeira.`,
      action: 'Mover para a lixeira',
      busyLabel: 'A mover para a lixeira…',
      destructive: true,
      run: () => handleSoftDelete(year),
    });
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-md bg-warning-soft text-warning">
              <Calendar size={20} />
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Anos Letivos</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-12">Gestão de períodos letivos do sistema</p>
        </div>
        
        <div className="flex gap-3">
          <Button asChild variant="outline" className="border-border text-muted-foreground hover:bg-accent hover:text-foreground">
            <Link href="/school-year/trash">
              <Archive size={16} className="mr-2" />
              Lixeira
            </Link>
          </Button>
          <Button asChild >
            <Link href="/school-year/new">
              <Plus size={16} className="mr-2" />
              Novo Ano Letivo
            </Link>
          </Button>
        </div>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader className="border-b border-border">
          <CardTitle className="text-base font-semibold text-foreground">Anos Letivos Ativos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground font-medium">Ano Letivo</TableHead>
                <TableHead className="text-muted-foreground font-medium">Início</TableHead>
                <TableHead className="text-muted-foreground font-medium">Fim</TableHead>
                <TableHead className="text-muted-foreground font-medium">Criado em</TableHead>
                <TableHead className="text-muted-foreground font-medium">Últ. atualização</TableHead>
                <TableHead className="text-right text-muted-foreground font-medium">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRowsSkeleton cols={6} />
              ) : schoolYears.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Calendar size={32} className="text-muted-foreground" />
                      <span className="text-sm">Nenhum ano letivo registado ainda.</span>
                      <Button asChild size="sm" className="mt-2 ">
                        <Link href="/school-year/new">
                          <Plus size={14} className="mr-1" />
                          Criar primeiro ano letivo
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                schoolYears.map((year) => (
                  <TableRow key={year.id} className="hover:bg-accent/50 border-border transition-colors">
                    <TableCell className="font-semibold text-foreground">
                      {year.startYear} – {year.endYear}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{year.startYear}</TableCell>
                    <TableCell className="text-muted-foreground">{year.endYear}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      {format(new Date(year.createdAt), "dd 'de' MMM yyyy, HH:mm", { locale: pt })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground text-sm">
                      {format(new Date(year.updatedAt), "dd 'de' MMM yyyy, HH:mm", { locale: pt })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted" asChild>
                          <Link href={`/school-year/${year.id}`} aria-label={`Ver o ano letivo ${year.startYear}–${year.endYear}`}>
                            <Eye size={16} />
                          </Link>
                        </Button>

                        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-muted" asChild>
                          <Link href={`/school-year/${year.id}/edit`} aria-label={`Editar o ano letivo ${year.startYear}–${year.endYear}`}>
                            <Edit size={16} />
                          </Link>
                        </Button>
                        
                        <Button 
                          variant="ghost" 
                          size="sm"
                          className="text-muted-foreground hover:text-destructive hover:bg-danger-soft"
                          disabled={deletingId === year.id}
                          aria-label={`Mover o ano letivo ${year.startYear}–${year.endYear} para a reciclagem`}
                          onClick={() => askSoftDelete(year)}
                        >
                          {deletingId === year.id ? (
                            <Spinner className="size-4" />
                          ) : (
                            <Trash2 size={16} />
                          )}
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
      <Confirm state={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}
