'use client';

import { Button } from '@/components/ui/button';
import { nextTabIndex } from '@/lib/queue-state';

export interface FilterTab<K extends string> {
  key: K;
  label: string;
  /** `null` enquanto a lista não chegou: o separador mostra só o nome, não um zero a fingir que há dados. */
  count: number | null;
}

const tabId = (group: string, key: string) => `${group}-separador-${key}`;

/** Os atributos do painel que os separadores controlam: ligam-se pelo `group` e pelo separador ativo. */
export function filterPanelProps(group: string, active: string) {
  return { id: `${group}-painel`, role: 'tabpanel' as const, 'aria-labelledby': tabId(group, active) };
}

/**
 * Filtros de uma fila como `tablist` (padrão WAI-ARIA): só o separador ativo entra na ordem do Tab, as setas
 * andam pelos outros (e ativam-nos, porque filtrar é barato), Home e End vão às pontas. Cada um diz quantos tem.
 * O painel que mostra o resultado leva `filterPanelProps`.
 */
export function FilterTabs<K extends string>({
  group,
  label,
  tabs,
  value,
  onChange,
}: {
  group: string;
  label: string;
  tabs: FilterTab<K>[];
  value: K;
  onChange: (key: K) => void;
}) {
  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const target = nextTabIndex(event.key, index, tabs.length);
    if (target === null) return;
    event.preventDefault();
    const next = tabs[target]!.key;
    onChange(next);
    document.getElementById(tabId(group, next))?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="mb-4 flex flex-wrap gap-2">
      {tabs.map((tab, index) => {
        const selected = tab.key === value;
        return (
          <Button
            key={tab.key}
            id={tabId(group, tab.key)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${group}-painel`}
            tabIndex={selected ? 0 : -1}
            size="sm"
            variant={selected ? 'default' : 'outline'}
            onClick={() => onChange(tab.key)}
            onKeyDown={(event) => onKeyDown(event, index)}
          >
            {tab.label}{tab.count !== null ? ` (${tab.count})` : ''}
          </Button>
        );
      })}
    </div>
  );
}
