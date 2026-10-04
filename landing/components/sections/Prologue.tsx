import { MARK_H, MARK_W, RETRO_MARK, RETRO_WORD, WORD_W } from '@/lib/mark';

/**
 * Prologue, drawn from scroll progress q (0..1):
 * the Kixi logo is presented, turns into the ship, fires at a book and the book shatters into pixels.
 */
const BOOK = [
  '.############.',
  '##..........##',
  '#.##########.#',
  '#.#........#.#',
  '#.##########.#',
  '#............#',
  '#............#',
  '#...######...#',
  '#............#',
  '#...######...#',
  '#............#',
  '#............#',
  '##..........##',
  '.############.',
];
const BW = 14;
const BH = BOOK.length;
const CELLS: { r: number; c: number }[] = [];
BOOK.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') CELLS.push({ r, c }); }));

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const STARS = Array.from({ length: 22 }, (_, i) => ({ x: 20 + rnd(i, 1) * 560, y: 20 + rnd(i, 2) * 680, r: 1 + rnd(i, 3) * 1.4 }));

export function Prologue({ q }: { q: number }) {
  // ship: presented large, turns, shrinks to ship size at the bottom
  const e1 = smooth(clamp((q - 0.14) / 0.34));
  const angle = lerp(-120, 360, e1);
  const sc = lerp(13, 7, e1);
  const cx = 300;
  const cy = lerp(350, 590, e1);
  const exit = smooth(clamp((q - 0.9) / 0.1));

  // book: drops in from above, then is hit three times
  const bs = 8;
  const bookIn = smooth(clamp((q - 0.08) / 0.22));
  const bookCx = 300;
  const bookCy = lerp(-120, 130, bookIn);
  const shots = [0, 1, 2].map((k) => {
    const t0 = 0.5 + k * 0.07;
    return clamp((q - t0) / 0.1);
  });
  const hitPulse = Math.max(...[0, 1, 2].map((k) => clamp(1 - (q - (0.6 + k * 0.07)) / 0.04) * (q >= 0.6 + k * 0.07 ? 1 : 0)));
  const shatter = clamp((q - 0.74) / 0.2);
  const shake = Math.sin(q * 900) * 4 * hitPulse;
  const noseX = cx + 0.5 * sc;
  const noseY = cy - (MARK_H / 2) * sc;
  const bookBottom = bookCy + (BH * bs) / 2;

  return (
    <svg className="prologue" viewBox="0 0 600 720" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g fill="var(--lp-ink)" opacity=".5">
        {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y + q * 30 * s.r} r={s.r} />)}
      </g>

      {/* shockwave */}
      {shatter > 0 && shatter < 1 && (
        <circle cx={bookCx} cy={bookCy} r={lerp(20, 300, shatter)} fill="none" stroke="var(--lp-ink)" strokeWidth="3" strokeDasharray="8 8" opacity={1 - shatter} />
      )}

      {/* the book */}
      <g shapeRendering="crispEdges" fill="var(--lp-ink)">
        {CELLS.map(({ r, c }, i) => {
          const ox = (c - BW / 2) * bs;
          const oy = (r - BH / 2) * bs;
          const ang = Math.atan2(oy, ox) + (rnd(i, 4) - 0.5) * 1.2;
          const dist = (70 + rnd(i, 5) * 260) * (1 - Math.pow(1 - shatter, 3));
          const fall = 320 * shatter * shatter * (0.4 + rnd(i, 6));
          const px = bookCx + ox * (1 + hitPulse * 0.04) + Math.cos(ang) * dist + shake;
          const py = bookCy + oy * (1 + hitPulse * 0.04) + Math.sin(ang) * dist + fall;
          const rot = (rnd(i, 7) - 0.5) * 360 * shatter;
          const op = shatter < 0.55 ? 1 : 1 - (shatter - 0.55) / 0.45;
          const sz = bs * (1 - 0.55 * shatter);
          return <rect key={i} x={-sz / 2} y={-sz / 2} width={sz} height={sz} transform={`translate(${px + bs / 2} ${py + bs / 2}) rotate(${rot})`} opacity={bookIn * op} />;
        })}
      </g>

      {/* impact sparks */}
      {hitPulse > 0 && shatter === 0 && (
        <g fill="var(--lp-ink)" shapeRendering="crispEdges">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const a = (i / 6) * Math.PI * 2 + 0.4;
            const d = 18 + (1 - hitPulse) * 46;
            return <rect key={i} x={noseX - 3 + Math.cos(a) * d} y={bookBottom - 3 + Math.sin(a) * d * 0.6} width={6} height={6} opacity={hitPulse} />;
          })}
        </g>
      )}

      {/* shots */}
      <g fill="var(--lp-ink)" shapeRendering="crispEdges">
        {shots.map((b, k) => {
          if (b <= 0 || b >= 1) return null;
          const y = lerp(noseY - 10, bookBottom + 4, b);
          return (
            <g key={k}>
              <rect x={noseX - 3} y={y} width={6} height={26} />
              <rect x={noseX - 1.5} y={y + 34} width={3} height={8} opacity=".55" />
              <rect x={noseX - 1.5} y={y + 52} width={3} height={4} opacity=".3" />
            </g>
          );
        })}
      </g>

      {/* the Kixi mark: logo first, then ship */}
      <g transform={`translate(0 ${-exit * 260})`} opacity={1 - exit}>
        <g transform={`translate(${cx} ${cy}) rotate(${angle}) scale(${sc}) translate(${-MARK_W / 2} ${-MARK_H / 2})`} fill="var(--lp-ink)" shapeRendering="crispEdges">
          <path d={RETRO_MARK} />
        </g>
        {/* recoil flash at the nose while firing */}
        {shots.some((b) => b > 0 && b < 0.25) && <rect x={noseX - 5} y={noseY - 16} width={10} height={10} fill="var(--lp-ink)" shapeRendering="crispEdges" />}
      </g>
      <g transform={`translate(${cx} ${cy + 10 * sc + 44}) scale(8) translate(${-WORD_W / 2} 0)`} fill="var(--lp-ink)" shapeRendering="crispEdges" opacity={1 - clamp((q - 0.08) / 0.1)}>
        <path d={RETRO_WORD} />
      </g>
    </svg>
  );
}
