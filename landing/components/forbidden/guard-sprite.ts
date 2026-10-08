/** Guard sprite: extracted from PNG, 8 dominant colors, regions by bounding boxes */

export const GUARD_COLS = 113;
export const GUARD_ROWS = 67;

export type GuardRegion = {
  key: 'body'|'eyes'|'feetL'|'feetR';
  paths: { hex: string; d: string }[];
};

// 8 dominant colors (AA merged into base)
const C_BODY = '#383838';
const C_BLACK3 = '#000003';
const C_WHITE = '#ffffff';
const C_DKGRAY = '#181819';
const C_DARK = '#2a2a2b';

// GUARD_BODY: corpo sem pés e sem olhos
export const GUARD_BODY: GuardRegion = {
  key: 'body',
  paths: [
    { hex: C_BODY, d: `
M22 0h47v1h-47z M0 49h8v1h-8z M102 49h11v1h-11z
M21 1h49v1h-49z M1 50h6v1h-6z M103 50h9v1h-9z
M20 2h50v1h-50z M0 51h6v1h-6z M104 51h7v1h-7z
M19 3h51v1h-51z M0 52h5v1h-5z M105 52h6v1h-6z
M18 4h52v1h-52z M0 53h5v1h-5z M106 53h5v1h-5z
M17 5h53v1h-53z M0 54h5v1h-5z M107 54h4v1h-4z
M16 6h54v1h-54z M0 55h4v1h-4z M108 55h3v1h-3z
M15 7h55v1h-55z M0 56h4v1h-4z M109 56h2v1h-2z
M14 8h56v1h-56z M0 57h3v1h-3z M110 57h1v1h-1z
M13 9h57v1h-57z M0 58h3v1h-3z M111 58h1v1h-1z
M12 10h58v1h-58z M0 59h3v1h-3z M112 59h1v1h-1z
M11 11h59v1h-59z M0 60h2v1h-2z
M10 12h60v1h-60z M0 61h2v1h-2z M109 61h1v1h-1z
M9 13h61v1h-61z M0 62h1v1h-1z M10 62h8v1h-8z M19 62h9v1h-9z M29 62h8v1h-8z M100 62h11v1h-11z M113 62h1v1h-1z
M8 14h62v1h-62z M10 63h8v1h-8z M19 63h9v1h-9z M29 63h8v1h-8z M100 63h11v1h-11z
M7 15h63v1h-63z M10 64h8v1h-8z M19 64h9v1h-9z M29 64h8v1h-8z M100 64h11v1h-11z
M6 16h64v1h-64z M10 65h8v1h-8z M19 65h9v1h-9z M29 65h8v1h-8z M100 65h11v1h-11z
M5 17h65v1h-65z M10 66h8v1h-8z M19 66h9v1h-9z M29 66h8v1h-8z M100 66h11v1h-11z
M4 18h66v1h-66z
M3 19h67v1h-67z
M2 20h68v1h-68z
M1 21h69v1h-69z
M0 22h70v1h-70z
` },
    { hex: C_BLACK3, d: `
M70 0h16v1h-16z
M71 1h14v1h-14z
M72 2h12v1h-12z
M73 3h10v1h-10z
M74 4h8v1h-8z
M75 5h6v1h-6z
M76 6h4v1h-4z
M77 7h2v1h-2z
` },
    { hex: C_WHITE, d: `
M21 58h1v1h-1z M109 58h1v1h-1z
M20 59h1v1h-1z M110 59h1v1h-1z
M19 60h1v1h-1z M111 60h1v1h-1z
M18 61h1v1h-1z M112 61h1v1h-1z
M17 62h1v1h-1z M113 62h1v1h-1z
` },
    { hex: C_DKGRAY, d: `
M86 12h15v1h-15z
` },
    { hex: C_DARK, d: `
M69 0h1v1h-1z
` },
    { hex: C_BODY, d: `
M26 58h1v1h-1z M35 58h1v1h-1z M78 58h1v1h-1z
` },
    { hex: C_BODY, d: `
M12 10h60v1h-60z
` },
    { hex: C_BODY, d: `
M13 9h57v1h-57z
` },
  ],
};

// GUARD_EYES: olhos (esquerdo e direito)
export const GUARD_EYES: GuardRegion = {
  key: 'eyes',
  paths: [
    { hex: C_BODY, d: `M32 30h6v1h-6z M38 30h5v1h-5z M43 30h4v1h-4z M70 30h10v1h-10z M80 30h1v1h-1z M81 30h4v1h-4z M32 31h6v1h-6z M38 31h5v1h-5z M43 31h4v1h-4z M70 31h10v1h-10z M80 31h1v1h-1z M81 31h4v1h-4z M32 32h6v1h-6z M38 32h5v1h-5z M43 32h4v1h-4z M70 32h10v1h-10z M80 32h1v1h-1z M81 32h4v1h-4z M32 33h6v1h-6z M38 33h5v1h-5z M43 33h4v1h-4z M70 33h10v1h-10z M80 33h1v1h-1z M81 33h4v1h-4z M32 34h6v1h-6z M38 34h5v1h-5z M43 34h4v1h-4z M70 34h10v1h-10z M80 34h1v1h-1z M81 34h4v1h-4z M32 35h6v1h-6z M38 35h5v1h-5z M43 35h4v1h-4z M70 35h10v1h-10z M80 35h1v1h-1z M81 35h4v1h-4z M32 36h6v1h-6z M38 36h5v1h-5z M43 36h4v1h-4z M70 36h10v1h-10z M80 36h1v1h-1z M81 36h4v1h-4z M32 37h6v1h-6z M38 37h5v1h-5z M43 37h4v1h-4z M70 37h10v1h-10z M80 37h1v1h-1z M81 37h4v1h-4z M32 38h6v1h-6z M38 38h5v1h-5z M43 38h4v1h-4z M70 38h10v1h-10z M80 38h1v1h-1z M81 38h4v1h-4z M32 39h6v1h-6z M38 39h5v1h-5z M43 39h4v1h-4z M70 39h10v1h-10z M80 39h1v1h-1z M81 39h4v1h-4z M32 40h6v1h-6z M38 40h5v1h-5z M43 40h4v1h-4z M70 40h10v1h-10z M80 40h1v1h-1z M81 40h4v1h-4z M32 41h6v1h-6z M38 41h5v1h-5z M43 41h4v1h-4z M70 41h10v1h-10z M80 41h1v1h-1z M81 41h4v1h-4z M32 42h6v1h-6z M38 42h5v1h-5z M43 42h4v1h-4z M70 42h10v1h-10z M80 42h1v1h-1z M81 42h4v1h-4z M32 43h6v1h-6z M38 43h5v1h-5z M43 43h4v1h-4z M70 43h10v1h-10z M80 43h1v1h-1z M81 43h4v1h-4z M32 44h6v1h-6z M38 44h5v1h-5z M43 44h4v1h-4z M70 44h10v1h-10z M80 44h1v1h-1z M81 44h4v1h-4z M32 45h6v1h-6z M38 45h5v1h-5z M43 45h4v1h-4z M70 45h10v1h-10z M80 45h1v1h-1z M81 45h4v1h-4z` },
    { hex: C_BLACK3, d: `M32 30h6v1h-6z M38 30h5v1h-5z M43 30h4v1h-4z M70 30h10v1h-10z M80 30h1v1h-1z M81 30h4v1h-4z M32 31h6v1h-6z M38 31h5v1h-5z M43 31h4v1h-4z M70 31h10v1h-10z M80 31h1v1h-1z M81 31h4v1h-4z M32 32h6v1h-6z M38 32h5v1h-5z M43 32h4v1h-4z M70 32h10v1h-10z M80 32h1v1h-1z M81 32h4v1h-4z M32 33h6v1h-6z M38 33h5v1h-5z M43 33h4v1h-4z M70 33h10v1h-10z M80 33h1v1h-1z M81 33h4v1h-4z M32 34h6v1h-6z M38 34h5v1h-5z M43 34h4v1h-4z M70 34h10v1h-10z M80 34h1v1h-1z M81 34h4v1h-4z M32 35h6v1h-6z M38 35h5v1h-5z M43 35h4v1h-4z M70 35h10v1h-10z M80 35h1v1h-1z M81 35h4v1h-4z M32 36h6v1h-6z M38 36h5v1h-5z M43 36h4v1h-4z M70 36h10v1h-10z M80 36h1v1h-1z M81 36h4v1h-4z M32 37h6v1h-6z M38 37h5v1h-5z M43 37h4v1h-4z M70 37h10v1h-10z M80 37h1v1h-1z M81 37h4v1h-4z M32 38h6v1h-6z M38 38h5v1h-5z M43 38h4v1h-4z M70 38h10v1h-10z M80 38h1v1h-1z M81 38h4v1h-4z M32 39h6v1h-6z M38 39h5v1h-5z M43 39h4v1h-4z M70 39h10v1h-10z M80 39h1v1h-1z M81 39h4v1h-4z M32 40h6v1h-6z M38 40h5v1h-5z M43 40h4v1h-4z M70 40h10v1h-10z M80 40h1v1h-1z M81 40h4v1h-4z M32 41h6v1h-6z M38 41h5v1h-5z M43 41h4v1h-4z M70 41h10v1h-10z M80 41h1v1h-1z M81 41h4v1h-4z M32 42h6v1h-6z M38 42h5v1h-5z M43 42h4v1h-4z M70 42h10v1h-10z M80 42h1v1h-1z M81 42h4v1h-4z M32 43h6v1h-6z M38 43h5v1h-5z M43 43h4v1h-4z M70 43h10v1h-10z M80 43h1v1h-1z M81 43h4v1h-4z M32 44h6v1h-6z M38 44h5v1h-5z M43 44h4v1h-4z M70 44h10v1h-10z M80 44h1v1h-1z M81 44h4v1h-4z M32 45h6v1h-6z M38 45h5v1h-5z M43 45h4v1h-4z M70 45h10v1h-10z M80 45h1v1h-1z M81 45h4v1h-4z` },
    { hex: C_WHITE, d: `M32 30h6v1h-6z M38 30h5v1h-5z M43 30h4v1h-4z M70 30h10v1h-10z M80 30h1v1h-1z M81 30h4v1h-4z M32 31h6v1h-6z M38 31h5v1h-5z M43 31h4v1h-4z M70 31h10v1h-10z M80 31h1v1h-1z M81 31h4v1h-4z M32 32h6v1h-6z M38 32h5v1h-5z M43 32h4v1h-4z M70 32h10v1h-10z M80 32h1v1h-1z M81 32h4v1h-4z M32 33h6v1h-6z M38 33h5v1h-5z M43 33h4v1h-4z M70 33h10v1h-10z M80 33h1v1h-1z M81 33h4v1h-4z M32 34h6v1h-6z M38 34h5v1h-5z M43 34h4v1h-4z M70 34h10v1h-10z M80 34h1v1h-1z M81 34h4v1h-4z M32 35h6v1h-6z M38 35h5v1h-5z M43 35h4v1h-4z M70 35h10v1h-10z M80 35h1v1h-1z M81 35h4v1h-4z M32 36h6v1h-6z M38 36h5v1h-5z M43 36h4v1h-4z M70 36h10v1h-10z M80 36h1v1h-1z M81 36h4v1h-4z M32 37h6v1h-6z M38 37h5v1h-5z M43 37h4v1h-4z M70 37h10v1h-10z M80 37h1v1h-1z M81 37h4v1h-4z M32 38h6v1h-6z M38 38h5v1h-5z M43 38h4v1h-4z M70 38h10v1h-10z M80 38h1v1h-1z M81 38h4v1h-4z M32 39h6v1h-6z M38 39h5v1h-5z M43 39h4v1h-4z M70 39h10v1h-10z M80 39h1v1h-1z M81 39h4v1h-4z M32 40h6v1h-6z M38 40h5v1h-5z M43 40h4v1h-4z M70 40h10v1h-10z M80 40h1v1h-1z M81 40h4v1h-4z M32 41h6v1h-6z M38 41h5v1h-5z M43 41h4v1h-4z M70 41h10v1h-10z M80 41h1v1h-1z M81 41h4v1h-4z M32 42h6v1h-6z M38 42h5v1h-5z M43 42h4v1h-4z M70 42h10v1h-10z M80 42h1v1h-1z M81 42h4v1h-4z M32 43h6v1h-6z M38 43h5v1h-5z M43 43h4v1h-4z M70 43h10v1h-10z M80 43h1v1h-1z M81 43h4v1h-4z M32 44h6v1h-6z M38 44h5v1h-5z M43 44h4v1h-4z M70 44h10v1h-10z M80 44h1v1h-1z M81 44h4v1h-4z M32 45h6v1h-6z M38 45h5v1h-5z M43 45h4v1h-4z M70 45h10v1h-10z M80 45h1v1h-1z M81 45h4v1h-4z` },
    { hex: C_DKGRAY, d: `M32 30h6v1h-6z M38 30h5v1h-5z M43 30h4v1h-4z M70 30h10v1h-10z M80 30h1v1h-1z M81 30h4v1h-4z M32 31h6v1h-6z M38 31h5v1h-5z M43 31h4v1h-4z M70 31h10v1h-10z M80 31h1v1h-1z M81 31h4v1h-4z M32 32h6v1h-6z M38 32h5v1h-5z M43 32h4v1h-4z M70 32h10v1h-10z M80 32h1v1h-1z M81 32h4v1h-4z M32 33h6v1h-6z M38 33h5v1h-5z M43 33h4v1h-4z M70 33h10v1h-10z M80 33h1v1h-1z M81 33h4v1h-4z M32 34h6v1h-6z M38 34h5v1h-5z M43 34h4v1h-4z M70 34h10v1h-10z M80 34h1v1h-1z M81 34h4v1h-4z M32 35h6v1h-6z M38 35h5v1h-5z M43 35h4v1h-4z M70 35h10v1h-10z M80 35h1v1h-1z M81 35h4v1h-4z M32 36h6v1h-6z M38 36h5v1h-5z M43 36h4v1h-4z M70 36h10v1h-10z M80 36h1v1h-1z M81 36h4v1h-4z M32 37h6v1h-6z M38 37h5v1h-5z M43 37h4v1h-4z M70 37h10v1h-10z M80 37h1v1h-1z M81 37h4v1h-4z M32 38h6v1h-6z M38 38h5v1h-5z M43 38h4v1h-4z M70 38h10v1h-10z M80 38h1v1h-1z M81 38h4v1h-4z M32 39h6v1h-6z M38 39h5v1h-5z M43 39h4v1h-4z M70 39h10v1h-10z M80 39h1v1h-1z M81 39h4v1h-4z M32 40h6v1h-6z M38 40h5v1h-5z M43 40h4v1h-4z M70 40h10v1h-10z M80 40h1v1h-1z M81 40h4v1h-4z M32 41h6v1h-6z M38 41h5v1h-5z M43 41h4v1h-4z M70 41h10v1h-10z M80 41h1v1h-1z M81 41h4v1h-4z M32 42h6v1h-6z M38 42h5v1h-5z M43 42h4v1h-4z M70 42h10v1h-10z M80 42h1v1h-1z M81 42h4v1h-4z M32 43h6v1h-6z M38 43h5v1h-5z M43 43h4v1h-4z M70 43h10v1h-10z M80 43h1v1h-1z M81 43h4v1h-4z M32 44h6v1h-6z M38 44h5v1h-5z M43 44h4v1h-4z M70 44h10v1h-10z M80 44h1v1h-1z M81 44h4v1h-4z M32 45h6v1h-6z M38 45h5v1h-5z M43 45h4v1h-4z M70 45h10v1h-10z M80 45h1v1h-1z M81 45h4v1h-4z` },
  ],
};

// GUARD_FEET_L: três pezinhos esquerda
export const GUARD_FEET_L: GuardRegion = {
  key: 'feetL',
  paths: [
    { hex: C_BODY, d: `
M0 62h8v1h-8z M13 62h8v1h-8z M27 62h8v1h-8z
M0 63h8v1h-8z M13 63h8v1h-8z M27 63h8v1h-8z
M0 64h8v1h-8z M13 64h8v1h-8z M27 64h8v1h-8z
M0 65h8v1h-8z M13 65h8v1h-8z M27 65h8v1h-8z
M0 66h8v1h-8z M13 66h8v1h-8z M27 66h8v1h-8z
` },
  ],
};

// GUARD_FEET_R: três pezinhos direita
export const GUARD_FEET_R: GuardRegion = {
  key: 'feetR',
  paths: [
    { hex: C_BODY, d: `
M79 62h8v1h-8z M92 62h9v1h-9z M106 62h7v1h-7z
M79 63h8v1h-8z M92 63h9v1h-9z M106 63h7v1h-7z
M79 64h8v1h-8z M92 64h9v1h-9z M106 64h7v1h-7z
M79 65h8v1h-8z M92 65h9v1h-9z M106 65h7v1h-7z
M79 66h8v1h-8z M92 66h9v1h-9z M106 66h7v1h-7z
` },
  ],
};

// Deprecated: keep for backward compat
export const guardSprites = [
  ...GUARD_BODY.paths,
  ...GUARD_EYES.paths,
  ...GUARD_FEET_L.paths,
  ...GUARD_FEET_R.paths,
];
