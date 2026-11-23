'use client';

import { useState, FormEvent, useRef } from 'react';
import { AlertCircle, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { pedirRevisaoAction } from '@/lib/review-actions';
import { cn } from '@/lib/utils';

interface PedirRevisaoProps {
  simulationId: number;
  questionId: number;
}

// Feature flag: o endpoint POST /simulations/{id}/review ainda não existe no backend
// (kixi#798 Fase 2). O botão só aparece quando o backend estiver pronto, para o aluno
// não ver "Não encontrámos o que procuravas". Activar com NEXT_PUBLIC_REVISOES_ATIVAS=1.
export const REVISOES_ATIVAS = process.env.NEXT_PUBLIC_REVISOES_ATIVAS === '1';

const MAX_MOTIVO_LENGTH = 1000; // TODO: alinhar com contrato backend

export function PedirRevisaoButton({ simulationId, questionId }: PedirRevisaoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // IDs únicos por questão: várias questões abertas na mesma página não colidem.
  const formId = `revisao-form-${questionId}`;
  const hintId = `revisao-hint-${questionId}`;
  const messageId = `revisao-msg-${questionId}`;

  const openForm = () => {
    previousActiveElement.current = document.activeElement as HTMLElement;
    setIsOpen(true);
    setStatus('idle');
    setMessage('');
    // Focus textarea after render
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const closeForm = () => {
    setIsOpen(false);
    setStatus('idle');
    setMessage('');
    setMotivo('');
    // Return focus to trigger button
    previousActiveElement.current?.focus();
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!motivo.trim()) return;

    setStatus('loading');
    setMessage('');

    const result = await pedirRevisaoAction(simulationId, questionId, motivo);

    if (result.ok) {
      setStatus('success');
      setMessage(result.message);
      setMotivo('');
    } else {
      setStatus('error');
      setMessage(result.message);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      closeForm();
    }
  };

  // Sem backend pronto, o botão não aparece (não há endpoint que responda).
  if (!REVISOES_ATIVAS) return null;

  // Depois de enviar, mostra o estado "já pediste" e deixa fechar.
  if (status === 'success') {
    return (
      <div
        id={messageId}
        role="status"
        aria-live="polite"
        className="flex items-start gap-2 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-xs text-success"
      >
        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <b>Pedido enviado.</b> {message}
        </span>
        <button
          type="button"
          onClick={closeForm}
          className="shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold hover:bg-success/20"
          aria-label="Fechar confirmação"
        >
          Fechar
        </button>
      </div>
    );
  }

  return (
    <div className="pl-[46px]">
      {!isOpen ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10 min-h-[44px] min-w-[44px]"
          onClick={openForm}
          aria-expanded={false}
          aria-controls={formId}
          aria-label="Pedir revisão desta correcção"
        >
          <AlertCircle className="size-3.5" aria-hidden />
          Não concordo com esta correcção
        </Button>
      ) : (
        <form
          id={formId}
          onSubmit={handleSubmit}
          onKeyDown={handleKeyDown}
          className="grid gap-2"
        >
          <Textarea
            ref={textareaRef}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explica por que não concordas com a correcção da IA..."
            rows={3}
            className="text-sm"
            disabled={status === 'loading'}
            required
            maxLength={MAX_MOTIVO_LENGTH}
            aria-label="Motivo do pedido de revisão"
            aria-describedby={hintId}
          />
          <p id={hintId} className="text-xs text-muted-foreground">
            Máximo {MAX_MOTIVO_LENGTH} caracteres.
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={status === 'loading' || !motivo.trim()}
              className="gap-1.5 min-h-[44px]"
            >
              {status === 'loading' ? (
                <>
                  <svg className="animate-spin size-3.5" viewBox="0 0 24 24" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  A enviar...
                </>
              ) : (
                <>
                  <Send className="size-3.5" aria-hidden />
                  Enviar pedido
                </>
              )}
            </Button>
            {status !== 'loading' && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeForm}
                className="min-h-[44px]"
              >
                Cancelar
              </Button>
            )}
          </div>
          {message && status === 'error' && (
            <p
              id={messageId}
              className={cn('text-xs', 'text-destructive')}
              role="alert"
              aria-live="assertive"
            >
              {message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}