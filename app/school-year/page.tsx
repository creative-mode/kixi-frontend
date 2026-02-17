'use client';

import { useEffect, useState } from 'react';
import { getActiveSchoolYears } from '@/app/actions/school-year';
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

export default function SchoolYearsManager() {
  const [schoolYears, setSchoolYears] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSchoolYears();
  }, []);

  async function loadSchoolYears() {
    setLoading(true);
    try {
      const data = await getActiveSchoolYears();
      setSchoolYears(data);
    } catch (error) {
      console.error('Erro ao carregar anos letivos:', error);
      // Aqui podes adicionar um toast de erro se tiveres um sistema de notificações
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h1 className="text-2xl md:text-3xl font-bold">Anos Letivos</h1>
        
        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/school-years/trash">Ver Lixeira</Link>
          </Button>
          {/* Aqui podes colocar o botão/novo formulário de criar ano letivo */}
          {/* <SchoolYearCreateButton /> ou modal trigger */}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Anos Letivos Ativos</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ano Letivo</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Últ. atualização</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    A carregar anos letivos...
                  </TableCell>
                </TableRow>
              ) : schoolYears.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                    Nenhum ano letivo registado ainda.
                  </TableCell>
                </TableRow>
              ) : (
                schoolYears.map((year) => (
                  <TableRow key={year.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium">
                      {year.startYear} – {year.endYear}
                    </TableCell>
                    <TableCell>{year.startYear}</TableCell>
                    <TableCell>{year.endYear}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(year.createdAt), "dd 'de' MMM yyyy, HH:mm", { locale: pt })}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(year.updatedAt), "dd 'de' MMM yyyy, HH:mm", { locale: pt })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {/* Botão editar */}
                        <Button variant="outline" size="sm">
                          Editar
                        </Button>
                        
                        {/* Botão eliminar (soft delete) */}
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={async () => {
                            if (confirm(`Tem certeza que deseja mover o ano letivo ${year.startYear}-${year.endYear} para a lixeira?`)) {
                              // Chama a action de soft delete
                              // await softDeleteSchoolYear(year.id);
                              // depois recarrega: loadSchoolYears();
                              alert('Funcionalidade de eliminar ainda não implementada nesta versão');
                            }
                          }}
                        >
                          Eliminar
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
    </div>
  );
}