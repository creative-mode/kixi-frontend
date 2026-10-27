'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { abrirTarefa, concluir, type TarefaAberta } from '@/app/actions/schoolops';
import { FormCamunda } from './form-camunda';

export function TarefaForm({ chave }: { chave: string }) {
  const router = useRouter();
  const [aberta, setAberta] = useState<TarefaAberta | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aEnviar, setAEnviar] = useState(false);

  useEffect(() => {
    let activo = true;
    void abrirTarefa(chave).then((r) => {
      if (!activo) return;
      if (r.ok) setAberta(r.data);
      else setErro(r.error);
    });
    return () => {
      activo = false;
    };
  }, [chave]);

  async function enviar(dados: Record<string, unknown>) {
    setAEnviar(true);
    const r = await concluir(chave, dados);
    if (r.ok) {
      toast.success('Tarefa concluída.');
      router.push('/tarefas');
      router.refresh();
    } else {
      toast.error(r.error);
      setAEnviar(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <Link href="/tarefas" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft size={14} /> Tarefas
      </Link>

      {erro ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-destructive">{erro}</CardContent>
        </Card>
      ) : aberta === null ? (
        <div className="grid gap-3">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : (
        <>
          <header className="mb-4">
            <Badge variant="secondary" className="mb-2">{aberta.tarefa.processo}</Badge>
            <h1 className="text-xl font-semibold tracking-tight">{aberta.tarefa.nome}</h1>
          </header>
          <Card>
            <CardContent className="p-4 md:p-6">
              {aberta.precisaDeFicheiros ? (
                <div className="grid gap-3 text-sm">
                  <p>Esta tarefa pede o envio de ficheiros (as folhas digitalizadas). Por agora conclui-se no Tasklist.</p>
                  <Button asChild variant="outline" className="w-fit">
                    <a href={process.env.NEXT_PUBLIC_SCHOOLOPS_TASKLIST_URL ?? '#'} target="_blank" rel="noreferrer">
                      Abrir no Tasklist <ExternalLink size={14} />
                    </a>
                  </Button>
                </div>
              ) : aberta.schema ? (
                <FormCamunda schema={aberta.schema} dados={aberta.dados} aEnviar={aEnviar} onEnviar={enviar} />
              ) : (
                <p className="text-sm text-muted-foreground">Esta tarefa não tem formulário.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
