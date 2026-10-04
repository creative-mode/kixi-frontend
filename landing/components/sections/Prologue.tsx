import { useEffect, useState } from 'react';
import { MARK_H, MARK_W, RETRO_MARK } from '@/lib/mark';

/**
 * Prologue, drawn from scroll progress q (0..1):
 * the logo alone → it leaves and the P1 exam takes the stage with its story ("está pico?") → the text goes, the exam
 * shrinks → the Kixi ship arrives, fires from its tip and the exam shatters into pixels.
 */
const BOOK = [
  '#########...',
  '#.......##..',
  '#.......#.#.',
  '#.......####',
  '#..........#',
  '#.########.#',
  '#..........#',
  '#.######...#',
  '#..........#',
  '#.########.#',
  '#..........#',
  '#.#####....#',
  '#..........#',
  '#.########.#',
  '#..........#',
  '############',
];
const BW = 12;
const BH = BOOK.length;
const CELLS: { r: number; c: number }[] = [];
BOOK.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') CELLS.push({ r, c }); }));

const MARK_CELLS: { x: number; y: number }[] = [];
for (const m of RETRO_MARK.matchAll(/M(\d+) (\d+)h(\d+)v1/g)) {
  for (let i = 0; i < +m[3]; i++) MARK_CELLS.push({ x: +m[1] + i, y: +m[2] });
}
const hash = (a: number, b: number, c: number) => { const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return v - Math.floor(v); };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rnd = (i: number, k: number) => {
  const x = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const r2 = (v: number) => Math.round(v * 100) / 100;
const STARS = Array.from({ length: 22 }, (_, i) => ({ x: r2(20 + rnd(i, 1) * 560), y: r2(20 + rnd(i, 2) * 680), r: r2(1 + rnd(i, 3) * 1.4) }));

const win = (q: number, a: number, b: number) => clamp((q - a) / (b - a));
const PIX = { fontFamily: 'var(--font-pixel)' } as const;
const QMARKS = Array.from({ length: 14 }, (_, i) => ({ x: 300 + (rnd(i * 13 + 5, 11) - 0.5) * 170, y: 215 + (rnd(i * 29 + 2, 12) - 0.5) * 210, s: 22 + rnd(i, 13) * 34, a: (rnd(i, 14) - 0.5) * 40, t: 0.26 + (i / 14) * 0.12 }));
const LINES = [42, 62, 30, 56, 48, 36];
const FIRE = 12; // firing pose: tilted like the reference, tip leads
const TYPE1 = 'A P1 está pico?';
const TYPE2 = 'E sem o Kixi?';

export function Prologue({ q }: { q: number }) {
  // idle life of the logo: the rows slide a cell, stepped like a sprite, until the person scrolls
  const [tick, setTick] = useState(0);
  const idle = q < 0.12;
  useEffect(() => {
    if (!idle) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 140);
    return () => window.clearInterval(id);
  }, [idle]);
  const life = 1 - win(q, 0.0, 0.07);

  // 1) the logo alone, large; then it leaves to make room for the exam
  const logoOut = smooth(win(q, 0.07, 0.15));
  const logoSc = lerp(13, 9, logoOut);

  // 2) the exam takes the stage, big, with its story under it
  const paperIn = smooth(win(q, 0.11, 0.2));
  const shrink = smooth(win(q, 0.52, 0.6));
  const paperSc = lerp(0.35, 1.45, paperIn) * lerp(1, 0.5 / 1.45, shrink);
  const paperY = lerp(290, 215, shrink);
  const nerv = win(q, 0.26, 0.5) * (1 - shrink);
  const shakeP = Math.sin(q * 1400) * 3.2 * nerv;
  const stamp = smooth(win(q, 0.38, 0.42));
  const t1 = Math.floor(win(q, 0.2, 0.28) * TYPE1.length);
  const t2 = Math.floor(win(q, 0.43, 0.5) * TYPE2.length);
  const captionOp = win(q, 0.2, 0.22) * (1 - win(q, 0.5, 0.54));
  const timer = 1 - win(q, 0.26, 0.4);
  const swap = win(q, 0.57, 0.6); // vector paper → pixel paper, same size

  // 3) the Kixi ship arrives and fires from its tip
  const shipE = smooth(win(q, 0.6, 0.7));
  const angle = lerp(0, 360 + FIRE, shipE);
  const sc = lerp(1, 7, shipE);
  const fr = (FIRE * Math.PI) / 180;
  const tipOff = (0.5 * Math.cos(fr) + 9.5 * Math.sin(fr)) * 7;
  const cx = 300 - tipOff * shipE;
  const cy = lerp(700, 600, shipE);
  const exit = smooth(win(q, 0.9, 0.97));

  const bs = 8;
  const bookIn = swap;
  const bookCx = 300;
  const bookCy = 215;
  const hitAt = [0.77, 0.82, 0.87];
  const shots = hitAt.map((h) => clamp((q - (h - 0.07)) / 0.07));
  const hitPulse = Math.max(...hitAt.map((h) => (q >= h ? clamp(1 - (q - h) / 0.04) : 0)));
  const shatter = win(q, 0.88, 0.98);
  const shake = Math.sin(q * 900) * 4 * hitPulse;
  const ar = (angle * Math.PI) / 180;
  const noseX = cx + (0.5 * Math.cos(ar) + 9.5 * Math.sin(ar)) * sc;
  const noseY = cy + (0.5 * Math.sin(ar) - 9.5 * Math.cos(ar)) * sc;
  const bookBottom = bookCy + (BH * bs) / 2;

  return (
    <svg className="prologue" viewBox="0 0 600 720" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <g fill="var(--lp-ink)" opacity=".5">
        {STARS.map((s, i) => <circle key={i} cx={s.x} cy={r2(s.y + q * 30 * s.r)} r={s.r} />)}
      </g>

      {/* the Kixi logo, alone and alive, then it leaves */}
      {logoOut < 1 && (
        <g transform={`translate(300 285) scale(${logoSc}) translate(${-MARK_W / 2} ${-MARK_H / 2})`} fill="var(--lp-ink)" shapeRendering="crispEdges" opacity={1 - logoOut}>
          {life > 0.02 ? (
            MARK_CELLS.map(({ x, y }) => {
              // rows slide one cell at a time, so the logo stays solid
              const sway = Math.sin(tick * 0.45 + y * 0.42);
              const dx = life > 0.5 ? (sway > 0.8 ? 1 : sway < -0.8 ? -1 : 0) : 0;
              return <rect key={`${x}-${y}`} x={x + dx} y={y} width="1.04" height="1.04" />;
            })
          ) : (
            <path d={RETRO_MARK} />
          )}
        </g>
      )}

      {/* the P1 exam, in the spotlight */}
      {paperIn > 0 && swap < 1 && (
        <g transform={`translate(${300 + shakeP} ${paperY}) rotate(${Math.sin(q * 900) * 1.4 * nerv}) scale(${paperSc})`} opacity={(1 - swap) * paperIn}>
          <rect x="-100" y="-130" width="200" height="260" fill="var(--paper-3)" stroke="var(--lp-ink)" strokeWidth="4" vectorEffect="non-scaling-stroke" />
          <path d="M60 -130h40v40z" fill="var(--paper-2)" stroke="var(--lp-ink)" strokeWidth="4" vectorEffect="non-scaling-stroke" />
          <text x="-84" y="-92" fontSize="30" fill="var(--lp-ink)" style={PIX}>P1</text>
          {LINES.map((w, i) => <rect key={i} x="-84" y={-62 + i * 26} width={w * 3.2} height="8" fill="var(--lp-ink)" opacity=".55" />)}
          <rect x="-84" y="104" width="168" height="10" fill="none" stroke="var(--lp-ink)" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <rect x="-81" y="107" width={162 * timer} height="4" fill="var(--lp-ink)" />
          {QMARKS.map((m, i) => {
            const k = smooth(win(q, m.t, m.t + 0.05));
            if (k <= 0) return null;
            return <text key={i} x={m.x - 300} y={m.y - 215} fontSize={m.s * (0.4 + 0.6 * k)} textAnchor="middle" fill="var(--lp-ink)" opacity={k} transform={`rotate(${m.a} ${m.x - 300} ${m.y - 215})`} style={PIX}>?</text>;
          })}
          {stamp > 0 && (
            <g transform={`translate(34 62) rotate(-14) scale(${1 + (1 - stamp) * 1.6})`} opacity={stamp}>
              <circle r="46" fill="var(--paper-3)" stroke="var(--lp-ink)" strokeWidth="4" strokeDasharray="10 5" vectorEffect="non-scaling-stroke" />
              <text textAnchor="middle" y="9" fontSize="26" fill="var(--lp-ink)" style={PIX}>4/20</text>
            </g>
          )}
        </g>
      )}

      {/* captions, under the exam */}
      {captionOp > 0 && (
        <g fill="var(--lp-ink)" opacity={captionOp} style={PIX} textAnchor="middle">
          <text x="300" y="548" fontSize="22">{TYPE1.slice(0, t1)}{t1 < TYPE1.length && Math.floor(q * 90) % 2 ? '_' : ''}</text>
          <text x="300" y="592" fontSize="22" opacity={t2 > 0 ? 1 : 0}>{TYPE2.slice(0, t2)}{t2 > 0 && t2 < TYPE2.length && Math.floor(q * 90) % 2 ? '_' : ''}</text>
        </g>
      )}

      {/* shockwave */}
      {shatter > 0 && shatter < 1 && (
        <circle cx={bookCx} cy={bookCy} r={lerp(20, 300, shatter)} fill="none" stroke="var(--lp-ink)" strokeWidth="3" strokeDasharray="8 8" opacity={1 - shatter} />
      )}

      {/* the exam as pixels: this is what the ship destroys */}
      <g shapeRendering="crispEdges" fill="var(--lp-ink)">
        {bookIn > 0 && CELLS.map(({ r, c }, i) => {
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

      {/* shots, out of the tip */}
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

      {/* the ship: arrives turning, then fires */}
      {shipE > 0 && (
        <g transform={`translate(0 ${-exit * 260})`} opacity={(1 - exit) * clamp(shipE * 3)}>
          <g transform={`translate(${cx} ${cy}) rotate(${angle}) scale(${sc}) translate(${-MARK_W / 2} ${-MARK_H / 2})`} fill="var(--lp-ink)" shapeRendering="crispEdges">
            <path d={RETRO_MARK} />
          </g>
          {shots.some((b) => b > 0 && b < 0.25) && <rect x={noseX - 5} y={noseY - 16} width={10} height={10} fill="var(--lp-ink)" shapeRendering="crispEdges" />}
        </g>
      )}
    </svg>
  );
}
