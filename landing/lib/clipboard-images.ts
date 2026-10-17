/** O que se aproveita de uma área de transferência para a doação.
 *
 *  O `clipboardData` de um `paste` é uma lista de itens heterogéneos (texto, HTML, ficheiros).
 *  Só os ficheiros de imagem interessam; o resto é ignorado em silêncio — o clipboard não traz
 *  PDFs e colar texto num formulário não pode ser roubado ao campo. */

/** A forma mínima de um item que interessa, igual à de `DataTransferItem` no browser. */
export type ClipboardItem = { kind: string; type: string; getAsFile(): File | null };

/** As imagens coladas (Ctrl+V, captura de ecrã), prontas para a mesma via dos ficheiros escolhidos. */
export function imagesFrom(items: readonly ClipboardItem[]): File[] {
  const images: File[] = [];
  for (const item of items) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue;
    const file = item.getAsFile();
    if (file) images.push(file);
  }
  return images;
}
