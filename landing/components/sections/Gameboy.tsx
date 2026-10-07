/**
 * The original Game Boy (DMG-01), drawn as flat shapes with the same dark outline as the rest of the drawings.
 * Everything that is not the screen is SVG; the screen is an HTML box laid over the bezel so the story can play on it.
 */
const INK = '#1d1b2a';
const SHELL = '#cbc8ba';
const BEZEL = '#5b596e';
const BUTTON = '#a31f5c';

export function Gameboy({ children, eject = 0, center = 0, label }: { children: React.ReactNode; eject?: number; center?: number; label: string }) {
  return (
    <div className="gb" style={{ ['--ej' as string]: eject, ['--ctr' as string]: center, opacity: 1 - eject * 0.25 }}>
      <svg className="gb__body" viewBox="0 0 300 492" aria-hidden="true" focusable="false">
        {/* hard shadow, like the pixel buttons */}
        <path d="M18 14H292Q304 14 304 26V440A62 62 0 0 1 242 502H18Q6 502 6 490V26Q6 14 18 14Z" fill={INK} />
        <path d="M14 2H286Q298 2 298 14V428A62 62 0 0 1 236 490H14Q2 490 2 478V14Q2 2 14 2Z" fill={SHELL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        {/* bezel */}
        <path d="M20 20H280V206Q280 234 252 234H20Z" fill={BEZEL} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <g fontFamily="var(--font-sans)" fontWeight="700" fontSize="6" letterSpacing=".9" fill="#d9d8ea" textAnchor="middle">
          <text x="150" y="37">ESTUDA · DISPARA · DOMINA</text>
        </g>
        <path d="M28 33H66M28 37H66" stroke="#c0407a" strokeWidth="1.6" /><path d="M234 33H272M234 37H272" stroke="#5d77e0" strokeWidth="1.6" />
        <circle cx="38" cy="124" r="3.4" fill="#e0334f" stroke={INK} strokeWidth="1" />
        <text x="30" y="140" fontFamily="var(--font-sans)" fontWeight="700" fontSize="5" fill="#d9d8ea">BATTERY</text>
        {/* wordmark */}
        <text x="22" y="272" fontFamily="var(--font-sans)" fontWeight="700" fontSize="26" fill={INK} transform="skewX(-12) translate(58 0)" letterSpacing="1">KIXI</text>
        <text x="24" y="285" fontFamily="var(--font-sans)" fontWeight="700" fontSize="6" fill="#2f45a3" letterSpacing="1.2">SISTEMA DE ESTUDO</text>
        {/* d-pad */}
        <circle cx="64" cy="344" r="34" fill="#b9b6a8" />
        <path d="M52 322H76V332H86V356H76V366H52V356H42V332H52Z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        {/* A and B */}
        <g transform="rotate(-25 222 342)">
          <rect x="176" y="324" width="92" height="38" rx="19" fill="#b9b6a8" />
          <circle cx="198" cy="343" r="14.5" fill={BUTTON} stroke={INK} strokeWidth="2.5" />
          <circle cx="246" cy="343" r="14.5" fill={BUTTON} stroke={INK} strokeWidth="2.5" />
          <text x="198" y="376" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="700" fontSize="11" fill="#2f45a3">B</text>
          <text x="246" y="376" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="700" fontSize="11" fill="#2f45a3">A</text>
        </g>
        {/* select and start */}
        <g transform="rotate(-25 142 432)">
          <rect x="102" y="426" width="34" height="10" rx="5" fill="#7c7a8c" stroke={INK} strokeWidth="2" />
          <rect x="148" y="426" width="34" height="10" rx="5" fill="#7c7a8c" stroke={INK} strokeWidth="2" />
          <text x="119" y="450" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="700" fontSize="6" fill="#2f45a3" letterSpacing=".6">SELECT</text>
          <text x="165" y="450" textAnchor="middle" fontFamily="var(--font-sans)" fontWeight="700" fontSize="6" fill="#2f45a3" letterSpacing=".6">START</text>
        </g>
        {/* speaker */}
        <g transform="rotate(-28 262 440)" stroke="#8c8979" strokeWidth="3.6" strokeLinecap="round">
          {[0, 1, 2, 3, 4, 5].map((k) => <path key={k} d={`M${232 + k * 11} 418V462`} />)}
        </g>
      </svg>
      <div className="gb__lcd" role="img" aria-label={label}>
        {children}
      </div>
    </div>
  );
}
