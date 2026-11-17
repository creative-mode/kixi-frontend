'use client';

import { useState, FormEvent } from 'react';
import { AlertCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { pedirRevisaoAction } from '@/lib/review-actions';
import { cn } from '@/lib/utils';

interface PedirRevisaoProps {
  simulationId: number;
  questionId: number;
  questionNumber: string | number;
}

export function PedirRevisaoButton({ simulationId, questionId, questionNumber }: PedirRevisaoProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [motivo, setMotivo] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

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
      setTimeout(() => {
        setIsOpen(false);
        setStatus('idle');
        setMessage('');
      }, 3000);
    } else {
      setStatus('error');
      setMessage(result.message);
    }
  };

  return (
    <div className="pl-[46px]">
      {!isOpen && status === 'idle' ? (
        <Button
          variant="outline"
          size="sm"
          className="text-xs gap-1.5 border-destructive/50 text-destructive hover:bg-destructive/10"
          onClick={() => setIsOpen(true)}
        >
          <AlertCircle className="size-3.5" aria-hidden />
          Não concordo com esta correcção
        </Button>
      ) : (
        <form onSubmit={handleSubmit} className="grid gap-2">
          <Textarea
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Explica por que não concordas com a correcção da IA..."
            rows={3}
            className="text-sm"
            disabled={status === 'loading'}
            required
            aria-label="Motivo do pedido de revisão"
          />
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              size="sm"
              disabled={status === 'loading' || !motivo.trim()}
              className="gap-1.5"
            >
              {status === 'loading' ? (
                <>
                  <svg className="animate-spin size-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
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
              <Button type="button" variant="ghost" size="sm" onClick={() => { setIsOpen(false); setStatus('idle'); setMessage(''); }}>
                Cancelar
              </Button>
            )}
          </div>
          {message && (
            <p className={cn('text-xs', status === 'success' ? 'text-green-700' : 'text-destructive')}>
              {message}
            </p>
          )}
        </form>
      )}
    </div>
  );
}