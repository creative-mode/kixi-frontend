/** A legenda dos atalhos de uma página: o que se carrega e o que faz, em texto, para quem não os vê anunciados. */
export function ShortcutsHint({ items }: { items: { keys: string[]; label: string }[] }) {
  return (
    <p className="text-xs text-muted-foreground print:hidden">
      <span className="font-medium">Atalhos:</span>{' '}
      {items.map((item, index) => (
        <span key={item.label}>
          {index > 0 ? ' · ' : ''}
          {item.keys.map((key, i) => (
            <span key={key}>
              {i > 0 ? ' / ' : ''}
              <kbd className="rounded border bg-muted px-1 font-mono text-[11px] text-foreground">{key}</kbd>
            </span>
          ))}{' '}
          {item.label}
        </span>
      ))}
      . Não funcionam enquanto se escreve num campo.
    </p>
  );
}
