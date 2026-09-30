"use client"

import { createContext, useContext, useEffect, useEffectEvent, useState } from "react"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

// Click a card to spotlight it: everything else dims behind an overlay until you click
// the card again, click the dimmed area, press Esc, or switch tabs.
//
// Inside the workbench, the focused tile is reported to the parent window, which shows a
// notes panel below the devices and can switch the tile between its variants.
//
// Tiles can be linked to: `?tile=<slug>&variant=<variant slug>` on the page URL selects that tile
// (and variant) once it renders.

/** What the workbench's notes panel knows about the focused tile. */
export type TileInfo = {
  /** Notes key: the page path plus the tile's slug, e.g. "/home/live/chair-stand#total-time". */
  key: string
  title: string
  variants: string[]
  variant: number
}

/** Messages between a device frame and the workbench about the focused tile. */
export type TileMessage =
  | { type: "redfin:tile"; tile: TileInfo | null }
  | { type: "redfin:tile-variant"; key: string; variant: number }
  | { type: "redfin:tile-close" }

type Focused = { key: string; title: string; variants: string[] }

/** A tile (and variant) to select from the URL, until the matching tile renders and claims it. */
type Pending = { tile: string; variant: string | null }

type FocusState = {
  focused: Focused | null
  setFocused: (tile: Focused | null) => void
  variants: Record<string, number>
  setVariant: (key: string, variant: number) => void
  pending: Pending | null
  clearPending: () => void
}

const FocusContext = createContext<FocusState>({
  focused: null,
  setFocused: () => {},
  variants: {},
  setVariant: () => {},
  pending: null,
  clearPending: () => {},
})

function pendingFromUrl(): Pending | null {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  const tile = params.get("tile")
  return tile ? { tile, variant: params.get("variant") } : null
}

const inWorkbench = () => typeof window !== "undefined" && window.self !== window.top

/** Holds the focused tile and each tile's chosen variant, draws the dimming overlay, and talks to the workbench. */
export function FocusProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [focused, setFocused] = useState<Focused | null>(null)
  const [variants, setVariants] = useState<Record<string, number>>({})
  const [lastPath, setLastPath] = useState(pathname)
  // Only used in effects, so reading the URL here can't cause a hydration mismatch.
  const [pending, setPending] = useState<Pending | null>(pendingFromUrl)

  // Clear the spotlight when the tab changes (adjusting state during render, per React's guidance).
  if (lastPath !== pathname) {
    setLastPath(pathname)
    setFocused(null)
  }

  useEffect(() => {
    if (!focused) return
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setFocused(null)
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [focused])

  // Tell the workbench what's focused (and which variant it shows).
  useEffect(() => {
    if (!inWorkbench()) return
    const tile = focused ? { ...focused, variant: variants[focused.key] ?? 0 } : null
    window.parent.postMessage({ type: "redfin:tile", tile } satisfies TileMessage, window.location.origin)
  }, [focused, variants])

  // The workbench's panel switches variants and closes the spotlight.
  useEffect(() => {
    const onMessage = (e: MessageEvent<TileMessage>) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === "redfin:tile-variant") {
        const { key, variant } = e.data
        setVariants((v) => ({ ...v, [key]: variant }))
      } else if (e.data?.type === "redfin:tile-close") {
        setFocused(null)
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  return (
    <FocusContext.Provider
      value={{
        focused,
        setFocused,
        variants,
        setVariant: (key, variant) => setVariants((v) => ({ ...v, [key]: variant })),
        pending,
        clearPending: () => setPending(null),
      }}
    >
      {children}
      {/* Always rendered (just hidden) so the page's DOM matches across the mirrored devices. */}
      <div
        aria-hidden
        onClick={() => setFocused(null)}
        className={cn(
          // Light mode washes toward white, dark mode toward black.
          "fixed inset-0 z-40 bg-white/80 backdrop-blur-sm transition-opacity duration-200 dark:bg-black/80",
          focused ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      />
    </FocusContext.Provider>
  )
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

/**
 * For a tile: whether it's focused, which variant to show, and a click handler that focuses it
 * (or clears it if already focused). Tiles are identified by page + title.
 */
export function useFocusable(title: string, variantNames: string[], ref?: React.RefObject<HTMLElement | null>) {
  const pathname = usePathname()
  const { focused, setFocused, variants, setVariant, pending, clearPending } = useContext(FocusContext)
  const id = slug(title)
  const key = `${pathname}#${id}`
  const isFocused = focused?.key === key

  // Claim a `?tile=…&variant=…` link meant for this tile: select it, pick the variant, and scroll to it.
  const claim = useEffectEvent(() => {
    const index = pending?.variant ? variantNames.findIndex((name) => slug(name) === pending.variant) : -1
    if (index > 0) setVariant(key, index)
    setFocused({ key, title, variants: variantNames })
    clearPending()
    ref?.current?.scrollIntoView({ block: "center" })
  })
  useEffect(() => {
    if (pending?.tile === id) claim()
  }, [pending, id])

  return {
    isFocused,
    variant: Math.min(variants[key] ?? 0, variantNames.length - 1),
    toggle: () => setFocused(isFocused ? null : { key, title, variants: variantNames }),
  }
}

/** URL slug for a tile title or variant name ("Overall Mobility" → "overall-mobility"). */
export { slug as tileSlug }
