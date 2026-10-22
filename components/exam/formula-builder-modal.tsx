'use client';

import { createElement, useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, Sigma } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { MathText } from '@/student/lib/shared/math-text';

type FormulaCategory = 'básicos' | 'álgebra' | 'cálculo' | 'símbolos';

type FormulaTemplate = {
  id: string;
  label: string;
  category: FormulaCategory;
  latex: string;
  preview: string;
  displayDefault?: boolean;
};

const TEMPLATES: FormulaTemplate[] = [
  { id: 'fraction', label: 'Fração', category: 'básicos', latex: '\\frac{a}{b}', preview: '\\frac{a}{b}' },
  { id: 'power', label: 'Potência', category: 'básicos', latex: 'x^{n}', preview: 'x^{n}' },
  { id: 'subscript', label: 'Índice', category: 'básicos', latex: 'x_{i}', preview: 'x_{i}' },
  { id: 'root', label: 'Raiz', category: 'básicos', latex: '\\sqrt{x}', preview: '\\sqrt{x}' },
  { id: 'absolute', label: 'Valor absoluto', category: 'básicos', latex: '\\left|x\\right|', preview: '|x|' },
  { id: 'system', label: 'Sistema', category: 'álgebra', latex: '\\begin{cases}x+y=1\\\\x-y=0\\end{cases}', preview: '\\begin{cases}x+y=1\\\\x-y=0\\end{cases}', displayDefault: true },
  { id: 'vector', label: 'Vetor', category: 'álgebra', latex: '\\vec{v}', preview: '\\vec{v}' },
  { id: 'matrix', label: 'Matriz', category: 'álgebra', latex: '\\begin{pmatrix}a & b\\\\c & d\\end{pmatrix}', preview: '\\begin{pmatrix}a & b\\\\c & d\\end{pmatrix}', displayDefault: true },
  { id: 'integral', label: 'Integral', category: 'cálculo', latex: '\\int_{a}^{b} f(x)\\,dx', preview: '\\int_{a}^{b} f(x)\\,dx', displayDefault: true },
  { id: 'sum', label: 'Somatório', category: 'cálculo', latex: '\\sum_{i=1}^{n} x_i', preview: '\\sum_{i=1}^{n} x_i', displayDefault: true },
  { id: 'limit', label: 'Limite', category: 'cálculo', latex: '\\lim_{x\\to 0} f(x)', preview: '\\lim_{x\\to 0} f(x)', displayDefault: true },
  { id: 'alpha', label: 'Alfa', category: 'símbolos', latex: '\\alpha', preview: '\\alpha' },
  { id: 'pi', label: 'Pi', category: 'símbolos', latex: '\\pi', preview: '\\pi' },
  { id: 'infinity', label: 'Infinito', category: 'símbolos', latex: '\\infty', preview: '\\infty' },
  { id: 'less-equal', label: 'Menor ou igual', category: 'símbolos', latex: '\\leq', preview: '\\leq' },
  { id: 'not-equal', label: 'Diferente', category: 'símbolos', latex: '\\neq', preview: '\\neq' },
  { id: 'rightarrow', label: 'Seta', category: 'símbolos', latex: '\\rightarrow', preview: '\\rightarrow' },
];

const QUICK_TEMPLATES = TEMPLATES.filter((template) =>
  ['fraction', 'power', 'root', 'system', 'vector', 'matrix', 'integral'].includes(template.id),
);

type MathfieldElementLike = HTMLElement & {
  value: string;
  mathVirtualKeyboardPolicy: 'auto' | 'manual' | 'sandboxed';
  smartMode: boolean;
  smartFence: boolean;
  setValue: (value: string, options?: { silenceNotifications?: boolean }) => void;
  focus: () => void;
};

function MathLiveField({
  value,
  onChange,
  keyboardContainer,
}: {
  value: string;
  onChange: (value: string) => void;
  keyboardContainer: { current: HTMLDivElement | null };
}) {
  const field = useRef<MathfieldElementLike | null>(null);
  const initialValue = useRef(value);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    import('mathlive').then(() => {
      if (!active || !field.current) return;
      const mathVirtualKeyboard = window.mathVirtualKeyboard;
      field.current.value = initialValue.current;
      field.current.mathVirtualKeyboardPolicy = 'manual';
      field.current.smartMode = true;
      field.current.smartFence = true;
      mathVirtualKeyboard.layouts = ['numeric', 'symbols', 'alphabetic', 'greek'];
      mathVirtualKeyboard.container = keyboardContainer.current;
      setReady(true);
      field.current.focus();
    });
    return () => {
      active = false;
      if (typeof window !== 'undefined' && window.mathVirtualKeyboard) {
        window.mathVirtualKeyboard.visible = false;
      }
    };
  }, [keyboardContainer]);

  useEffect(() => {
    if (ready && field.current && field.current.value !== value) {
      field.current.setValue(value, { silenceNotifications: true });
    }
  }, [ready, value]);

  return createElement('math-field', {
    ref: (element: MathfieldElementLike | null) => {
      field.current = element;
    },
    className: 'formula-mathfield',
    'aria-label': 'Editor visual de fórmula',
    onFocus: () => window.mathVirtualKeyboard.show(),
    onInput: (event: FormEvent<HTMLElement>) => {
      onChange((event.currentTarget as MathfieldElementLike).value);
    },
  });
}

export function FormulaBuilderModal({
  open,
  onOpenChange,
  onInsert,
  initialFormula,
  initialDisplay,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (latex: string, display: boolean) => void;
  initialFormula?: string;
  initialDisplay?: boolean;
}) {
  const [formula, setFormula] = useState(initialFormula ?? '');
  const [display, setDisplay] = useState(initialDisplay ?? false);
  const keyboardContainer = useRef<HTMLDivElement>(null);

  function chooseTemplate(template: FormulaTemplate) {
    setFormula(template.latex);
    setDisplay(template.displayDefault ?? false);
  }

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="grid max-h-[calc(100dvh-2rem)] max-w-4xl grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0"
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onFocusOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => event.preventDefault()}
      >
        <DialogHeader className="border-b bg-muted/30 px-6 py-4 pr-12">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
                <Sigma size={21} aria-hidden />
              </span>
              <div>
                <DialogTitle>Inserir fórmula</DialogTitle>
                <DialogDescription>Edite a fórmula directamente e encaixe estruturas umas dentro das outras.</DialogDescription>
              </div>
            </div>
            <Button type="button" size="sm" aria-label="Inserir fórmula" disabled={!formula.trim()} onClick={() => onInsert(formula, display)}>
              Inserir
            </Button>
          </div>
        </DialogHeader>

        <div className="min-h-0 min-w-0 overflow-y-auto p-5 sm:p-6">
            <div className="mb-4">
              <p className="text-xs font-medium text-muted-foreground">Atalhos rápidos</p>
              <p className="mt-1 text-xs text-muted-foreground">Comece com um modelo ou escreva directamente no editor.</p>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5" aria-label="Modelos de fórmula">
              {QUICK_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  aria-label={`Inserir modelo ${template.label}`}
                  className="grid min-h-16 place-items-center gap-1 rounded-lg border bg-background px-2 py-2 text-center transition-colors hover:border-primary/60 hover:bg-accent"
                  onClick={() => chooseTemplate(template)}
                >
                  <span className="max-w-full overflow-hidden text-foreground [&_.katex]:text-base"><MathText text={`$${template.preview}$`} /></span>
                  <span className="text-[11px] text-muted-foreground">{template.label}</span>
                </button>
              ))}
            </div>

            <section className="mt-6 rounded-xl border bg-card p-4" aria-labelledby="mathlive-editor-title">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 id="mathlive-editor-title" className="text-sm font-semibold">Área de edição</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Clique dentro da fórmula para mover o cursor e inserir estruturas no ponto certo.</p>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" checked={display} onChange={(event) => setDisplay(event.target.checked)} />
                  Fórmula destacada
                </label>
              </div>
              <div className="mt-4 rounded-lg border bg-background p-3">
                <MathLiveField value={formula} onChange={setFormula} keyboardContainer={keyboardContainer} />
                <div ref={keyboardContainer} className="formula-keyboard-host mt-3 min-h-56 overflow-x-auto rounded-lg" aria-label="Teclado virtual da fórmula" />
              </div>
            </section>
        </div>

        <DialogFooter className="border-t bg-muted/20 px-6 py-4">
          <Button type="button" disabled={!formula.trim()} onClick={() => onInsert(formula, display)}>
            <Check size={16} aria-hidden />
            Inserir fórmula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
