'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

const SNIPPETS = [
  { label: 'Fração', latex: '\\frac{a}{b}' },
  { label: 'Raiz', latex: '\\sqrt{x}' },
  { label: 'Expoente', latex: 'x^{2}' },
  { label: 'Índice', latex: 'v_{0}' },
  { label: 'Vetor', latex: '\\vec{v}' },
  { label: 'Sistema', latex: '\\begin{cases}x+y=1\\\\x-y=0\\end{cases}' },
  { label: 'Integral', latex: '\\int_{a}^{b} f(x)\\,dx' },
  { label: 'Somatório', latex: '\\sum_{i=1}^{n} x_i' },
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

  function insert(latex: string) {
    const element = input.current;
    if (!element) return;
    const start = element.selectionStart;
    const end = element.selectionEnd;
    const token = displayMode ? `$$\n${latex}\n$$` : `$${latex}$`;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      element.focus();
      const cursor = start + token.length;
      element.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="min-w-0 flex-1 space-y-1.5">
      <Textarea
        ref={input}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={className}
      />
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" aria-expanded={toolsOpen} onClick={() => setToolsOpen((current) => !current)}>
          {toolsOpen ? 'Fechar fórmulas' : 'Inserir fórmula'}
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">LaTeX · pré-visualização automática</span>
      </div>
      {toolsOpen && <div className="flex flex-wrap gap-1" aria-label="Modelos de fórmula">
        <Button type="button" variant={displayMode ? 'default' : 'outline'} size="sm" className="h-7 px-2 text-xs" aria-pressed={displayMode} onClick={() => setDisplayMode((current) => !current)}>
          {displayMode ? 'Modo destacado' : 'Modo em linha'}
        </Button>
        {SNIPPETS.map((snippet) => (
          <Button key={snippet.label} type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => insert(snippet.latex)}>
            {snippet.label}
          </Button>
        ))}
      </div>}
    </div>
  );
}
