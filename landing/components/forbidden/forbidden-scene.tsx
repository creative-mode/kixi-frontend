'use client';

import { useEffect, useRef, useState } from 'react';

import { GUARD_BODY, GUARD_EYES, GUARD_FEET_L, GUARD_FEET_R, GUARD_COLS, GUARD_ROWS } from './guard-sprite';

/** 403: porta do Kixi. Cor, espaco e tipografia vem dos tokens da landing;
 * guarda SVG auto-generated via PNG region extraction. */

type Vars = React.CSSProperties & { [key: `--${string}`]: string };

const rnd = (i: number, k: number) => {
 const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
 return v - Math.floor(v);
};

const clamp = (v: number, a: number) => Math.max(-a, Math.min(a, v));
const reducedMotion = () =>
 typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TEXT = 'ERRO 403 · ÁREA RESTRITA';

const DOOR_COLS = 14;
const DOOR_ROWS = 18;

type DoorPixel = {
 key: string;
 x: number;
 y: number;
 fill: string;
 dx: string;
 dy: string;
 delay: number;
};

const DOOR_PIXELS: DoorPixel[] = (() => {
 const out: DoorPixel[] = [];
 for (let r = 0; r < DOOR_ROWS; r++) {
  for (let c = 0; c < DOOR_COLS; c++) {
   const frame = r === 0 || r === DOOR_ROWS - 1 || c === 0 || c === DOOR_COLS - 1;
   const i = r * DOOR_COLS + c;
   const dist = 80 + rnd(i, 5) * 210;
   const angle = Math.PI * (0.7 + rnd(i, 2));
   out.push({
    key: `${r}-${c}`,
    x: c,
    y: r,
    fill: frame ? 'var(--tiro)' : 'var(--lp-ink)',
    dx: `${Math.round(Math.cos(angle) * dist)}px`,
    dy: `${Math.round(Math.sin(angle) * dist)}px`,
    delay: Math.round(60 + rnd(i, 6) * 540 + (r / DOOR_ROWS) * 200),
   });
  }
 }
 return out;
})();

const shadowD = `M${GUARD_COLS/2} ${GUARD_ROWS-4}a${GUARD_COLS/2-1} 1 0 0 1 ${-(GUARD_COLS-2)} 0a${GUARD_COLS/2-1} 1 0 0 1 ${GUARD_COLS-2} 0z`;

const GUARD_PATHS = guardSprites.map((s, i) => ({
 ...s,
 id: `guard-${i}`,
}));

const DUST = Array.from({ length: 14 }, (_, i) => ({
 left: `${Math.round(rnd(i, 1) * 86)}%`,
 top: `${Math.round(rnd(i, 2) * 55)}%`,
 duration: `${(3 + rnd(i, 3) * 6).toFixed(2)}s`,
 delay: `${rnd(i, 4) * 4}`,
}));

type SceneProps = {
 header?: React.ReactNode;
 hint?: string;
 primary?: React.ReactNode;
 secondary?: React.ReactNode;
};

export default function ForbiddenScene({ header, hint = 'Use suas credenciais do Kixi para acessar.', primary, secondary }: SceneProps) {
 const [talking, setTalking] = useState(false);
 const eyesRef = useRef<SVGGElement>(null);

 useEffect(() => {
  if (reducedMotion()) return;
  const eyes = eyesRef.current;
  if (!eyes) return;
  let raf = 0;
  const loop = () => {
   const rect = eyes.getBoundingClientRect();
   const cx = rect.left + eyes.clientWidth / 2;
   const cy = rect.top + eyes.clientHeight / 2;
   const dx = (window.innerWidth / 2 - cx) / 6;
   const dy = (window.innerHeight / 2 - cy) / 6;
   eyes.style.transform = `translate(${clamp(dx, 8)}px, ${clamp(dy, 4)}px)`;
   raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => cancelAnimationFrame(raf);
 }, []);

 useEffect(() => {
  const el = document.querySelector('.rx403__guard');
  if (!el) return;
  const onMouseOver = () => setTalking(true);
  const onMouseOut = () => setTalking(false);
  el.addEventListener('mouseenter', onMouseOver);
  el.addEventListener('mouseleave', onMouseOut);
  return () => {
   el.removeEventListener('mouseenter', onMouseOver);
   el.removeEventListener('mouseleave', onMouseOut);
  };
 }, []);

 return (
  <div className="rx403" aria-label="ERRO 403 - Acesso restrito">
   <div className="rx403__panel">
    <div className="rx403__text">
     <h1 className="rx403__title">ERRO 403</h1>
     <p className="rx403__message">ÁREA RESTRITA</p>
     {header}
     <div className="rx403__scan" aria-hidden="true">
      <div className="rx403__scan-bar" />
     </div>
    </div>
    <div className="rx403__door">
     <svg viewBox={`0 0 ${DOOR_COLS} ${DOOR_ROWS}`} width={DOOR_COLS} height={DOOR_ROWS} aria-hidden="true">
      {DOOR_PIXELS.map(p => (
       <rect
        key={p.key}
        x={p.x}
        y={p.y}
        width={1}
        height={1}
        style={{
         fill: p.fill,
         '--dx': p.dx,
         '--dy': p.dy,
         animationDelay: `${p.delay}ms`,
        } as Vars}
       />
      ))}
     </svg>
     <span className="rx403__snap" aria-hidden="true" />
    </div>

    <div className="rx403__layer rx403__layer--guard">
     <div className={`rx403__guard${talking ? ' is-talking' : ''}`}>
      <svg
       viewBox={`0 0 ${GUARD_COLS} ${GUARD_ROWS}`}
       width={GUARD_COLS}
       height={GUARD_ROWS}
       aria-hidden="true"
      >
       <ellipse className="rx403__shadow" cx={GUARD_COLS/2} cy={GUARD_ROWS-4} rx={GUARD_COLS/2-1} ry={1} />
       <g className="rx403__body">
        {GUARD_PATHS.map(s => (
         <path key={s.id} d={s.d} style={{ fill: s.hex }} />
        ))}
       </g>
       <g ref={eyesRef} className="rx403__eyes" />
       <g className="rx403__feet" />
      </svg>
      <div className="rx403__speech rx403__rise">
       <div className="kx-card rx403__bubble">
        <p>
         {talking
          ? 'Você não tem permissão para acessar esta área. Solicite acesso ao administrador.'
          : 'Acesso negado.'}
        </p>
       </div>
      </div>
      <span className="rx403__tail" aria-hidden="true" />
     </div>
    </div>

    <div className="rx403__stamp rx403__rise" aria-hidden="true">
     <span className="rx403__stamp-text">RESTRITO</span>
    </div>

    <div className="rx403__dust">
     {DUST.map((d, i) => (
      <span
       key={i}
       className="rx403__dust-dot"
       style={{
        left: d.left,
        top: d.top,
        animationDelay: `${d.delay}s`,
        animationDuration: d.duration,
       }}
       aria-hidden="true"
      />
     ))}
    </div>

    <div className="rx403__cta rx403__rise">
     {primary}
     {secondary}
    </div>

    <div className="rx403__hint rx403__rise">{hint}</div>

    <footer className="rx403__foot">© 2026 alunos, para alunos.</footer>
   </div>
  </div>
 );
}
