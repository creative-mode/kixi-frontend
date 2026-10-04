/** Image "upload" with no network: the file is shrunk in the browser and kept as a data URL.
 *  When the real storage (Cloudinary or the backend) is integrated, only this function changes. */
export async function uploadImage(file: File, maxSide = 1024): Promise<{ url: string; publicId: string }> {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Falha ao ler o ficheiro'));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Imagem inválida'));
    el.src = source;
  });

  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return { url: source, publicId: `mock/${file.name}` };
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
  return { url: canvas.toDataURL(type, 0.85), publicId: `mock/${Date.now()}-${file.name}` };
}
