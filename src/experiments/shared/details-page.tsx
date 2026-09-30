"use client"

import { MusicIcon, PlayIcon, ShuffleIcon, StarIcon } from "lucide-react"

import { BackButton, ShellBackButton } from "@/experiments/sidebar/shell-back"
import { cn } from "@/lib/utils"

// The layout the album and artist pages share, after the macOS app: artwork over a blurred wash of
// itself, a title block with Play / Shuffle / favorite, then the page's own content underneath.
// Playback isn't prototyped yet, so Play and Shuffle don't do anything.

/**
 * A remote image that fades in once it has loaded, over whatever's behind it — no pop-in or flash
 * while it downloads. One that fails to load stays invisible, so the placeholder shows through. Keyed
 * on `src` so a new image fades in fresh. (Plain `<img>`: Jellyfin serves the art already sized, and
 * next/image would need every server's host allow-listed.)
 */
export function FadeImage({ src, className }: { src: string; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={src}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      // Already loaded (from cache) before React attached `onLoad`? Show it straight away.
      ref={(img) => {
        if (img?.complete && img.naturalWidth > 0) img.dataset.loaded = ""
      }}
      onLoad={(e) => {
        e.currentTarget.dataset.loaded = ""
      }}
      className={cn("opacity-0 transition-opacity duration-300 data-loaded:opacity-100", className)}
    />
  )
}

/** Square artwork (or a music-note placeholder) with a hairline edge. */
export function Artwork({ src, className }: { src?: string; className?: string }) {
  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden bg-muted outline outline-1 -outline-offset-1 outline-black/5 dark:outline-white/10",
        className,
      )}
    >
      {src ? (
        <FadeImage src={src} className="size-full object-cover" />
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground">
          <MusicIcon className="size-1/4" />
        </div>
      )}
    </div>
  )
}

export function DetailsPage({
  art,
  title,
  subtitle,
  meta,
  isFavorite,
  onToggleFavorite,
  backLabel,
  onBack,
  children,
}: {
  art?: string
  title: string
  /** In the accent color under the title — an album's artist. */
  subtitle?: string
  /** Small print under that — e.g. "Mallsoft · 2008". */
  meta?: string
  isFavorite: boolean
  onToggleFavorite: () => void
  /** The screen "back" returns to. Leave both out for a page opened straight from the sidebar — then
   *  it's the iPhone-only "back to the list" button instead. */
  backLabel?: string
  onBack?: () => void
  children: React.ReactNode
}) {
  return (
    <div className="relative min-h-0 flex-1 overflow-y-auto bg-background pb-(--safe-bottom)">
      {art ? (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[480px] overflow-hidden">
          <div className="size-full opacity-40">
            <FadeImage src={art} className="size-full scale-125 object-cover blur-3xl saturate-150" />
          </div>
          <div className="absolute inset-0 bg-linear-to-b from-background/20 via-background/60 to-background" />
        </div>
      ) : null}

      <div className="relative">
        <div className="sticky top-0 z-10 px-4 pt-(--safe-top)">
          {backLabel && onBack ? <BackButton label={backLabel} onClick={onBack} /> : <ShellBackButton />}
        </div>

        <header className="flex flex-col items-center gap-5 px-6 pt-2 pb-6 text-center md:flex-row md:items-end md:gap-8 md:px-8 md:text-left">
          <Artwork src={art} className="size-64 shrink-0 rounded-xl shadow-2xl md:size-56" />

          <div className="flex w-full min-w-0 flex-1 flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-balance md:text-3xl">{title}</h1>
            {subtitle ? <p className="text-xl text-red-500 md:text-2xl">{subtitle}</p> : null}
            {meta ? <p className="text-sm font-medium text-muted-foreground">{meta}</p> : null}

            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-foreground font-semibold text-background transition-opacity active:opacity-80 md:max-w-44"
              >
                <PlayIcon className="size-4 fill-current" />
                Play
              </button>
              <button
                type="button"
                className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-foreground/10 font-semibold backdrop-blur transition-colors hover:bg-foreground/15 md:max-w-44"
              >
                <ShuffleIcon className="size-4" />
                Shuffle
              </button>
              <button
                type="button"
                onClick={onToggleFavorite}
                aria-label={isFavorite ? "Undo Favorite" : "Favorite"}
                aria-pressed={isFavorite}
                className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground/10 backdrop-blur transition-colors hover:bg-foreground/15 md:ml-auto"
              >
                <StarIcon className={cn("size-5", isFavorite && "fill-current")} />
              </button>
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  )
}
