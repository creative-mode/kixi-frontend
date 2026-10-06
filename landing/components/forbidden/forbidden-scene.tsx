'use client';

import { useEffect, useRef, useState } from 'react';

/** 403: a porta do Kixi. Cor, espaco e tipografia vem dos tokens da landing;
 *  os pixels seguem a mesma tecnica do prologo (grelha ASCII -> retangulos crisp). */

type Vars = React.CSSProperties & { [key: `--${string}`]: string };

const rnd = (i: number, k: number) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

const clamp = (v: number, a: number) => Math.max(-a, Math.min(a, v));
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TEXT = 'ERRO 403 · ÁREA RESTRITA';

/* ---------- porta: grelha de pixels que se montam sozinhos ---------- */

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
      const bar = c === 4 || c === 9;
      const rail = r === 7;
      const handle = r === 9 && c === DOOR_COLS - 3;
      const i = r * DOOR_COLS + c;
      const angle = rnd(i, 4) * Math.PI * 2;
      const dist = 70 + rnd(i, 5) * 210;
      out.push({
        key: `${r}-${c}`,
        x: c,
        y: r,
        fill: handle ? 'var(--tiro)' : frame || bar || rail ? 'var(--lp-ink)' : 'var(--paper-3)',
        dx: `${Math.round(Math.cos(angle) * dist)}px`,
        dy: `${Math.round(Math.sin(angle) * dist)}px`,
        delay: Math.round(60 + rnd(i, 6) * 540 + (r / DOOR_ROWS) * 200),
      });
    }
  }
  return out;
})();

/* ---------- guarda: bloco baixo e largo, topo em degraus ---------- */

const GUARD_COLS = 24;
const GUARD_ROWS = 14;

const GUARD = (() => {
  const g: string[][] = Array.from({ length: GUARD_ROWS }, () =>
    Array<string>(GUARD_COLS).fill(' '),
  );
  const steps: [number, number, number][] = [
    [0, 8, 15],
    [1, 6, 17],
    [2, 4, 19],
    [3, 2, 21],
  ];
  for (const [r, from, to] of steps) for (let c = from; c <= to; c++) g[r][c] = '#';
  for (let r = 4; r <= 11; r++) for (let c = 0; c < GUARD_COLS; c++) g[r][c] = '#';
  for (let r = 3; r <= 11; r++)
    for (let c = 19; c < GUARD_COLS; c++) if (g[r][c] !== ' ') g[r][c] = 'K';
  for (let r = 5; r <= 10; r++) {
    for (const [a, b] of [
      [7, 11],
      [13, 17],
    ]) {
      const row = r === 5 || r === 10 ? ['b', 'b', 'b', 'b', 'b'] : ['b', 'o', 'e', 'o', 'b'];
      for (let i = 0; i < 5; i++) g[r][a + i] = row[i];
    }
  }
  for (const x of [1, 5, 9, 13, 17, 21]) {
    for (const r of [12, 13]) {
      g[r][x] = 'f';
      g[r][x + 1] = 'f';
    }
  }
  return g;
})();

/** Mesma tecnica do prologo: runs horizontais da grelha viram um so path crisp. */
function pathOf(keep: string) {
  let d = '';
  for (let y = 0; y < GUARD_ROWS; y++) {
    const re = new RegExp(`[${keep}]+`, 'g');
    for (const m of GUARD[y].join('').matchAll(re)) {
      d += `M${m.index} ${y}h${m[0].length}v1h-${m[0].length}z`;
    }
  }
  return d;
}

const GUARD_BODY = pathOf('#');
const GUARD_VOID = pathOf('K');
const GUARD_RIM = pathOf('b');
const GUARD_WHITE = pathOf('o');
const GUARD_DIVIDER = pathOf('e');
const GUARD_FEET = pathOf('f');

const DUST = Array.from({ length: 14 }, (_, i) => ({
  left: `${Math.round(6 + rnd(i, 1) * 86)}%`,
  top: `${Math.round(40 + rnd(i, 2) * 55)}%`,
  delay: `${(rnd(i, 3) * 6).toFixed(2)}s`,
  duration: `${(5.5 + rnd(i, 7) * 4).toFixed(2)}s`,
}));

type ForbiddenSceneProps = {
  header?: React.ReactNode;
  hint: React.ReactNode;
  primary: React.ReactNode;
  secondary: React.ReactNode;
};

export function ForbiddenScene({ header, hint, primary, secondary }: ForbiddenSceneProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const [snapped, setSnapped] = useState(false);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [talking, setTalking] = useState(false);

  // sequencia: montagem -> estalo -> abertura -> maquina de escrever
  useEffect(() => {
    if (reducedMotion()) {
      setOpen(true);
      setTyped(TEXT);
      return;
    }
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => setSnapped(true), 1240),
      window.setTimeout(() => setSnapped(false), 1560),
      window.setTimeout(() => setOpen(true), 1560),
    );
    timers.push(
      window.setTimeout(() => {
        let i = 0;
        const id = window.setInterval(() => {
          i += 1;
          setTyped(TEXT.slice(0, i));
          if (i >= TEXT.length) window.clearInterval(id);
        }, 58);
        timers.push(id);
      }, 1900),
    );
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  // o guarda fala de vez em quando e remexe os pes
  useEffect(() => {
    if (reducedMotion()) return;
    let speaking = 0;
    let next = 0;
    const speak = () => {
      setTalking(true);
      speaking = window.setTimeout(() => {
        setTalking(false);
        next = window.setTimeout(speak, 2800 + Math.random() * 4200);
      }, 520 + Math.random() * 520);
    };
    const start = window.setTimeout(speak, 2600);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(speaking);
      window.clearTimeout(next);
    };
  }, []);

  // olhos que seguem o rato
  useEffect(() => {
    if (reducedMotion()) return;
    const onMove = (e: PointerEvent) => {
      const el = eyesRef.current;
      if (!el) return;
      const nx = (e.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      const ny = (e.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2;
      el.style.transform = `translate(${clamp(nx * 1.1, 1.2).toFixed(2)}px, ${clamp(ny * 0.8, 0.8).toFixed(2)}px)`;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // parallax por camadas, ao rato e ao scroll
  useEffect(() => {
    if (reducedMotion()) return;
    const stage = stageRef.current;
    if (!stage) return;
    const onMove = (e: PointerEvent) => {
      const r = stage.getBoundingClientRect();
      const x = ((e.clientX - r.left) / Math.max(r.width, 1) - 0.5) * 2;
      const y = ((e.clientY - r.top) / Math.max(r.height, 1) - 0.5) * 2;
      stage.style.setProperty('--mx', x.toFixed(3));
      stage.style.setProperty('--my', y.toFixed(3));
    };
    const onLeave = () => {
      stage.style.setProperty('--mx', '0');
      stage.style.setProperty('--my', '0');
    };
    let raf = 0;
    const onScroll = () => {
      window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(() => {
        const r = stage.getBoundingClientRect();
        const sy = clamp(-r.top / Math.max(window.innerHeight, 1), 1);
        stage.style.setProperty('--sy', sy.toFixed(3));
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <div className="rx403 kx-scope" data-theme="light">
      <a className="skip" href="#conteudo">
        Saltar para o conteúdo
      </a>
      {header}

      <div className="rx403__main" id="conteudo">
        <div className="rx403__stage" ref={stageRef}>
          <h1 className="rx403__layer rx403__layer--back">
            403<span className="sr-only">, acesso não permitido</span>
          </h1>

          <div className="rx403__layer rx403__layer--floor" aria-hidden="true" />

          <div className="rx403__layer rx403__layer--door">
            <div className={`rx403__door${open ? ' is-open' : ''}${snapped ? ' is-snap' : ''}`}>
              <div className="rx403__opening">
                <span className="rx403__typed" aria-hidden="true">
                  {typed}
                  {typed.length < TEXT.length ? <span className="rx403__caret" /> : null}
                </span>
                <span className="sr-only">{TEXT}</span>
              </div>
              <div className="rx403__leaf">
                <svg
                  viewBox={`0 0 ${DOOR_COLS} ${DOOR_ROWS}`}
                  width={DOOR_COLS}
                  height={DOOR_ROWS}
                  shapeRendering="crispEdges"
                  aria-hidden="true"
                  focusable="false"
                >
                  {DOOR_PIXELS.map((p) => (
                    <rect
                      key={p.key}
                      className="rx403__pix"
                      x={p.x}
                      y={p.y}
                      width={1}
                      height={1}
                      style={
                        {
                          fill: p.fill,
                          '--dx': p.dx,
                          '--dy': p.dy,
                          animationDelay: `${p.delay}ms`,
                        } as Vars
                      }
                    />
                  ))}
                </svg>
              </div>
              <span className="rx403__snap" aria-hidden="true" />
            </div>
          </div>

          <div className="rx403__layer rx403__layer--guard">
            <div className={`rx403__guard${talking ? ' is-talking' : ''}`}>
              <svg
                viewBox={`0 0 ${GUARD_COLS} ${GUARD_ROWS}`}
                width={GUARD_COLS}
                height={GUARD_ROWS}
                shapeRendering="crispEdges"
                aria-hidden="true"
                focusable="false"
              >
                <ellipse className="rx403__shadow" cx={12} cy={13.6} rx={10.5} ry={0.85} />
                <g className="rx403__body">
                  <path d={GUARD_BODY} style={{ fill: 'var(--guard-body)' }} />
                  <path d={GUARD_VOID} style={{ fill: 'var(--guard-void)' }} />
                  <path d={GUARD_RIM} style={{ fill: 'var(--guard-void)' }} />
                  <g ref={eyesRef} className="rx403__eyes">
                    <g className="rx403__blink">
                      <path d={GUARD_WHITE} style={{ fill: 'var(--guard-eye)' }} />
                      <path d={GUARD_DIVIDER} style={{ fill: 'var(--guard-eye-ink)' }} />
                    </g>
                  </g>
                </g>
                <g className="rx403__feet">
                  <path d={GUARD_FEET} style={{ fill: 'var(--guard-body)' }} />
                </g>
              </svg>

              <div className="rx403__speech rx403__rise" style={{ animationDelay: '1500ms' }}>
                <div className="kx-card rx403__bubble">
                  <p style={{ margin: 0 }}>Isto não é pra ti, baza.</p>
                </div>
                <span className="rx403__tail" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
              </div>
            </div>
          </div>

          <span
            className="rx403__stamp rx403__rise"
            aria-hidden="true"
            style={{ animationDelay: '1750ms' }}
          >
            Restrito
          </span>

          {DUST.map((d, i) => (
            <span
              key={i}
              className="rx403__dust"
              aria-hidden="true"
              style={{
                left: d.left,
                top: d.top,
                animationDelay: d.delay,
                animationDuration: d.duration,
              }}
            />
          ))}
          <span className="rx403__scan" aria-hidden="true" />
        </div>

        <div className="rx403__cta rx403__rise" style={{ animationDelay: '1900ms' }}>
          {primary}
          {secondary}
        </div>
        <p className="rx403__hint rx403__rise" style={{ animationDelay: '2050ms' }}>
          {hint}
        </p>
      </div>

      <footer className="rx403__foot">© 2026 Kixi. Feito por alunos, para alunos.</footer>
    </div>
  );
}
