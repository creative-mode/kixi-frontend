/** Pixel sprites for the landing: drawn from ASCII rows, rendered as crisp SVG in currentColor. */
const SPRITES = {
  fly: [
    '#.......#',
    '.#.###.#.',
    '..#####..',
    '.#.###.#.',
    '#.......#',
  ],
  moth: [
    '.##....##.',
    '####..####',
    '##########',
    '##########',
    '.########.',
    '..######..',
    '...####...',
    '....##....',
  ],
  ship: [
    '......#......',
    '.....###.....',
    '.....###.....',
    '....#####....',
    '.#..#####..#.',
    '.##.#####.##.',
    '.###########.',
    '####.###.####',
    '##...###...##',
    '#....#.#....#',
  ],
} as const;

export type SpriteKind = keyof typeof SPRITES;

const PATHS = Object.fromEntries(
  (Object.keys(SPRITES) as SpriteKind[]).map((k) => {
    const rows = SPRITES[k];
    let d = '';
    rows.forEach((row, y) => {
      for (const m of row.matchAll(/#+/g)) d += `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`;
    });
    return [k, { d, w: rows[0].length, h: rows.length }];
  }),
) as Record<SpriteKind, { d: string; w: number; h: number }>;

export function Sprite({ kind = 'moth', width = 44, className }: { kind?: SpriteKind; width?: number; className?: string }) {
  const s = PATHS[kind];
  return (
    <svg viewBox={`0 0 ${s.w} ${s.h}`} width={width} height={Math.round((width * s.h) / s.w)} shapeRendering="crispEdges" aria-hidden="true" className={className}>
      <path fill="currentColor" d={s.d} />
    </svg>
  );
}

export const Bug = ({ className, width = 44 }: { className?: string; width?: number }) => (
  <Sprite kind="moth" className={className} width={width} />
);
