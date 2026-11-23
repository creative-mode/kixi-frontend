'use client';

import { useCallback, useEffect, useState } from 'react';
import { BASE_PATH } from '@/lib/base-path';
import { VITAL_TARGETS, type VitalSummary } from '@/lib/vitals';

interface Snapshot {
  samples: number;
  targets: Record<string, number>;
  summary: VitalSummary[];
}

const STATUS = (good: boolean) => good ? 'Dentro' : 'Acima';

/** Painel local do #799: lê o coletor da mesma máquina. Não existe fora de KIXI_VITALS_LOG=true. */
export function VitalsPanel() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch(`${BASE_PATH}/api/vitals`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`O coletor respondeu ${response.status}.`);
      setData(await response.json() as Snapshot);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível ler as métricas.');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="mx-auto grid w-full max-w-4xl gap-4 p-4">
      <header className="grid gap-1">
        <h1 className="text-xl font-extrabold">Métricas de campo (local)</h1>
        <p className="text-sm text-muted-foreground">
          Aceita os cookies, navega nas páginas e volta aqui. Cada linha é o p75 de uma rota e aparelho.
          Este painel só existe com <code>KIXI_VITALS_LOG=true</code> e num host local.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void load()} className="min-h-11 rounded-lg border bg-card px-4 text-sm font-bold">
          Atualizar
        </button>
        <span className="text-sm text-muted-foreground">
          {data ? `${data.samples} amostra(s)` : 'sem leitura'}
        </span>
      </div>

      {error && <p role="alert" className="rounded-lg border border-destructive/40 bg-danger-soft p-3 text-sm">{error}</p>}

      <section className="grid gap-2 sm:grid-cols-2" aria-label="Metas">
        {Object.entries(VITAL_TARGETS).map(([metric, target]) => (
          <p key={metric} className="rounded-lg border bg-card p-3 text-sm">
            <b>{metric}</b>: {metric === 'CLS' ? target.toFixed(2) : `<= ${target} ms`}
          </p>
        ))}
      </section>

      {data && data.summary.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Ainda não há amostras. Navega para o Início, Provas ou Resultado com os cookies aceites.
        </p>
      )}

      {data && data.summary.length > 0 && (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">p75 por rota, métrica e aparelho</caption>
            <thead className="bg-secondary">
              <tr>
                <th scope="col" className="p-2.5">Rota</th>
                <th scope="col" className="p-2.5">Métrica</th>
                <th scope="col" className="p-2.5">p75</th>
                <th scope="col" className="p-2.5">Meta</th>
              </tr>
            </thead>
            <tbody>
              {data.summary.map((row) => (
                <tr key={`${row.page}:${row.metric}:${row.device}`} className="border-t align-top">
                  <td className="p-2.5">
                    <span className="block font-semibold">{row.page}</span>
                    <span className="block text-xs text-muted-foreground">{row.device}</span>
                  </td>
                  <td className="p-2.5">
                    <span className="block">{row.metric}</span>
                    <span className="block text-xs text-muted-foreground">{row.samples} amostra(s)</span>
                  </td>
                  <td className="p-2.5 tabular-nums whitespace-nowrap">
                    {row.metric === 'CLS' ? row.p75.toFixed(3) : `${Math.round(row.p75)} ms`}
                  </td>
                  <td className={`p-2.5 font-semibold ${row.good ? 'text-primary' : 'text-destructive'}`}>
                    {STATUS(row.good)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
