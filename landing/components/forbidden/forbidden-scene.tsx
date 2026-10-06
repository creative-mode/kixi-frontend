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

// Guard paths by region
const GUARD_BODY_PATHS = GUARD_BODY.paths.map((s, i) => ({ ...s, id: `guard-body-${i}` }));
const GUARD_EYES_PATHS = GUARD_EYES.paths.map((s, i) => ({ ...s, id: `guard-eyes-${i}` }));
const GUARD_FEET_L_PATHS = GUARD_FEET_L.paths.map((s, i) => ({ ...s, id: `guard-feet-l-${i}` }));
const GUARD_FEET_R_PATHS = GUARD_FEET_R.paths.map((s, i) => ({ ...s, id: `guard-feet-r-${i}` }));

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
 const [state, setState] = useState<'patrol'|'stop'|'look'|'talk'>('patrol');
 const [patrolDir, setPatrolDir] = useState(1); // 1 = right, -1 = left
 const [patrolPos, setPatrolPos] = useState(0); // -100 to 100
 const [talkText, setTalkText] = useState('');
 const [talkIndex, setTalkIndex] = useState(0);
 const eyesRef = useRef<SVGGElement>(null);
 const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

 // Texto do balão
 const TALK_MESSAGE = 'Isto não é pra ti, baza.';

 useEffect(() => {
  if (reducedMotion()) {
   // reduced-motion: guarda parado, olhando para o centro, balão sempre visível
   setState('look');
   setPatrolPos(0);
   setTalkText(TALK_MESSAGE);
   return;
  }

  // Guard follows cursor
  const eyes = eyesRef.current;
  if (eyes) {
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
  }
 }, []);

 // State machine: patrol → stop → look → talk → pause → patrol
 useEffect(() => {
  if (reducedMotion()) return;

  const runState = () => {
   if (state === 'patrol') {
    // Movimento lateral: -100 a 100 (centro ~0)
    // Move 1px por frame, aprox 60px/s
    const interval = setInterval(() => {
     setPatrolPos(prev => {
      const next = prev + patrolDir;
      if (next >= 100) {
       setPatrolDir(-1);
       return 100;
      } else if (next <= -100) {
       setPatrolDir(1);
       return -100;
      }
      return next;
     });
    }, 16); // ~60fps

    // Parar após ~10-15 segundos
    const stopDelay = 10000 + Math.random() * 5000;
    timerRef.current = setTimeout(() => {
     setState('stop');
    }, stopDelay);

    return () => {
     clearInterval(interval);
     if (timerRef.current) clearTimeout(timerRef.current);
    };
   }

   if (state === 'stop') {
    // Pausa aleatória 2-5 segundos
    const stopDuration = 2000 + Math.random() * 3000;
    timerRef.current = setTimeout(() => {
     setState('look');
    }, stopDuration);
    return () => {
     if (timerRef.current) clearTimeout(timerRef.current);
    };
   }

   if (state === 'look') {
    // Olha para o utilizador 2-4 segundos
    const lookDuration = 2000 + Math.random() * 2000;
    timerRef.current = setTimeout(() => {
     setState('talk');
     setTalkText('');
     setTalkIndex(0);
    }, lookDuration);
    return () => {
     if (timerRef.current) clearTimeout(timerRef.current);
    };
   }

   if (state === 'talk') {
    // Máquina de escrever
    let i = 0;
    const typeInterval = setInterval(() => {
     if (i < TALK_MESSAGE.length) {
      setTalkText(prev => prev + TALK_MESSAGE[i]);
      setTalkIndex(i + 1);
      i++;
     } else {
      clearInterval(typeInterval);
      // Manter balão 2.5 segundos
      timerRef.current = setTimeout(() => {
       // Pausa aleatória 3-8 segundos antes de voltar à patrulha
       const pauseDuration = 3000 + Math.random() * 5000;
       timerRef.current = setTimeout(() => {
        setState('patrol');
       }, pauseDuration);
      }, 2500);
     }
    }, 50); // velocidade da máquina de escrever

    return () => {
     clearInterval(typeInterval);
     if (timerRef.current) clearTimeout(timerRef.current);
    };
   }

   return;
  };

  const cleanup = runState();
  return () => {
   if (cleanup) cleanup();
   if (timerRef.current) clearTimeout(timerRef.current);
  };
 }, [state, patrolDir]);

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
     <div
      className={`rx403__guard${state === 'talk' ? ' is-talking' : ''}`}
      style={{
       transform: `translateX(${patrolPos}px)`,
      }}
     >
      <svg
       viewBox={`0 0 ${GUARD_COLS} ${GUARD_ROWS}`}
       width={GUARD_COLS}
       height={GUARD_ROWS}
       aria-hidden="true"
      >
       <ellipse className="rx403__shadow" cx={GUARD_COLS/2} cy={GUARD_ROWS-4} rx={GUARD_COLS/2-1} ry={1} />
       {/* Guard body (no feet, no eyes) */}
       <g className="rx403__body">
        {GUARD_BODY_PATHS.map(s => (
         <path key={s.id} d={s.d} style={{ fill: s.hex }} />
        ))}
       </g>
       {/* Guard eyes - follow cursor */}
       <g ref={eyesRef} className="rx403__eyes">
        {GUARD_EYES_PATHS.map(s => (
         <path key={s.id} d={s.d} style={{ fill: s.hex }} />
        ))}
       </g>
       {/* Guard feet - animated during patrol */}
       <g className="rx403__feet">
        {GUARD_FEET_L_PATHS.map(s => (
         <path key={s.id} d={s.d} style={{ fill: s.hex }} />
        ))}
        {GUARD_FEET_R_PATHS.map(s => (
         <path key={s.id} d={s.d} style={{ fill: s.hex }} />
        ))}
       </g>
      </svg>
      <div className="rx403__speech rx403__rise">
       <div className="kx-card rx403__bubble">
        <p>{state === 'talk' ? talkText : ''}</p>
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
