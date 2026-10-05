'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { question, questionCells } from '@/lib/data';

const CELL = {
  done: 'border-transparent bg-accent text-accent-foreground',
  flag: 'border-transparent bg-warning-soft text-warning',
  empty: 'bg-card text-muted-foreground',
} as const;

export default function SalaProva() {
  const [sel, setSel] = useState<number | undefined>();
  const [flag, setFlag] = useState(false);
  const cells = questionCells.map((c, i) => (i === question.number - 1 ? (flag ? 'flag' : sel !== undefined ? 'done' : c) : c));

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b bg-card px-4 py-2.5 md:px-5">
        <Button asChild variant="ghost" size="icon" aria-label="Sair da prova"><Link href="/provas"><ChevronLeft /></Link></Button>
        <div className="min-w-0 leading-tight"><div className="truncate text-[15px] font-bold">P1 · Redes de Computadores</div><div className="text-xs text-muted-foreground">ITEL 2024 · simulação</div></div>
        <div className="ml-auto flex items-center gap-2 text-lg font-bold" role="timer" aria-label="Tempo restante"><Clock className="size-[18px]" /><span className="tabular-nums">42:10</span><small className="hidden text-xs font-semibold text-muted-foreground sm:inline">+25% de tempo</small></div>
        <Button asChild variant="outline" size="sm"><Link href="/resultado">Entregar</Link></Button>
      </header>

      <div className="mx-auto grid w-full max-w-[1040px] flex-1 items-start gap-6 p-4 md:grid-cols-[minmax(0,1fr)_280px] md:p-6">
        <Card className="gap-5 p-5 md:p-6" aria-labelledby="q-text">
          <div className="flex justify-between gap-3 text-[13px] font-semibold text-muted-foreground"><span>Questão {question.number} de {question.total}</span><span>{question.points} valores</span></div>
          <p id="q-text" className="max-w-[60ch] text-[17px] leading-relaxed md:text-[19px]">{question.text}</p>
          <fieldset className="grid gap-2.5" aria-label="Respostas">
            {question.options.map((text, i) => (
              <label key={text} className="relative flex min-h-14 cursor-pointer items-center gap-3.5 rounded-lg border border-input bg-card px-4 py-3 text-base transition-colors hover:bg-secondary has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40">
                <input className="peer sr-only" type="radio" name="resp" checked={sel === i} onChange={() => setSel(i)} />
                <span className="grid size-7 shrink-0 place-items-center rounded-full border-[1.5px] border-input text-[13px] font-bold text-muted-foreground peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">{'ABCD'[i]}</span>
                <span className="tabular-nums">{text}</span>
              </label>
            ))}
          </fieldset>
          {sel !== undefined && <p className="text-sm text-muted-foreground" role="status">Resposta guardada. Podes mudá-la até entregares a prova.</p>}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="outline"><ChevronLeft />Anterior</Button>
            <Button variant="ghost" className="text-primary" aria-pressed={flag} onClick={() => setFlag((f) => !f)}><Flag />{flag ? 'Marcada para rever' : 'Marcar para rever'}</Button>
            <span className="flex-1" />
            <Button>Seguinte<ChevronRight /></Button>
          </div>
        </Card>

        <Card className="gap-4" aria-label="Questões">
          <CardHeader><CardTitle>Questões</CardTitle></CardHeader>
          <CardContent className="grid gap-3.5">
            <div className="grid grid-cols-6 gap-2">
              {cells.map((s, i) => (
                <button key={i} type="button" aria-current={i === question.number - 1} aria-label={`Questão ${i + 1}${s === 'done' ? ', respondida' : s === 'flag' ? ', marcada' : ''}`} className={cn('grid aspect-square place-items-center rounded-md border text-[13px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 aria-[current=true]:outline-2 aria-[current=true]:outline-offset-1 aria-[current=true]:outline-primary', CELL[s])}>{i + 1}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-xs text-muted-foreground">
              {([['done', 'Respondida'], ['flag', 'Para rever'], ['empty', 'Por responder']] as const).map(([k, l]) => <span key={k} className="inline-flex items-center gap-1.5"><i className={cn('inline-block size-2.5 rounded-[3px] border', CELL[k])} />{l}</span>)}
            </div>
            <p className="text-[13px] text-muted-foreground">{cells.filter((c) => c === 'done').length} de {question.total} respondidas</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
