import { spritePath } from './Bug';

/**
 * The Kixi cartridge as an isometric exploded-view line drawing.
 * Plan view (x, y) and height z are projected with the classic 30° isometric matrix,
 * after a yaw rotation around the cartridge's vertical axis, so any layer can turn in place.
 */
const S = 0.866;
const H = 0.5;
const CX = 150;
const CY = 105;
const C0: [number, number] = [(CX - CY) * S, (CX + CY) * H];

function proj(x: number, y: number, z: number, yaw: number): [number, number] {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const dx = x - CX;
  const dy = y - CY;
  const rx = dx * c - dy * s;
  const ry = dx * s + dy * c;
  return [(rx - ry) * S + C0[0], (rx + ry) * H + C0[1] - z];
}
const depth = (x: number, y: number, yaw: number) => {
  const dx = x - CX;
  const dy = y - CY;
  return dx * Math.cos(yaw) - dy * Math.sin(yaw) + dx * Math.sin(yaw) + dy * Math.cos(yaw);
};
const poly = (a: [number, number][]) => a.map((p) => p.join(',')).join(' ');
function plan(z: number, yaw: number) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const a = S * (c - s);
  const b = H * (c + s);
  const cc = -S * (s + c);
  const d = H * (c - s);
  return `matrix(${a} ${b} ${cc} ${d} ${C0[0] - a * CX - cc * CY} ${C0[1] - b * CX - d * CY - z})`;
}

export const LAYERS = [
  { id: 'ocr', label: 'Fotografa' },
  { id: 'salas', label: 'Simula' },
  { id: 'social', label: 'Compara' },
  { id: 'tutor', label: 'Pergunta' },
  { id: 'dash', label: 'Acompanha' },
] as const;

type SlabProps = { x?: number; y?: number; w: number; d: number; h: number; z: number; rx?: number; yaw: number; top?: string; children?: React.ReactNode };

const FACES = [
  { n: [1, 0], p: (x: number, y: number, w: number, d: number) => [[x + w, y], [x + w, y + d]] },
  { n: [-1, 0], p: (x: number, y: number, _w: number, d: number) => [[x, y], [x, y + d]] },
  { n: [0, 1], p: (x: number, y: number, w: number, d: number) => [[x, y + d], [x + w, y + d]] },
  { n: [0, -1], p: (x: number, y: number, w: number) => [[x, y], [x + w, y]] },
];

function Slab({ x = 0, y = 0, w, d, h, z, rx = 6, yaw, top = 'var(--paper-3)', children }: SlabProps) {
  const zt = z + h;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return (
    <g>
      {FACES.map((f, k) => {
        const nx = f.n[0] * c - f.n[1] * s;
        const ny = f.n[0] * s + f.n[1] * c;
        if (nx + ny <= 0.02) return null; // faces turned away from the viewer
        const [p0, p1] = f.p(x, y, w, d);
        const pts: [number, number][] = [proj(p0[0], p0[1], zt, yaw), proj(p1[0], p1[1], zt, yaw), proj(p1[0], p1[1], z, yaw), proj(p0[0], p0[1], z, yaw)];
        const dark = nx - ny > 0;
        return (
          <g key={k}>
            <polygon points={poly(pts)} fill={dark ? 'var(--paper)' : 'var(--paper-2)'} />
            <polygon points={poly(pts)} fill={dark ? 'url(#kx-hatch2)' : 'url(#kx-hatch)'} />
          </g>
        );
      })}
      <g transform={plan(zt, yaw)}>
        <rect x={x} y={y} width={w} height={d} rx={rx} fill={top} />
        {children}
      </g>
    </g>
  );
}

function Dome({ cx, cy, r, z, h, yaw }: { cx: number; cy: number; r: number; z: number; h: number; yaw: number }) {
  const [X, Y] = proj(cx, cy, z + h, yaw);
  const rx = 1.2247 * r;
  const ry = 0.7071 * r;
  const side = `M${X - rx} ${Y} L${X - rx} ${Y + h} A${rx} ${ry} 0 0 0 ${X + rx} ${Y + h} L${X + rx} ${Y} Z`;
  return (
    <g>
      <path d={side} fill="var(--paper-2)" />
      <path d={side} fill="url(#kx-hatch2)" />
      <ellipse cx={X} cy={Y} rx={rx} ry={ry} fill="var(--paper-3)" />
      <ellipse cx={X} cy={Y} rx={rx * 0.58} ry={ry * 0.58} fill="var(--paper-2)" />
      <ellipse cx={X} cy={Y} rx={rx * 0.58} ry={ry * 0.58} fill="url(#kx-dots)" />
    </g>
  );
}

const W = 300;
const D = 210;
const TH = [
  { z: 40, h: 16 }, // ocr
  { z: 32, h: 8 }, // salas
  { z: 24, h: 8 }, // social
  { z: 18, h: 6 }, // tutor
  { z: 0, h: 18 }, // dash
];
const GAP = 108;
const SPREAD = 150;

function Layer({ i, bars, a, yaw, on }: { i: number; bars: number; a: number; yaw: number; on: boolean }) {
  const t = TH[i];
  const hot = on ? 'var(--paper-2)' : 'var(--paper-3)'; // the layer in focus is a shade darker, no spot colour
  const ship = spritePath('ship');
  switch (i) {
    case 0:
      return (
        <Slab w={W} d={D} h={t.h} z={t.z} rx={10} yaw={yaw} top={hot}>
          <rect x={22} y={22} width={256} height={166} rx={8} fill="none" />
          <polygon points="22,188 150,188 278,110 278,188" fill="url(#kx-dots)" opacity=".9" />
          <g transform="translate(108 60) scale(7)"><path d={ship.d} fill="var(--lp-ink)" /></g>
          <text x={34} y={54} fontFamily="'Press Start 2P', monospace" fontSize={15} fill="var(--lp-ink)" stroke="none">KIXI</text>
          <circle cx={232} cy={56} r={22} fill="var(--paper-2)" />
          <circle cx={232} cy={56} r={14} fill="var(--paper-3)" />
          <circle cx={232} cy={56} r={6} fill="var(--lp-ink)" />
          <circle cx={46} cy={160} r={7} fill="none" />
          <circle cx={74} cy={160} r={7} fill="none" />
          <circle cx={102} cy={160} r={7} fill="none" />
          {a > 0.04 && <rect x={22} y={24 + a * 150} width={256} height={9} fill="url(#kx-hatch)" opacity=".95" />}
        </Slab>
      );
    case 1:
      return (
        <Slab x={10} y={10} w={280} d={190} h={t.h} z={t.z} yaw={yaw} top={hot}>
          {Array.from({ length: 12 }).map((_, k) => {
            const cx = 34 + (k % 6) * 40;
            const cy = 36 + Math.floor(k / 6) * 40;
            return <rect key={k} x={cx} y={cy} width={30} height={30} rx={3} fill={k === 2 ? 'var(--lp-ink)' : k < 2 + Math.floor(a * 7) ? 'url(#kx-dots2)' : 'none'} />;
          })}
          <rect x={34} y={124} width={232} height={16} rx={3} fill="none" />
          <rect x={34} y={124} width={Math.max(8, 232 * (0.15 + 0.8 * a))} height={16} rx={3} fill="url(#kx-hatch)" />
          <line x1={34} y1={156} x2={220} y2={156} />
          <line x1={34} y1={168} x2={180} y2={168} />
        </Slab>
      );
    case 2: {
      const domes = [{ cx: 100, cy: 105 }, { cx: 190, cy: 105 }].sort((p, q) => depth(p.cx, p.cy, yaw) - depth(q.cx, q.cy, yaw));
      return (
        <g>
          <Slab x={10} y={10} w={280} d={190} h={t.h} z={t.z} yaw={yaw} top={hot}>
            <rect x={28} y={28} width={64} height={22} rx={3} fill="none" />
            {[0, 1, 2, 3].map((k) => <line key={k} x1={38 + k * 14} y1={28} x2={38 + k * 14} y2={50} />)}
            <path d="M220 170 C 250 170 250 130 250 110" fill="none" strokeDasharray="1 5" strokeDashoffset={-a * 60} strokeLinecap="round" />
          </Slab>
          {domes.map((d) => <Dome key={d.cx} cx={d.cx} cy={d.cy} r={20} z={t.z + t.h} h={16} yaw={yaw} />)}
        </g>
      );
    }
    case 3:
      return (
        <g>
          <Slab x={10} y={10} w={280} d={190} h={t.h} z={t.z} yaw={yaw} top={hot}>
            <path d="M150 105 H60 V40 H30 M150 105 V170 H40 M150 105 H260 V150 M180 80 L240 40 H270" fill="none" />
            {[[30, 40], [40, 170], [270, 40], [260, 150]].map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r={4} fill="var(--paper-3)" />)}
            <polygon points="20,190 160,190 290,125 290,190" fill="url(#kx-dots)" opacity=".7" />
          </Slab>
          <Slab x={95} y={65} w={110} d={80} h={12} z={t.z + t.h} rx={4} yaw={yaw}>
            <rect x={105} y={75} width={90} height={60} rx={3} fill="none" />
            {[0, 1, 2, 3, 4].map((k) => <line key={k} x1={115 + k * 18} y1={75} x2={115 + k * 18} y2={63} />)}
            <g transform="translate(129 89) scale(4)" opacity={Math.min(1, 0.25 + a * 1.5)}><path d={spritePath('fly').d} fill="var(--lp-ink)" /></g>
          </Slab>
        </g>
      );
    default: {
      const bs = [26, 44, 62].map((v, k) => ({ k, hh: v * bars * (0.55 + 0.45 * a), x: 62 + k * 70, y: 96 }));
      bs.sort((p, q) => depth(p.x + 21, p.y + 21, yaw) - depth(q.x + 21, q.y + 21, yaw));
      return (
        <g>
          <Slab w={W} d={D} h={t.h} z={t.z} rx={10} yaw={yaw} top={hot}>
            <rect x={20} y={20} width={260} height={170} rx={8} fill="var(--paper-3)" />
            <rect x={20} y={20} width={260} height={170} rx={8} fill="url(#kx-dots)" />
          </Slab>
          {bs.map((b) => (b.hh > 1 ? <Slab key={b.k} x={b.x} y={b.y} w={42} d={42} h={b.hh} z={t.z + t.h} rx={2} yaw={yaw}  /> : null))}
        </g>
      );
    }
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const Y0 = 560;
const X0 = 230;

export function Cartridge({
  explode = 0, focus = 0, zoom = 0, acts, yaws, callouts = false, className,
}: { explode?: number; focus?: number; zoom?: number; acts?: number[]; yaws?: number[]; callouts?: boolean; className?: string }) {
  const f = clamp(focus, 0, 4);
  const shift = (j: number) => SPREAD * zoom * clamp(j - f, -1, 1);
  const offset = (j: number) => explode * GAP * (4 - j) - shift(j);
  const centre = (j: number) => Y0 + C0[1] - (TH[j].z + TH[j].h) - offset(j);

  const top = Y0 - (56 + 4 * GAP * explode) - 40;
  const bottom = Y0 + (W + D) * H + 24;
  const lo = Math.floor(f);
  const hi = Math.min(4, lo + 1);
  const camY = lerp(centre(lo), centre(hi), f - lo);
  const vbH = lerp(bottom - top, 360, zoom);
  const cy = lerp((top + bottom) / 2, camY, zoom);
  const vbW = lerp(lerp(540, 790, explode), 560, zoom);
  const cx = lerp(lerp(269, 400, explode), X0 + C0[0], zoom);
  const active = zoom > 0.6 ? Math.round(f) : null;
  const callAmt = callouts ? clamp((explode - 0.8) / 0.2) * (1 - clamp(zoom * 3)) : 0;

  return (
    <svg className={`cart ${className ?? ''}`} viewBox={`${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Desenho isométrico do cartucho Kixi desmontado em cinco camadas: fotografa, simula, compara, pergunta e acompanha">
      <defs>
        <pattern id="kx-dots" width="4" height="4" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".75" fill="var(--lp-ink)" /></pattern>
        <pattern id="kx-dots2" width="3" height="3" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r=".7" fill="var(--lp-ink)" /></pattern>
        <pattern id="kx-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(60)"><line x1="0" y1="0" x2="0" y2="5" stroke="var(--lp-ink)" strokeWidth="1" /></pattern>
        <pattern id="kx-hatch2" width="3.4" height="3.4" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)"><line x1="0" y1="0" x2="0" y2="3.4" stroke="var(--lp-ink)" strokeWidth="1" /></pattern>
        <filter id="kx-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="1.8" />
        </filter>
      </defs>
      <g transform={`translate(${X0} ${Y0})`} filter="url(#kx-ink)" fill="none" stroke="var(--lp-ink)" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round">
        {[4, 3, 2, 1, 0].map((i) => {
          const t = TH[i];
          const yaw = yaws ? yaws[i] ?? 0 : 0;
          const a = acts ? acts[i] ?? 0 : 0;
          const [ax, ay] = proj(W - (i === 0 || i === 4 ? 0 : 10), i === 0 || i === 4 ? 0 : 10, t.z + t.h, 0);
          const by = ay + t.h;
          const bx = W * S + 40;
          const my = (ay + by) / 2;
          return (
            <g key={i} className="cart__layer" strokeWidth={active === i ? 2.6 : 1.6} style={{ transform: `translateY(${-offset(i)}px)` }}>
              <Layer i={i} bars={clamp((explode - 0.4) / 0.5)} a={a} yaw={yaw} on={active === i} />
              {callAmt > 0.02 && (
                <g style={{ opacity: callAmt }}>
                  <line x1={ax + 4} y1={ay} x2={bx} y2={ay} />
                  <line x1={ax + 4} y1={by} x2={bx} y2={by} />
                  <line x1={bx} y1={ay} x2={bx} y2={by} />
                  <circle cx={bx} cy={ay} r={3.2} fill="var(--lp-ink)" />
                  <circle cx={bx} cy={by} r={3.2} fill="var(--lp-ink)" />
                  <line x1={bx} y1={my} x2={bx + 34} y2={my} />
                  <circle cx={bx + 34} cy={my} r={3.2} fill="var(--lp-ink)" />
                  <text x={bx + 46} y={my + 4} fontFamily="'Press Start 2P', monospace" fontSize="12" fill="var(--lp-ink)" stroke="none">{LAYERS[i].label}</text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
