/** A study "enemy": the 11x8 pixel invader from the design system. */
export const BUG_PATH = 'M2 0h1v1h-1zM8 0h1v1h-1zM3 1h5v1h-5zM2 2h7v1h-7zM1 3h2v1h-2zM4 3h3v1h-3zM8 3h2v1h-2zM0 4h11v1h-11zM0 5h1v1h-1zM2 5h7v1h-7zM10 5h1v1h-1zM2 6h1v1h-1zM8 6h1v1h-1zM1 7h2v1h-2zM8 7h2v1h-2z';

export function Bug({ className, width = 44 }: { className?: string; width?: number }) {
  return (
    <svg viewBox="0 0 11 8" width={width} height={Math.round((width * 8) / 11)} shapeRendering="crispEdges" aria-hidden="true" className={className}>
      <path fill="currentColor" d={BUG_PATH} />
    </svg>
  );
}
