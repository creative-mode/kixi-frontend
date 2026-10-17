import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const alt = 'Kixi: provas reais, simulações e um tutor de IA, num só sítio.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** Cartão para partilhas: o ecrã verde da consola com o nome e a promessa, nas letras da landing. */
export default async function Image() {
  const [sans, pixel] = await Promise.all([
    readFile(join(process.cwd(), 'assets/og/plus-jakarta-sans-700.ttf')),
    readFile(join(process.cwd(), 'assets/og/press-start-2p-400.ttf')),
  ]);
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 72, background: '#9bbc0f', color: '#0f380f', fontFamily: 'Jakarta' }}>
        <div style={{ display: 'flex', fontFamily: 'Pixel', fontSize: 36 }}>KIXI</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <div style={{ display: 'flex', fontSize: 92, lineHeight: 1.02, letterSpacing: -4 }}>E se estudar fosse... divertido?</div>
          <div style={{ display: 'flex', fontSize: 34, color: '#306230' }}>Provas reais, simulações e um tutor de IA, num só sítio.</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Jakarta', data: sans, weight: 700, style: 'normal' },
        { name: 'Pixel', data: pixel, weight: 400, style: 'normal' },
      ],
    },
  );
}
