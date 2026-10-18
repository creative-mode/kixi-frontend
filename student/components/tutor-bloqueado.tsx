'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { registarEventoAction } from '@/lib/exam-actions';

/**
 * O tutor fechado enquanto a prova corre (#192).
 *
 * Quem fecha é o servidor — `tutor/page.tsx` já não renderiza a conversa — e este
 * ecrã é o que o aluno vê no lugar dela, com o caminho de volta. A tentativa de
 * navegação regista-se uma vez: é o sinal que o professor quer ver, e não uma
 * acusação (o aluno pode ter chegado aqui por um link antigo).
 */
export function TutorBloqueado({
  simulationId,
  statementId,
  paperTitle,
}: {
  simulationId: number;
  statementId: number;
  paperTitle: string | null;
}) {
  // Uma vez por montagem: o `reactStrictMode` monta duas vezes em desenvolvimento, e
  // duas linhas para a mesma tentativa de navegação seriam ruído no ecrã do professor.
  const recorded = useRef(false);
  useEffect(() => {
    if (recorded.current) return;
    recorded.current = true;
    void registarEventoAction({ simulationId, kind: 'TUTOR_BLOCKED' });
  }, [simulationId]);

  return (
    <div className="mx-auto grid min-h-[60vh] max-w-[560px] place-items-center p-6">
      <Card className="gap-4 p-6 text-center" role="alert" aria-labelledby="tutor-fechado">
        <Lock className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <h1 id="tutor-fechado" className="text-lg font-bold">O tutor está fechado durante a prova</h1>
        <p className="text-sm text-muted-foreground">
          {paperTitle ? `Tens uma tentativa a decorrer em “${paperTitle}”. ` : ''}
          O tutor reabre quando entregares a prova ou o tempo terminar.
        </p>
        <Button asChild className="justify-self-center">
          <Link href={`/prova/${statementId}`}>Voltar à prova</Link>
        </Button>
      </Card>
    </div>
  );
}
