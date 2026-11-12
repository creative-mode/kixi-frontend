'use client';

import { useRef, useState, type KeyboardEvent, type TouchEvent } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut } from 'lucide-react';
import { assetUrl } from '@/lib/assets';
import { nextIndex, previousIndex, swipeStep, type LightboxImage } from '@/lib/lightbox';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** A imagem ampliada, em ecrã inteiro, com a galeria à volta (#755).
 *
 *  É um `Dialog` do Radix: prende o foco dentro enquanto está aberto, fecha com Escape e
 *  devolve o foco ao botão que o abriu. As setas do teclado e o swipe passam de imagem; o
 *  botão de zoom troca entre «cabe no ecrã» e «tamanho real», com scroll quando não cabe.
 *
 *  Controlado: `index` é a imagem aberta (null fecha) e `onClose` é quem devolve o estado. */
export function ImageLightbox({ images, index, onClose, returnFocusTo }: {
  images: LightboxImage[];
  index: number | null;
  onClose: () => void;
  /** O botão que abriu o lightbox. O Radix devolve o foco ao `Trigger` dele; como a miniatura
   *  não é um Trigger, quem abre passa o elemento para o foco voltar ao mesmo sítio. */
  returnFocusTo?: HTMLElement | null;
}) {
  const fallbackOpener = useRef<HTMLElement | null>(null);
  return (
    <DialogPrimitive.Root open={index !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed inset-0 z-50 m-auto grid h-fit max-h-[94dvh] w-fit max-w-[96vw] grid-rows-[minmax(0,1fr)_auto] rounded-xl bg-black/35 text-white outline-none data-[state=open]:animate-in data-[state=open]:zoom-in-95"
          onOpenAutoFocus={() => {
            fallbackOpener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            (returnFocusTo ?? fallbackOpener.current)?.focus();
            fallbackOpener.current = null;
          }}
          onPointerDownOutside={onClose}
        >
          <DialogPrimitive.Title className="sr-only">Imagem ampliada</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">
            Usa as setas do teclado ou desliza para mudar de imagem. Escape fecha.
          </DialogPrimitive.Description>
          {index !== null && <Viewer images={images} start={index} onClose={onClose} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Viewer({ images, start, onClose }: { images: LightboxImage[]; start: number; onClose: () => void }) {
  const [at, setAt] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const [failed, setFailed] = useState(false);
  const touchX = useRef<number | null>(null);
  const many = images.length > 1;
  const image = images[at];

  const go = (next: number) => {
    setAt(next);
    setZoomed(false);
    setFailed(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowRight') { event.preventDefault(); go(nextIndex(at, images.length)); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(previousIndex(at, images.length)); }
    else if (event.key === 'Home') { event.preventDefault(); go(0); }
    else if (event.key === 'End') { event.preventDefault(); go(images.length - 1); }
  };

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => { touchX.current = event.touches[0]?.clientX ?? null; };
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const from = touchX.current;
    touchX.current = null;
    if (from === null || !many) return;
    const to = event.changedTouches[0]?.clientX;
    if (to == null) return;
    const step = swipeStep(to - from);
    if (step !== 0) go(step === 1 ? nextIndex(at, images.length) : previousIndex(at, images.length));
  };

  if (!image) return null;

  return (
    <div className="contents" onKeyDown={onKeyDown}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Fechar imagem"
        onClick={onClose}
        className="absolute top-2 right-2 z-10 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white"
      >
        <X aria-hidden />
      </Button>

      <div
        className={cn(
          'relative flex min-h-0',
          zoomed ? 'items-start justify-start overflow-auto' : 'items-center justify-center overflow-hidden',
        )}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {failed ? (
          <p role="alert" className="max-w-sm p-10 text-center text-sm text-white/85">
            Não foi possível abrir a imagem. Fecha e tenta outra vez.
          </p>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={assetUrl(image.url, 1280)}
            alt={image.alt?.trim() ?? ''}
            draggable={false}
            decoding="async"
            onError={() => setFailed(true)}
            className={cn('select-none', zoomed ? 'max-h-none max-w-none' : 'max-h-[80dvh] max-w-[96vw] object-contain')}
          />
        )}

        {many && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Imagem anterior"
              onClick={() => go(previousIndex(at, images.length))}
              className="absolute top-1/2 left-1 -translate-y-1/2 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white sm:left-2"
            >
              <ChevronLeft aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Imagem seguinte"
              onClick={() => go(nextIndex(at, images.length))}
              className="absolute top-1/2 right-1 -translate-y-1/2 rounded-full bg-black/55 text-white hover:bg-black/75 hover:text-white sm:right-2"
            >
              <ChevronRight aria-hidden />
            </Button>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 pt-2 pb-1 text-center">
        {image.caption && <p className="max-w-[70ch] text-sm text-white/90">{image.caption}</p>}
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={zoomed ? 'Reduzir zoom' : 'Aumentar zoom'}
            onClick={() => setZoomed((z) => !z)}
            className="size-9 rounded-full text-white hover:bg-white/15 hover:text-white"
          >
            {zoomed ? <ZoomOut aria-hidden /> : <ZoomIn aria-hidden />}
          </Button>
          {many && <p aria-live="polite">Imagem {at + 1} de {images.length}</p>}
        </div>
      </div>
    </div>
  );
}
