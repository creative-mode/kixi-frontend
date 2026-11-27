/* Logótipo do Kixi: a nave e a palavra KIXI na mesma grelha de pixels (por omissão) ou a
   nave desenhada à mão (`variant="original"`). É o único componente do antigo pacote
   «Kixi design system v6» que a landing usava; o resto (botões, HUD, ranking...) saiu
   na adequação ao design system da nova experiência. Estilos em styles/kixi.css. */

const MARK = "M1795.2 1688.2C1836.0 1652.1 1877.7 1615.1 1888.0 1606.0C2003.8 1503.4 2072.0 1442.8 2072.0 1442.2C2072.0 1441.8 2062.2 1438.2 2050.2 1434.1C1624.6 1290.1 1389.5 1146.1 1258.8 949.3C1124.1 746.5 1094.5 479.0 1159.6 54.1C1162.1 38.0 1163.9 24.6 1163.7 24.4C1163.5 24.1 1113.2 46.9 1051.9 74.9C990.6 102.9 893.2 147.4 835.5 173.8L730.5 221.9L730.6 230.7C730.7 235.5 731.5 252.6 732.4 268.5C740.1 409.6 737.1 534.3 723.4 642.5C685.5 943.5 568.1 1178.7 319.5 1452.0C247.9 1530.7 147.7 1629.8 42.5 1726.0C27.0 1740.2 24.5 1742.9 24.2 1745.7C24.0 1747.5 24.3 1749.0 24.7 1749.0C25.2 1749.0 33.9 1745.1 44.0 1740.4C472.9 1540.5 754.4 1473.5 1036.5 1504.1C1232.3 1525.3 1452.7 1604.1 1695.5 1739.8C1709.2 1747.5 1720.6 1753.8 1720.8 1753.9C1721.0 1754.0 1754.5 1724.4 1795.2 1688.2Z";
export const RETRO_MARK = "M12 0h1v1h-1zM10 1h3v1h-3zM8 2h5v1h-5zM8 3h5v1h-5zM8 4h5v1h-5zM8 5h5v1h-5zM8 6h5v1h-5zM8 7h5v1h-5zM8 8h5v1h-5zM8 9h6v1h-6zM7 10h7v1h-7zM7 11h8v1h-8zM6 12h10v1h-10zM6 13h11v1h-11zM5 14h14v1h-14zM4 15h18v1h-18zM3 16h21v1h-21zM3 17h4v1h-4zM14 17h9v1h-9zM1 18h2v1h-2zM17 18h5v1h-5zM19 19h1v1h-1z";
const RETRO_WORD = "M0 0h2v1h-2zM4 0h2v1h-2zM7 0h6v1h-6zM14 0h2v1h-2zM18 0h2v1h-2zM21 0h6v1h-6zM0 1h2v1h-2zM3 1h2v1h-2zM9 1h2v1h-2zM14 1h2v1h-2zM18 1h2v1h-2zM23 1h2v1h-2zM0 2h4v1h-4zM9 2h2v1h-2zM15 2h4v1h-4zM23 2h2v1h-2zM0 3h3v1h-3zM9 3h2v1h-2zM16 3h2v1h-2zM23 3h2v1h-2zM0 4h4v1h-4zM9 4h2v1h-2zM15 4h4v1h-4zM23 4h2v1h-2zM0 5h2v1h-2zM3 5h2v1h-2zM9 5h2v1h-2zM14 5h2v1h-2zM18 5h2v1h-2zM23 5h2v1h-2zM0 6h2v1h-2zM4 6h2v1h-2zM7 6h6v1h-6zM14 6h2v1h-2zM18 6h2v1h-2zM21 6h6v1h-6z";

type GlyphProps = { size: number; title?: string };

function Mark({ size, title }: GlyphProps) {
  return (
    <svg viewBox="24 24 2048 1730" width={size} height={Math.round((size * 1730) / 2048)} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <path fill="currentColor" d={MARK} />
    </svg>
  );
}

function RetroMark({ size, title }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 20" width={size} height={Math.round((size * 20) / 24)} shapeRendering="crispEdges" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      <path fill="currentColor" d={RETRO_MARK} />
    </svg>
  );
}

function RetroWord({ height }: { height: number }) {
  return (
    <svg className="kx-logo__pixelword" viewBox="0 0 27 7" height={height} width={Math.round((height * 27) / 7)} shapeRendering="crispEdges" aria-hidden="true" focusable="false">
      <path fill="currentColor" d={RETRO_WORD} />
    </svg>
  );
}

export function Logo({ size = 48, wordmark = false, variant = 'retro', className }: {
  size?: number;
  wordmark?: boolean;
  variant?: 'retro' | 'original';
  className?: string;
}) {
  const retro = variant !== 'original';
  const Glyph = retro ? RetroMark : Mark;
  return (
    <span className={['kx-logo', className].filter(Boolean).join(' ')} style={retro ? { gap: `${Math.round((size * 3) / 24)}px` } : undefined}>
      <Glyph size={size} title={wordmark ? undefined : 'Kixi'} />
      {wordmark && (retro
        ? <RetroWord height={Math.max(7, Math.round((size * 7) / 24))} />
        : <span className="kx-logo__word" style={{ fontSize: `${Math.round(size * 0.5)}px` }}>Kixi</span>)}
    </span>
  );
}
