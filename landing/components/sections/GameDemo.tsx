'use client';

import { useEffect, useState } from 'react';
import { spritePath } from './Bug';

/**
 * Attract mode: while nobody has scrolled, the console plays a tiny shooter by itself on the 160 x 144 screen.
 * The Kixi ship picks the lowest enemy, lines up under it and fires; clear the wave and the next one comes.
 * It is a pure function of the tick, so server and client render the same first frame.
 */
const W = 160;
const H = 144;
const COLS = 6;
const ROWS = 3;
const GAP_X = 19;
const GAP_Y = 15;
const START_X = 14;
const START_Y = 22;
const SHIP_Y = 120;
const KINDS = ['moth', 'fly', 'fly'] as const;

type Enemy = { col: number; row: number; alive: boolean };
type State = { t: number; wave: number; ox: number; oy: number; dir: 1 | -1; enemies: Enemy[]; shipX: number; cool: number; bullets: { x: number; y: number }[]; booms: { x: number; y: number; age: number }[]; score: number };

const wave = (n: number, score: number): State => ({
  t: 0, wave: n, ox: 0, oy: 0, dir: 1, shipX: 80, cool: 0, bullets: [], booms: [], score,
  enemies: Array.from({ length: COLS * ROWS }, (_, i) => ({ col: i % COLS, row: Math.floor(i / COLS), alive: true })),
});
const pos = (s: State, e: Enemy) => ({ x: START_X + e.col * GAP_X + s.ox, y: START_Y + e.row * GAP_Y + s.oy });

function step(s: State): State {
  const t = s.t + 1;
  let { ox, oy, dir } = s;
  // the formation shuffles sideways in steps and drops a row at each edge, like the old arcade games
  if (t % 5 === 0) {
    const alive = s.enemies.filter((e) => e.alive);
    const left = Math.min(...alive.map((e) => pos(s, e).x));
    const right = Math.max(...alive.map((e) => pos(s, e).x + 10));
    if ((dir === 1 && right + 3 > W - 8) || (dir === -1 && left - 3 < 8)) { dir = (dir * -1) as 1 | -1; oy += 3; } else ox += dir * 3;
  }
  const next: State = { ...s, t, ox, oy, dir, bullets: s.bullets.map((b) => ({ x: b.x, y: b.y - 6 })).filter((b) => b.y > 8), booms: s.booms.map((b) => ({ ...b, age: b.age + 1 })).filter((b) => b.age < 4), enemies: s.enemies.map((e) => ({ ...e })) };

  // the ship lines up under the lowest enemy that is closest to it, and fires when it is there
  const alive = next.enemies.filter((e) => e.alive);
  if (alive.length === 0 || next.oy > 50) return wave(s.wave + 1, s.score);
  const low = Math.max(...alive.map((e) => e.row));
  const target = alive.filter((e) => e.row === low).map((e) => pos(next, e).x + 5).sort((a, b) => Math.abs(a - s.shipX) - Math.abs(b - s.shipX))[0];
  const dx = target - s.shipX;
  next.shipX = Math.max(10, Math.min(W - 10, s.shipX + Math.sign(dx) * Math.min(3, Math.abs(dx))));
  next.cool = Math.max(0, s.cool - 1);
  if (Math.abs(dx) <= 4 && next.cool === 0) { next.bullets.push({ x: Math.round(next.shipX), y: SHIP_Y - 2 }); next.cool = 7; }

  // shots against enemies
  for (const b of next.bullets) {
    for (const e of next.enemies) {
      if (!e.alive) continue;
      const p = pos(next, e);
      if (b.x >= p.x - 1 && b.x <= p.x + 11 && b.y >= p.y && b.y <= p.y + 9) {
        e.alive = false; b.y = -99;
        next.booms.push({ x: p.x + 4, y: p.y + 3, age: 0 });
        next.score += 10 * (ROWS - e.row);
      }
    }
  }
  next.bullets = next.bullets.filter((b) => b.y > 0);
  return next;
}

const pad = (n: number) => String(n % 10000).padStart(4, '0');

export function GameDemo({ paused = false }: { paused?: boolean }) {
  const [s, setS] = useState<State>(() => wave(1, 0));

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setS((x) => step(x)), 70);
    return () => window.clearInterval(id);
  }, [paused]);

  const ship = spritePath('ship');
  const kinds = { moth: spritePath('moth'), fly: spritePath('fly') };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="prologue" shapeRendering="crispEdges" preserveAspectRatio="xMidYMid slice" aria-hidden="true" fill="var(--lp-ink)" style={{ fontFamily: 'var(--font-pixel)' }}>
      <text x="8" y="14" fontSize="7">{pad(s.score)}</text>
      <text x={W - 8} y="14" fontSize="7" textAnchor="end">W{s.wave}</text>
      {s.enemies.map((e) => {
        if (!e.alive) return null;
        const p = pos(s, e);
        const k = kinds[KINDS[e.row]];
        const bob = (s.t >> 2) & 1;
        return <path key={`${e.col}-${e.row}`} d={k.d} transform={`translate(${Math.round(p.x)} ${Math.round(p.y) + bob})`} />;
      })}
      {s.booms.map((b, i) => (
        <g key={i} transform={`translate(${b.x} ${b.y})`}>
          <path d={`M${-1 - b.age} 0h${3 + b.age * 2}v1h-${3 + b.age * 2}zM0 ${-1 - b.age}v${3 + b.age * 2}h1v-${3 + b.age * 2}z`} />
        </g>
      ))}
      {s.bullets.map((b, i) => <rect key={i} x={b.x} y={b.y} width="1" height="4" />)}
      <g transform={`translate(${Math.round(s.shipX) - 6} ${SHIP_Y})`}><path d={ship.d} /></g>
      <rect x="6" y="134" width={W - 12} height="1" />
      {((s.t >> 3) & 1) === 0 ? <text x={W / 2} y="142" fontSize="5" textAnchor="middle">ROLA</text> : null}
    </svg>
  );
}
