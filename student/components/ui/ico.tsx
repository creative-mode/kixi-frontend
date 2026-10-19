import type { SVGProps } from 'react';

/**
 * O conjunto de ícones do Kixi: formas simples, traço uniforme de 2 px, sem pormenores por dentro.
 * Cada um tem a versão de contorno e a preenchida, que se usa quando está seleccionado ou activo.
 */
type Shape = { body: string; fillable?: boolean; extra?: string };

const SHAPES = {
  home: { body: 'M4 11 12 4l8 7v9H4z', fillable: true },
  file: { body: 'M6 3h8l4 4v14H6z', fillable: true },
  trophy: { body: 'M7 4h10v5a5 5 0 0 1-10 0z', fillable: true, extra: 'M12 14v5M8 20h8' },
  chat: { body: 'M4 5h16v11H10l-6 4z', fillable: true },
  user: { body: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4.4 3.6-7 8-7s8 2.6 8 7z', fillable: true },
  search: { body: 'M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', extra: 'M15 15l5 5' },
  heart: { body: 'M12 20S4 15.5 4 9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.5 12 20 12 20z', fillable: true },
  flag: { body: 'M6 4h12l-2 4 2 4H6z', fillable: true, extra: 'M6 4v17' },
  send: { body: 'M3 11 21 3l-8 18-2-8z', fillable: true },
  userPlus: { body: 'M10 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5z', fillable: true, extra: 'M19 5v6M16 8h6' },
  userCheck: { body: 'M10 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM3 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5z', fillable: true, extra: 'M16 9l2 2 4-4' },
  clock: { body: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', fillable: true, extra: 'M12 8v4l3 2' },
  check: { body: 'M5 12l5 5 9-10' },
  x: { body: 'M6 6l12 12M18 6 6 18' },
  logout: { body: 'M10 4H5v16h5', extra: 'M15 8l4 4-4 4M19 12H9' },
  bookmark: { body: 'M6 3h12v18l-6-5-6 5z', fillable: true },
  building: { body: 'M5 21V4h10v17z', fillable: true, extra: 'M15 10h4v11' },
  calendar: { body: 'M4 6h16v14H4z', fillable: true, extra: 'M4 10h16M8 3v4M16 3v4' },
  award: { body: 'M12 3a6 6 0 1 0 0 12 6 6 0 0 0 0-12z', fillable: true, extra: 'M9 15l-1 6 4-2 4 2-1-6' },
  flame: { body: 'M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z', fillable: true },
  school: { body: 'M3 9l9-5 9 5-9 5z', fillable: true, extra: 'M7 12v5c3 2 7 2 10 0v-5' },
  chevron: { body: 'M9 5l7 7-7 7' },
  more: { body: 'M5 12h.01M12 12h.01M19 12h.01' },
  settings: { body: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', fillable: true, extra: 'M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2' },
  lock: { body: 'M6 11h12v9H6z', fillable: true, extra: 'M8 11V8a4 4 0 0 1 8 0v3' },
  users: { body: 'M9 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5z', fillable: true, extra: 'M17 6a3 3 0 0 1 0 6M19 15c2 .8 3 2.4 3 5' },
} satisfies Record<string, Shape>;

export type IcoName = keyof typeof SHAPES;

export function Ico({ name, filled = false, size = 24, className, ...rest }: { name: IcoName; filled?: boolean; size?: number } & Omit<SVGProps<SVGSVGElement>, 'name'>) {
  const s: Shape = SHAPES[name];
  const solid = filled && s.fillable;
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      <path d={s.body} fill={solid ? 'currentColor' : 'none'} />
      {s.extra && <path d={s.extra} />}
    </svg>
  );
}
