'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Componente } from '@/lib/schoolops/tarefas';
import './calendario.css';
import './form-camunda.css';

type Props = {
  schema: Componente;
  dados: Record<string, unknown>;
  aEnviar: boolean;
  onEnviar: (dados: Record<string, unknown>) => void;
};

/**
 * Mostra um form do Camunda (o mesmo do Tasklist) com o desenho do Kixi: o viewer do form-js escreve o HTML e
 * `form-camunda.css` aplica-lhe os tokens do design system. O botão de enviar é do Kixi, não do form.
 */
export function FormCamunda({ schema, dados, aEnviar, onEnviar }: Props) {
  const contentor = useRef<HTMLDivElement>(null);
  const form = useRef<import('@bpmn-io/form-js-viewer').Form | null>(null);
  const [pronto, setPronto] = useState(false);
  const [problemas, setProblemas] = useState<string | null>(null);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    let cancelado = false;
    void (async () => {
      const { Form } = await import('@bpmn-io/form-js-viewer');
      if (cancelado || !contentor.current) return;
      const instancia = new Form({ container: contentor.current });
      form.current = instancia;
      try {
        await instancia.importSchema(schema, dados);
        if (!cancelado) setPronto(true);
      } catch (e) {
        console.error('[schoolops] form:', e);
        if (!cancelado) setFalhou(true);
      }
    })();
    return () => {
      cancelado = true;
      form.current?.destroy();
      form.current = null;
    };
  }, [schema, dados]);

  function submeter() {
    const instancia = form.current;
    if (!instancia) return;
    const { data, errors } = instancia.submit();
    const invalidos = Object.keys(errors ?? {}).length;
    if (invalidos > 0) {
      setProblemas(invalidos === 1 ? 'Há um campo por corrigir.' : `Há ${invalidos} campos por corrigir.`);
      return;
    }
    setProblemas(null);
    onEnviar(data as Record<string, unknown>);
  }

  return (
    <div className="grid gap-5">
      {!pronto && !falhou && <Skeleton className="h-48 w-full rounded-xl" />}
      <div ref={contentor} className="form-camunda" aria-busy={!pronto} />
      {falhou && <p role="alert" className="text-sm text-destructive">Não foi possível mostrar o formulário desta tarefa. Conclua-a no Tasklist.</p>}
      {problemas && <p role="alert" className="text-sm text-destructive">{problemas}</p>}
      <div className="flex justify-end">
        <Button onClick={submeter} disabled={!pronto || aEnviar}>
          {aEnviar ? 'A concluir…' : 'Concluir tarefa'}
        </Button>
      </div>
    </div>
  );
}
