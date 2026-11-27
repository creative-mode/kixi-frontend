import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { RETRO_MARK } from '@/components/kixi';

export const alt = 'Kixi: provas reais, simulações e um tutor de IA, num só sítio.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/* Cores do design system (design-system/tokens.css). A imagem é gerada fora do browser,
   por isso não lê as variáveis CSS: os valores ficam aqui, iguais aos tokens. */
const PRIMARY = '#1f5a2c';
const FOREGROUND = '#121c15';
const MUTED_FOREGROUND = '#617066';
const ACCENT = '#f1f6ee';

/** Cartão para partilhas: fundo branco, a nave da marca, o título e a promessa. */
export default async function Image() {
  const sans = await readFile(join(process.cwd(), 'assets/og/plus-jakarta-sans-700.ttf'));
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: 'white', color: FOREGROUND, fontFamily: 'Jakarta', borderBottom: `24px solid ${ACCENT}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 40, color: FOREGROUND }}>
          <svg viewBox="0 0 24 20" width={60} height={50} style={{ color: PRIMARY }} shapeRendering="crispEdges">
            <path fill={PRIMARY} d={RETRO_MARK} />
          </svg>
          Kixi
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', fontSize: 88, lineHeight: 1.04, letterSpacing: -4 }}>Estuda a prova que vai mesmo sair.</div>
          <div style={{ display: 'flex', fontSize: 34, color: MUTED_FOREGROUND }}>Provas reais, simulações e um tutor que explica cada questão.</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Jakarta', data: sans, weight: 700, style: 'normal' }],
    },
  );
}
