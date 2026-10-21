'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { hasMathContent } from '@/student/lib/shared/math-content';
import { MathText } from '@/student/lib/shared/math-text';

const SNIPPETS = [
  { label: 'Fração', latex: '\\frac{a}{b}', preview: '\\frac{a}{b}' },
  { label: 'Raiz quadrada', latex: '\\sqrt{x}', preview: '\\sqrt{x}' },
  { label: 'Expoente', latex: 'x^{2}', preview: 'x^{2}' },
  { label: 'Índice', latex: 'v_{0}', preview: 'v_{0}' },
  { label: 'Vetor', latex: '\\vec{v}', preview: '\\vec{v}' },
  { label: 'Sistema de equações', latex: '\\begin{cases}x+y=1\\\\x-y=0\\end{cases}', preview: '\\{' },
  { label: 'Integral', latex: '\\int_{a}^{b} f(x)\\,dx', preview: '\\int' },
  { label: 'Somatório', latex: '\\sum_{i=1}^{n} x_i', preview: '\\sum' },
];

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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState(false);
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

  function insert(latex: string) {
    const element = input.current;
    const start = element?.selectionStart ?? value.length;
    const end = element?.selectionEnd ?? value.length;
    const token = displayMode ? `$$\n${latex}\n$$` : `$${latex}$`;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(next);
    setSourceMode(false);
    setToolsOpen(false);
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
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" aria-expanded={toolsOpen} onClick={() => {
          setToolsOpen((current) => !current);
        }}>
          {toolsOpen ? 'Fechar fórmulas' : 'Inserir fórmula'}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">Escolha pelo símbolo; confira no enunciado</span>
      </div>
      {toolsOpen && <div className="grid min-w-0 grid-cols-2 gap-2" aria-label="Modelos de fórmula">
        <Button type="button" variant={displayMode ? 'default' : 'outline'} size="sm" className="col-span-full h-8 justify-self-start px-2 text-xs" aria-pressed={displayMode} onClick={() => setDisplayMode((current) => !current)}>
          {displayMode ? 'Modo destacado' : 'Modo em linha'}
        </Button>
        {SNIPPETS.map((snippet) => (
          <Button key={snippet.label} type="button" variant="outline" size="sm" className="h-auto min-h-14 w-full min-w-0 flex-col gap-1 overflow-hidden whitespace-normal px-2 py-2 text-xs" aria-label={`Inserir ${snippet.label}`} onClick={() => insert(snippet.latex)}>
            <span className="max-w-full break-words text-center leading-tight">{snippet.label}</span>
            <span aria-hidden="true" className="block max-w-full overflow-hidden text-foreground [&_.katex]:text-sm">
              <MathText text={`$${snippet.preview}$`} />
            </span>
          </Button>
        ))}
      </div>}
    </div>
  );
}
