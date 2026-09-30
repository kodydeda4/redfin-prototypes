"use client"

import { useSyncExternalStore } from "react"
import { Maximize2Icon, Minimize2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

// Safari on iPad still exposes the prefixed Fullscreen API.
type FullscreenDocument = Document & {
  webkitFullscreenEnabled?: boolean
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}
type FullscreenElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

const doc = () => document as FullscreenDocument

function subscribe(onChange: () => void) {
  document.addEventListener("fullscreenchange", onChange)
  document.addEventListener("webkitfullscreenchange", onChange)
  return () => {
    document.removeEventListener("fullscreenchange", onChange)
    document.removeEventListener("webkitfullscreenchange", onChange)
  }
}

/** false on iPhone Safari (fullscreen is video-only there). Inside the desktop preview frames it's hidden via CSS. */
const isSupported = () => Boolean(document.fullscreenEnabled || doc().webkitFullscreenEnabled)
const isFullscreen = () => Boolean(document.fullscreenElement ?? doc().webkitFullscreenElement)

function toggleFullscreen() {
  if (isFullscreen()) {
    if (document.exitFullscreen) void document.exitFullscreen()
    else void doc().webkitExitFullscreen?.()
    return
  }
  const root = document.documentElement as FullscreenElement
  if (root.requestFullscreen) void root.requestFullscreen()
  else void root.webkitRequestFullscreen?.()
}

/**
 * Enter/exit fullscreen (e.g. on iPad). Renders nothing where the browser can't go fullscreen.
 * `compact` is the regular toolbar size used by the desktop workbench; the default is sized for the app's large text.
 */
export function FullscreenToggle({ className, compact = false }: { className?: string; compact?: boolean }) {
  const supported = useSyncExternalStore(subscribe, isSupported, () => false)
  const active = useSyncExternalStore(subscribe, isFullscreen, () => false)
  if (!supported) return null

  const Icon = active ? Minimize2Icon : Maximize2Icon
  return (
    <Button
      data-slot="fullscreen-toggle"
      variant={compact ? "outline" : "ghost"}
      size={compact ? "icon" : "default"}
      aria-label={active ? "Exit full screen" : "Full screen"}
      aria-pressed={active}
      onClick={toggleFullscreen}
      className={cn(!compact && "size-12 shrink-0 p-0", className)}
    >
      <Icon className={compact ? undefined : "size-7"} />
    </Button>
  )
}
