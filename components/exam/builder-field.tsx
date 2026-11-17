import type { ReactNode } from 'react';

/** O `<label>` envolve o controlo em vez de ser irmão: um label que envolve o `<select>` associa-lhe o nome sem `htmlFor` nem ids. A tipografia vai no texto, não no wrapper. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium leading-none">{label}</span>
      {children}
    </label>
  );
}
