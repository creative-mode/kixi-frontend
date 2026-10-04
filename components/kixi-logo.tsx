import { cn } from "@/lib/utils"

const RETRO_MARK = "M12 0h1v1h-1zM10 1h3v1h-3zM8 2h5v1h-5zM8 3h5v1h-5zM8 4h5v1h-5zM8 5h5v1h-5zM8 6h5v1h-5zM8 7h5v1h-5zM8 8h5v1h-5zM8 9h6v1h-6zM7 10h7v1h-7zM7 11h8v1h-8zM6 12h10v1h-10zM6 13h11v1h-11zM5 14h14v1h-14zM4 15h18v1h-18zM3 16h21v1h-21zM3 17h4v1h-4zM14 17h9v1h-9zM1 18h2v1h-2zM17 18h5v1h-5zM19 19h1v1h-1z"
const RETRO_WORD = "M0 0h2v1h-2zM4 0h2v1h-2zM7 0h6v1h-6zM14 0h2v1h-2zM18 0h2v1h-2zM21 0h6v1h-6zM0 1h2v1h-2zM3 1h2v1h-2zM9 1h2v1h-2zM14 1h2v1h-2zM18 1h2v1h-2zM23 1h2v1h-2zM0 2h4v1h-4zM9 2h2v1h-2zM15 2h4v1h-4zM23 2h2v1h-2zM0 3h3v1h-3zM9 3h2v1h-2zM16 3h2v1h-2zM23 3h2v1h-2zM0 4h4v1h-4zM9 4h2v1h-2zM15 4h4v1h-4zM23 4h2v1h-2zM0 5h2v1h-2zM3 5h2v1h-2zM9 5h2v1h-2zM14 5h2v1h-2zM18 5h2v1h-2zM23 5h2v1h-2zM0 6h2v1h-2zM4 6h2v1h-2zM7 6h6v1h-6zM14 6h2v1h-2zM18 6h2v1h-2zM21 6h6v1h-6z"

interface KixiLogoProps {
  /** Width of the ship in px; the wordmark scales with it. */
  size?: number
  wordmark?: boolean
  stacked?: boolean
  className?: string
}

/** Kixi retro 8-bit logo: the ship and the KIXI wordmark on one pixel grid (design system v6). */
export function KixiLogo({ size = 32, wordmark = false, stacked = false, className }: KixiLogoProps) {
  const wordHeight = Math.max(7, Math.round((size * 7) / 24))
  return (
    <span
      className={cn("inline-flex items-center leading-none", stacked && "flex-col", className)}
      style={{ gap: Math.round((size * 3) / 24) }}
    >
      <svg
        viewBox="0 0 24 20"
        width={size}
        height={Math.round((size * 20) / 24)}
        shapeRendering="crispEdges"
        role={wordmark ? undefined : "img"}
        aria-label={wordmark ? undefined : "Kixi"}
        aria-hidden={wordmark ? true : undefined}
        className="block flex-none text-primary"
      >
        <path fill="currentColor" d={RETRO_MARK} />
      </svg>
      {wordmark && (
        <svg
          viewBox="0 0 27 7"
          height={wordHeight}
          width={Math.round((wordHeight * 27) / 7)}
          shapeRendering="crispEdges"
          role="img"
          aria-label="Kixi"
          className="block flex-none text-foreground"
        >
          <path fill="currentColor" d={RETRO_WORD} />
        </svg>
      )}
    </span>
  )
}
