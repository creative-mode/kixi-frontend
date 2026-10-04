import { spritePath } from './Bug';

/**
 * The Kixi cartridge as an isometric exploded-view line drawing.
 * Plan view (x right-down, y left-down, z up) is projected with the classic 30° isometric matrix.
 * Every layer is one of the five product modules.
 */
const S = 0.866;
const H = 0.5;
const pr = (x: number, y: number, z: number): [number, number] => [(x - y) * S, (x + y) * H - z];
const poly = (a: [number, number][]) => a.map((p) => p.join(',')).join(' ');
const plan = (z: number) => `matrix(${S} ${H} ${-S} ${H} 0 ${-z})`;

export const LAYERS = [
  { id: 'ocr', label: 'OCR' },
  { id: 'salas', label: 'Salas de prova' },
  { id: 'social', label: 'Social learning' },
  { id: 'tutor', label: 'Tutor de IA' },
  { id: 'dash', label: 'Dashboard' },
] as const;

type SlabProps = { x?: number; y?: number; w: number; d: number; h: number; z: number; rx?: number; children?: React.ReactNode; well?: boolean };

function Slab({ x = 0, y = 0, w, d, h, z, rx = 6, children }: SlabProps) {
  const zt = z + h;
  const right: [number, number][] = [pr(x + w, y, zt), pr(x + w, y + d, zt), pr(x + w, y + d, z), pr(x + w, y, z)];
  const left: [number, number][] = [pr(x, y + d, zt), pr(x + w, y + d, zt), pr(x + w, y + d, z), pr(x, y + d, z)];
  return (
    <g>
      <polygon points={poly(left)} fill="var(--paper-2)" />
      <polygon points={poly(left)} fill="url(#kx-hatch)" />
      <polygon points={poly(right)} fill="var(--paper)" />
      <polygon points={poly(right)} fill="url(#kx-hatch2)" />
      <g transform={plan(zt)}>
        <rect x={x} y={y} width={w} height={d} rx={rx} fill="var(--paper-3)" />
        {children}
      </g>
    </g>
  );
}

function Dome({ cx, cy, r, z, h }: { cx: number; cy: number; r: number; z: number; h: number }) {
  const [X, Y] = pr(cx, cy, z + h);
  const rx = 1.2247 * r;
  const ry = 0.7071 * r;
  return (
    <g>
      <path d={`M${X - rx} ${Y} L${X - rx} ${Y + h} A${rx} ${ry} 0 0 0 ${X + rx} ${Y + h} L${X + rx} ${Y} Z`} fill="var(--paper-2)" />
      <path d={`M${X - rx} ${Y} L${X - rx} ${Y + h} A${rx} ${ry} 0 0 0 ${X + rx} ${Y + h} L${X + rx} ${Y} Z`} fill="url(#kx-hatch2)" />
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

function Layer({ i, bars, a }: { i: number; bars: number; a: number }) {
  const t = TH[i];
  const ship = spritePath('ship');
  switch (i) {
    case 0:
      return (
        <Slab w={W} d={D} h={t.h} z={t.z} rx={10}>
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
        <Slab x={10} y={10} w={280} d={190} h={t.h} z={t.z}>
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
    case 2:
      return (
        <g>
          <Slab x={10} y={10} w={280} d={190} h={t.h} z={t.z}>
            <rect x={28} y={28} width={64} height={22} rx={3} fill="none" />
            {[0, 1, 2, 3].map((k) => <line key={k} x1={38 + k * 14} y1={28} x2={38 + k * 14} y2={50} />)}
            <path d="M220 170 C 250 170 250 130 250 110" fill="none" strokeDasharray="1 5" strokeDashoffset={-a * 60} strokeLinecap="round" />
          </Slab>
          <Dome cx={100} cy={105} r={20} z={t.z + t.h} h={16} />
          <Dome cx={190} cy={105} r={20} z={t.z + t.h} h={16} />
        </g>
      );
    case 3:
      return (
        <g>
          <Slab x={10} y={10} w={280} d={190} h={t.h} z={t.z}>
            <path d="M150 105 H60 V40 H30 M150 105 V170 H40 M150 105 H260 V150 M180 80 L240 40 H270" fill="none" />
            {[[30, 40], [40, 170], [270, 40], [260, 150]].map(([cx, cy], k) => <circle key={k} cx={cx} cy={cy} r={4} fill="var(--paper-3)" />)}
            <polygon points="20,190 160,190 290,125 290,190" fill="url(#kx-dots)" opacity=".7" />
          </Slab>
          <Slab x={95} y={55} w={110} d={80} h={12} z={t.z + t.h} rx={4}>
            <rect x={95 - 95 + 10} y={10} width={90} height={60} rx={3} fill="none" />
            {[0, 1, 2, 3, 4].map((k) => <line key={k} x1={20 + k * 18} y1={10} x2={20 + k * 18} y2={-2} />)}
            <g transform="translate(34 24) scale(4)" opacity={Math.min(1, 0.25 + a * 1.5)}><path d={spritePath('fly').d} fill="var(--lp-ink)" /></g>
          </Slab>
        </g>
      );
    default: {
      const heights = [26, 44, 62].map((v) => v * bars * (0.55 + 0.45 * a));
      return (
        <g>
          <Slab w={W} d={D} h={t.h} z={t.z} rx={10}>
            <rect x={20} y={20} width={260} height={170} rx={8} fill="var(--paper-2)" />
            <rect x={20} y={20} width={260} height={170} rx={8} fill="url(#kx-dots)" />
          </Slab>
          {heights.map((hh, k) => (hh > 1 ? <Slab key={k} x={62 + k * 70} y={96} w={42} d={42} h={hh} z={t.z + t.h} rx={2} /> : null))}
        </g>
      );
    }
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const Y0 = 560;
const X0 = 230;
/** Vertical centre of layer i (in drawing units) for a given explode amount. */
const centreY = (i: number, e: number) => Y0 + ((W + D) * H) / 2 - (TH[i].z + TH[i].h) - GAP * (4 - i) * e;

export function Cartridge({
  explode = 0, focus = 0, zoom = 0, acts, callouts = false, className,
}: { explode?: number; focus?: number; zoom?: number; acts?: number[]; callouts?: boolean; className?: string }) {
  const top = Y0 - (56 + 4 * GAP * explode) - 40;
  const bottom = Y0 + (W + D) * H + 24;
  const f = Math.min(4, Math.max(0, focus));
  const lo = Math.floor(f);
  const hi = Math.min(4, lo + 1);
  const camY = lerp(centreY(lo, explode), centreY(hi, explode), f - lo);
  const vbH = lerp(bottom - top, 520, zoom);
  const cy = lerp((top + bottom) / 2, camY, zoom);
  const o = Math.max(explode, zoom);
  const vbW = lerp(540, 790, o);
  const cx = lerp(269, 400, o);
  const active = zoom > 0.6 ? Math.round(f) : null;
  return (
    <svg className={`cart ${className ?? ''}`} viewBox={`${cx - vbW / 2} ${cy - vbH / 2} ${vbW} ${vbH}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Desenho isométrico do cartucho Kixi desmontado em cinco camadas: OCR, salas de prova, social learning, tutor de IA e dashboard">
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
          const off = explode * GAP * (4 - i) + (active === i ? 14 : 0);
          const t = TH[i];
          const [ax, ay] = pr(W - (i === 0 || i === 4 ? 0 : 10), i === 0 || i === 4 ? 0 : 10, t.z + t.h);
          const by = ay + t.h;
          const bx = W * S + 40;
          const a = acts ? acts[i] ?? 0 : 0;
          return (
            <g key={i} className="cart__layer" strokeWidth={active === i ? 2.6 : 1.6} style={{ transform: `translateY(${-off}px)` }}>
              <Layer i={i} bars={Math.max(0, Math.min(1, (explode - 0.4) / 0.5))} a={a} />
              {callouts && (
                <g className="cart__call" style={{ opacity: explode > 0.85 ? 1 : 0 }}>
                  <line x1={ax + 4} y1={ay} x2={bx} y2={ay} />
                  <line x1={ax + 4} y1={by} x2={bx} y2={by} />
                  <line x1={bx} y1={ay} x2={bx} y2={by} />
                  <circle cx={bx} cy={ay} r={3.2} fill="var(--lp-ink)" />
                  <circle cx={bx} cy={by} r={3.2} fill="var(--lp-ink)" />
                  <line x1={bx} y1={(ay + by) / 2} x2={bx + 34} y2={(ay + by) / 2} />
                  <circle cx={bx + 34} cy={(ay + by) / 2} r={3.2} fill="var(--lp-ink)" />
                  <text x={bx + 46} y={(ay + by) / 2 + 4} fontFamily="'Press Start 2P', monospace" fontSize="12" fill="var(--lp-ink)" stroke="none" fontWeight={active === i ? 700 : 400}>{LAYERS[i].label}</text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
