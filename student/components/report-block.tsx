'use client';

import { useState, useTransition } from 'react';
import { Flag, ShieldOff } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { REPORT_REASONS, REPORT_REASON_KEYS, exigeNota, type ReportTarget } from '@/lib/moderation';

export interface ReportBlockProps {
  target: ReportTarget;
  targetId: number;
  /** Quem é o alvo, para o texto não dizer «esta publicação» quando é uma pessoa. */
  nome: string;
  /** Só aparece quando o alvo é uma pessoa. */
  accountId?: number;
  podeBloquear?: boolean;
  onReport: (reason: string, note: string) => Promise<{ ok?: boolean; error?: string }>;
  onBlock?: () => Promise<{ blocked?: boolean; error?: string }>;
}

/**
 * Denunciar e bloquear (#323).
 *
 * Reutiliza a forma do `post-card` — um botão que abre um formulário por baixo — em vez
 * de um diálogo: é o registo que o aluno já conhece, e um `role="dialog"` traria um
 * novo padrão de foco para testar sem necessidade.
 *
 * O motivo é lista fechada com nota opcional: permite triar e contar quantas denúncias
 * há de cada tipo, coisa que o texto livre das publicações não permite.
 */
export function ReportBlock({ target, targetId, nome, accountId, podeBloquear = false, onReport, onBlock }: ReportBlockProps) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [nota, setNota] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aTratar, iniciar] = useTransition();

  const alvo = target === 'ACCOUNT' ? 'esta pessoa' : 'esta escola';
  const precisaDeNota = motivo !== '' && exigeNota(motivo as never);
  const podeEnviar = motivo !== '' && (!precisaDeNota || nota.trim().length > 0) && !aTratar;

  function enviar() {
    setErro(null);
    iniciar(async () => {
      const r = await onReport(motivo, nota);
      if (r.ok) {
        setEnviado(true);
        setAberto(false);
      } else {
        setErro(r.error ?? 'Não foi possível enviar a denúncia.');
      }
    });
  }

  function alternarBloqueio() {
    setErro(null);
    iniciar(async () => {
      const r = await onBlock?.();
      if (r?.error) setErro(r.error);
      else if (typeof r?.blocked === 'boolean') setBloqueado(r.blocked);
    });
  }

  return (
    <div className="grid gap-2">
      {/* Depois de denunciar, o botão de bloquear tem de continuar a estar lá: quem
          denuncia alguém muitas vezes quer também deixar de o ver. Este componente
          devolvia só o alerta e levava o botão com ele. */}
      {enviado && <Alert variant="success">Denúncia enviada. A equipa da Kixi vai rever.</Alert>}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button" variant="ghost" size="sm" className="text-muted-foreground"
          aria-expanded={aberto} onClick={() => setAberto((v) => !v)}
        >
          <Flag aria-hidden />Denunciar {alvo}
        </Button>
        {podeBloquear && accountId !== undefined && onBlock && (
          <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" onClick={alternarBloqueio} disabled={aTratar}>
            <ShieldOff aria-hidden />{bloqueado ? `Deixar de bloquear ${nome}` : `Bloquear ${nome}`}
          </Button>
        )}
      </div>

      {erro && <Alert variant="destructive">{erro}</Alert>}

      {aberto && (
        <div className="grid gap-2 rounded-lg border p-3">
          <NativeSelect
            value={motivo} onChange={(e) => setMotivo(e.target.value)}
            aria-label="Motivo da denúncia" autoFocus
          >
            <option value="">Escolhe um motivo</option>
            {REPORT_REASON_KEYS.filter((k) => k !== 'BLOCK' || podeBloquear).map((k) => (
              <option key={k} value={k}>{REPORT_REASONS[k]}</option>
            ))}
          </NativeSelect>
          <Textarea
            value={nota} onChange={(e) => setNota(e.target.value)} rows={2}
            placeholder={precisaDeNota ? 'Conta o que viste' : 'Mais contexto (opcional)'}
            aria-label={precisaDeNota ? 'Porque estás a denunciar' : 'Contexto da denúncia (opcional)'}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button type="submit" size="sm" variant="destructive" disabled={!podeEnviar} onClick={enviar} data-testid={`aluno-denunciar-${target}-submeter`}>
              {aTratar ? 'A enviar…' : 'Denunciar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}