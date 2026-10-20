import { BASE_PATH } from './base-path.ts';

/** As imagens enviadas vivem no backend, em `/uploads/...`. O browser pede-as ao endereço do aluno, e aí
 *  `/uploads` não existe (o gateway entregava o pedido à landing, 404). Servem-se por `/aluno/uploads/...`
 *  (app/uploads), que as lê do backend; esta função põe o prefixo. Endereços completos ficam como estão. */
export function assetUrl(url: string | null | undefined, width?: number): string | undefined {
  if (!url) return undefined;
  if (!url.startsWith('/uploads/')) return url;
  const sized = width && !url.includes('?') ? `${url}?w=${pickWidth(width)}` : url;
  return `${BASE_PATH}${sized}`;
}

/** As larguras que o backend sabe fazer (ImageVariants): fixas, para as variantes ficarem em poucas e a cache do browser as reaproveitar. */
export const IMAGE_WIDTHS = [48, 96, 192, 384, 768, 1280] as const;

/** A menor largura servida que cobre `cssPixels` num ecrã de densidade 2 (a maioria dos telemóveis); acima do máximo, o máximo. */
export function pickWidth(cssPixels: number, density = 2): number {
  const needed = Math.ceil(cssPixels * density);
  return IMAGE_WIDTHS.find((w) => w >= needed) ?? IMAGE_WIDTHS[IMAGE_WIDTHS.length - 1];
}
