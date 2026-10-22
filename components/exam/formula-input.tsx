'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { hasMathContent } from '@/student/lib/shared/math-content';
import { MathText } from '@/student/lib/shared/math-text';
import { FormulaBuilderModal } from './formula-builder-modal';

function selectedFormula(value: string, start: number, end: number): { latex: string; display: boolean } {
  const selection = value.slice(start, end);
  const matches = [
    { pattern: /^\$\$([\s\S]+)\$\$$/, display: true },
    { pattern: /^\\\[([\s\S]+)\\\]$/, display: true },
    { pattern: /^\$([\s\S]+)\$$/, display: false },
    { pattern: /^\\\(([\s\S]+)\\\)$/, display: false },
  ];
  const match = matches.find(({ pattern }) => pattern.test(selection));
  if (!match) return { latex: '', display: false };
  return { latex: selection.replace(match.pattern, '$1'), display: match.display };
}

/** Editor deliberadamente pequeno: texto continua editável e a fórmula é KaTeX, sem novo runtime. */
export function FormulaInput({
  value,
  onChange,
  label,
  className,
  rows = 2,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  className?: string;
  rows?: number;
  placeholder?: string;
}) {
  const input = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const [builderInitial, setBuilderInitial] = useState({ latex: '', display: false });
  const [builderOpen, setBuilderOpen] = useState(false);
  const [sourceMode, setSourceMode] = useState(false);
  const showRenderedMath = hasMathContent(value) && !sourceMode;

  function enterSourceMode() {
    setSourceMode(true);
    requestAnimationFrame(() => {
      const element = input.current;
      if (!element) return;
      element.focus();
      element.setSelectionRange(value.length, value.length);
    });
  }

  function openBuilder() {
    const element = input.current;
    selection.current = {
      start: element?.selectionStart ?? value.length,
      end: element?.selectionEnd ?? value.length,
    };
    setBuilderInitial(selectedFormula(value, selection.current.start, selection.current.end));
    setBuilderOpen(true);
  }

  function insert(latex: string, display: boolean) {
    const { start, end } = selection.current;
    const token = display ? `$$\n${latex}\n$$` : `$${latex}$`;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(next);
    setSourceMode(false);
    setBuilderOpen(false);
  }

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      {showRenderedMath ? (
        <div role="textbox" aria-label={label} aria-readonly="true" className={`min-h-14 w-full whitespace-pre-wrap break-words rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs ${className ?? ''}`}>
          <MathText text={value} className="whitespace-pre-wrap break-words" />
        </div>
      ) : (
        <Textarea
          ref={input}
          rows={rows}
          value={value}
          onChange={(event) => {
            setSourceMode(true);
            onChange(event.target.value);
          }}
          placeholder={placeholder}
          aria-label={label}
          className={className}
        />
      )}
      <div className="flex flex-wrap items-center gap-1">
        {hasMathContent(value) && (
          <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => {
            if (showRenderedMath) enterSourceMode();
            else setSourceMode(false);
          }}>
            {showRenderedMath ? 'Ajustar enunciado' : 'Ver fórmula renderizada'}
          </Button>
        )}
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={openBuilder}>
          Inserir fórmula
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">Construa visualmente; confira no enunciado</span>
      </div>
      <FormulaBuilderModal
        key={`${builderOpen}-${builderInitial.latex}-${builderInitial.display}`}
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        onInsert={insert}
        initialFormula={builderInitial.latex}
        initialDisplay={builderInitial.display}
      />
    </div>
  );
}
