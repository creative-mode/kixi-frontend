'use client';

import { useRef, useState } from 'react';
import { CircleCheck, Download, LoaderCircle, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BASE_PATH } from '@/lib/constants';
import { fileNameFrom } from '@/lib/term-sheet-export';

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'done' } | { kind: 'error'; message: string };

/** Mais do que o prazo da rota do gestor (45 s): é ela que responde com a frase certa quando o motor demora. */
const CLIENT_TIMEOUT_MS = 60_000;

/**
 * Descarrega o PDF da pauta, da pauta da turma ou do resultado de uma prova pela rota do gestor (`/api/pautas/{id}/pdf`):
 * o browser nunca fala com o motor. O PDF passa pela memória só o tempo de o entregar ao browser e não fica guardado.
 */
export function ExportPdfButton({
  sheetId,
  assessmentId,
  classSheet = false,
  label = 'Exportar PDF',
  accessibleName,
  provisional = false,
  disabledReason = null,
  size = 'sm',
}: {
  sheetId: string;
  assessmentId?: number;
  /** A pauta da turma é o relatório de todas as disciplinas (kixi#627), não a mini-pauta desta disciplina. */
  classSheet?: boolean;
  label?: string;
  /** O nome para o leitor de ecrã quando há vários botões iguais na página («Exportar PDF da pauta de Redes…»). */
  accessibleName?: string;
  provisional?: boolean;
  disabledReason?: string | null;
  size?: 'sm' | 'default';
}) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const busy = useRef(false);

  async function download() {
    if (busy.current) return;
    busy.current = true;
    setState({ kind: 'loading' });
    try {
      const query = classSheet ? '?tipo=class' : assessmentId === undefined ? '' : `?prova=${assessmentId}`;
      const res = await fetch(`${BASE_PATH}/api/pautas/${encodeURIComponent(sheetId)}/pdf${query}`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(CLIENT_TIMEOUT_MS),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
        const message = typeof body?.error === 'string' ? body.error : 'Não foi possível exportar o PDF. Tente novamente.';
        setState({ kind: 'error', message });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileNameFrom(res.headers.get('content-disposition'), 'pauta.pdf');
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      // O browser já tem o ficheiro: a cópia em memória larga-se logo a seguir.
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      setState({ kind: 'done' });
    } catch (err) {
      const timedOut = err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError');
      setState({ kind: 'error', message: timedOut ? 'O PDF demorou demasiado a chegar. Tente novamente.' : 'Não foi possível contactar o servidor. Tente novamente.' });
    } finally {
      busy.current = false;
    }
  }

  const loading = state.kind === 'loading';
  const reasonId = `pdf-motivo-${sheetId}-${classSheet ? 'turma' : assessmentId ?? 'pauta'}`;
  return (
    <div className="flex flex-col items-start gap-1" data-testid="exportar-pdf">
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => void download()}
        disabled={loading || Boolean(disabledReason)}
        aria-busy={loading}
        aria-label={accessibleName}
        aria-describedby={disabledReason ? reasonId : undefined}
        title={disabledReason ?? (provisional ? 'A pauta ainda não está homologada: o PDF sai como provisório.' : undefined)}
      >
        {loading ? <LoaderCircle className="animate-spin" aria-hidden /> : <Download aria-hidden />}
        {loading ? 'A gerar…' : label}
      </Button>
      <p className="min-h-4 text-xs" role="status" aria-live="polite">
        {disabledReason ? (
          <span id={reasonId} className="text-muted-foreground">{disabledReason}</span>
        ) : state.kind === 'done' ? (
          <span className="inline-flex items-center gap-1 text-success"><CircleCheck className="size-3.5" aria-hidden />PDF descarregado{provisional ? ' (provisório)' : ''}.</span>
        ) : state.kind === 'error' ? (
          <span className="inline-flex items-center gap-1 text-destructive"><TriangleAlert className="size-3.5" aria-hidden />{state.message}</span>
        ) : provisional ? (
          <span className="text-muted-foreground">Provisória: ainda não homologada.</span>
        ) : null}
      </p>
    </div>
  );
}
