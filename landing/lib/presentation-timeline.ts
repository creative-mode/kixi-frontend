/** Progresso 0..1 da apresentação → valores de pintura (sem React). */

export const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t: number) => t * t * (3 - 2 * t);

/** Último trecho do prólogo (q 0.84 → 0.92) segura as palavras finais. */
export const P0 = 0.35;

export type PresentationFrame = {
  p: number;
  q: number;
  p2: number;
  open: number;
  zoom: number;
  sc: number;
  f: number;
  yaws: number[];
  acts: number[];
  hero: number;
  off: number;
  reveal: number;
  eject: number;
  /** bridge, inside, 5 cenas, outro */
  vis: number[];
  prologueQ: number;
  showDemo: boolean;
  showGameboy: boolean;
};

export function deriveFrame(p: number): PresentationFrame {
  const q = clamp(p / P0);
  const p2 = clamp((p - P0) / (1 - P0));
  const open = smooth(clamp((p2 - 0.05) / 0.1)) * (1 - smooth(clamp((p2 - 0.78) / 0.1)));
  const zoom = smooth(clamp((p2 - 0.16) / 0.07)) * (1 - smooth(clamp((p2 - 0.76) / 0.1)));
  const sc = clamp(((p2 - 0.23) / 0.52) * 5, 0, 5);
  const sj = Math.min(4, Math.floor(sc));
  const f = sj === 0 ? 0 : sj - 1 + smooth(clamp((sc - sj) / 0.25));
  const turn = smooth(clamp((p2 - 0.78) / 0.12)) * 360;
  const yaws = [0, 1, 2, 3, 4].map((j) => ((smooth(clamp((sc - j - 0.1) / 0.5)) * 360 + turn) * Math.PI) / 180);
  const acts = [0, 1, 2, 3, 4].map(
    (j) => smooth(clamp((sc - j - 0.3) / 0.4)) * clamp((j + 1.1 - sc) / 0.2) * (open > 0.9 ? 1 : 0),
  );
  const hero = 1 - smooth(clamp(p / 0.03));
  const off = smooth(clamp((q - 0.87) / 0.06));
  const reveal = smooth(clamp((q - 0.95) / 0.05));
  const eject = smooth(clamp((q - 0.93) / 0.07));
  const scene = (j: number) => clamp((sc - j - 0.12) / 0.12) * clamp((j + 1 - sc) / 0.1);
  const vis = [
    clamp((q - 0.94) / 0.06) * (1 - clamp((p2 - 0.03) / 0.03)),
    clamp((p2 - 0.07) / 0.04) * clamp((0.205 - p2) / 0.03),
    scene(0),
    scene(1),
    scene(2),
    scene(3),
    scene(4),
    clamp((p2 - 0.85) / 0.05),
  ];
  return {
    p,
    q,
    p2,
    open,
    zoom,
    sc,
    f,
    yaws,
    acts,
    hero,
    off,
    reveal,
    eject,
    vis,
    prologueQ: Math.min(1, q / 0.84),
    showDemo: p < 0.004,
    showGameboy: eject < 1,
  };
}

export function progressFromRect(top: number, height: number, viewH: number): number {
  const span = height - viewH;
  if (span <= 0) return 0;
  return clamp(-top / span);
}
