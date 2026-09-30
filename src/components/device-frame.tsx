"use client"

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react"
import { usePathname, useRouter } from "next/navigation"
import { BatteryFullIcon, SignalIcon, WifiIcon } from "lucide-react"

import { replay, watch, type MirrorEvent } from "@/components/frame-mirror"
import { TileNotes } from "@/components/tile-notes"
import { DeviceToggle, ThemeToggle, WorkbenchHeader, type Layout } from "@/components/workbench-header"
import { tileSlug, type TileInfo, type TileMessage } from "@/experiments/home/focus"
import { locate } from "@/experiments/registry"
import { cn } from "@/lib/utils"

// ---- Devices ---------------------------------------------------------------

type DeviceKind = "iphone" | "ipad"

type DeviceSpec = {
  label: string
  /** Logical screen size in CSS px (points). */
  width: number
  height: number
  radius: number
  bezel: number
}

export const DEVICES: Record<DeviceKind, DeviceSpec> = {
  iphone: { label: "iPhone 14 Pro", width: 393, height: 852, radius: 55, bezel: 14 },
  ipad: { label: "iPad Pro 11″ (landscape)", width: 1194, height: 834, radius: 18, bezel: 22 },
}

const outer = (d: DeviceSpec) => ({ width: d.width + d.bezel * 2, height: d.height + d.bezel * 2 })

const LAYOUT_KEY = "redfin:device-layout"

/** Largest the frames are drawn on desktop; they shrink further to fit the window. */
const DISPLAY_SCALE = 0.9
const DEVICE_GAP = 48
/** Room for the device name under each frame (not scaled). */
const LABEL_HEIGHT = 32

// ---- Mode detection --------------------------------------------------------

// Desktop-sized screen with a mouse/trackpad as the primary pointer. Touch devices (iPad, iPhone)
// always get the app itself, even when they're wide.
const FRAME_QUERY = "(min-width: 640px) and (pointer: fine)"

type DeviceMode = "frame" | "embedded" | "native"

function detectMode(): DeviceMode {
  if (window.self !== window.top) return "embedded"
  return window.matchMedia(FRAME_QUERY).matches ? "frame" : "native"
}

/**
 * Runs before paint (inlined in <head>) so the right layout shows without a flash:
 * - "frame": desktop top window — toolbar + device frames, the app runs in iframes
 * - "embedded": inside a frame's iframe — the app, with that device's faked safe areas
 *   (the iframe's `name` is the device kind)
 * - "native": a real phone / tablet (touch) or a narrow window — the app, full screen
 */
export const deviceModeScript = `(function(){try{var d=document.documentElement;if(window.self!==window.top){d.dataset.device="embedded";d.dataset.deviceKind=window.name}else{d.dataset.device=window.matchMedia(${JSON.stringify(FRAME_QUERY)}).matches?"frame":"native"}}catch(e){}})()`

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(FRAME_QUERY)
  const handler = () => {
    document.documentElement.dataset.device = detectMode()
    onChange()
  }
  mql.addEventListener("change", handler)
  return () => mql.removeEventListener("change", handler)
}

function useDeviceMode() {
  return useSyncExternalStore<DeviceMode | null>(subscribe, detectMode, () => null)
}

export function DeviceFrame({ children }: { children: React.ReactNode }) {
  const mode = useDeviceMode()

  return (
    <>
      {mode === "frame" ? <Workbench /> : <div data-slot="device-app">{children}</div>}
      {mode === "embedded" ? <FrameBridge /> : null}
    </>
  )
}

// ---- Cross-frame navigation + mirroring --------------------------------------
// Each device reports where it navigated; the workbench updates the address bar and
// the page dropdown, and tells the other device(s) to follow. Clicks, typing, and
// scrolling are relayed the same way so both devices stay in step.

type BridgeMessage =
  | { type: "redfin:navigated"; path: string }
  | { type: "redfin:navigate"; path: string }
  | { type: "redfin:mirror"; event: MirrorEvent }

function FrameBridge() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    window.parent.postMessage({ type: "redfin:navigated", path: pathname } satisfies BridgeMessage, window.location.origin)
  }, [pathname])

  useEffect(() => {
    const onMessage = (e: MessageEvent<BridgeMessage>) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === "redfin:navigate" && e.data.path !== window.location.pathname) router.push(e.data.path)
      else if (e.data?.type === "redfin:mirror") replay(e.data.event)
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [router])

  useEffect(
    () =>
      watch((event) =>
        window.parent.postMessage({ type: "redfin:mirror", event } satisfies BridgeMessage, window.location.origin)
      ),
    []
  )

  return null
}

// ---- Workbench (desktop) ----------------------------------------------------

function readLayout(): Layout {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY)
    if (saved === "iphone" || saved === "ipad" || saved === "both") return saved
  } catch {}
  return "iphone"
}

/** The page a focused tile lives on (its notes key is `<path>#<tile>`). */
const tilePage = (tile: TileInfo) => tile.key.split("#")[0]

/** `?tile=…&variant=…` for a selected tile, so the workbench URL links straight to it. */
function tileQuery(tile: TileInfo) {
  const name = tile.variants[tile.variant] ?? tile.variants[0]
  return `?tile=${tile.key.split("#")[1]}&variant=${tileSlug(name)}`
}

function Workbench() {
  const [layout, setLayout] = useState<Layout>(readLayout)
  const [path, setPath] = useState(() => window.location.pathname)
  // The tile focused inside the devices, shown in the notes panel below them.
  const [tile, setTile] = useState<TileInfo | null>(null)
  const frames = useRef<Map<DeviceKind, HTMLIFrameElement>>(new Map())
  const stage = useRef<HTMLDivElement>(null)
  const kinds: DeviceKind[] = layout === "both" ? ["iphone", "ipad"] : [layout]
  const scale = useFitScale(stage, kinds)
  const current = locate(path)

  useEffect(() => {
    const onMessage = (e: MessageEvent<BridgeMessage | TileMessage>) => {
      if (e.origin !== window.location.origin) return
      if (e.data?.type === "redfin:tile") {
        setTile(e.data.tile)
        return
      }
      if (e.data?.type === "redfin:mirror") {
        // Replay in every other device.
        const message = e.data
        frames.current.forEach((frame) => {
          if (frame.contentWindow !== e.source) frame.contentWindow?.postMessage(message, window.location.origin)
        })
        return
      }
      if (e.data?.type !== "redfin:navigated") return
      const { path } = e.data
      setPath(path)
      setTile((prev) => (prev && tilePage(prev) === path ? prev : null))
      window.history.replaceState(window.history.state, "", path)
      frames.current.forEach((frame) => {
        if (frame.contentWindow !== e.source) {
          frame.contentWindow?.postMessage({ type: "redfin:navigate", path } satisfies BridgeMessage, window.location.origin)
        }
      })
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  // Keep the address bar pointing at the selected tile and variant (or just the page when none is).
  useEffect(() => {
    const query = tile && tilePage(tile) === path ? tileQuery(tile) : ""
    if (window.location.pathname + window.location.search !== path + query) {
      window.history.replaceState(window.history.state, "", path + query)
    }
  }, [tile, path])

  function changeLayout(next: Layout) {
    setLayout(next)
    try {
      localStorage.setItem(LAYOUT_KEY, next)
    } catch {}
  }

  /** Send a tile message to every device. */
  function toFrames(message: TileMessage) {
    frames.current.forEach((frame) => frame.contentWindow?.postMessage(message, window.location.origin))
  }

  function goTo(next: string) {
    setPath(next)
    // Leaving the tile's page (another feature, variant, or tab) deselects it and closes its notes.
    if (tile && tilePage(tile) !== next) {
      setTile(null)
      toFrames({ type: "redfin:tile-close" })
    }
    window.history.replaceState(window.history.state, "", next)
    frames.current.forEach((frame) =>
      frame.contentWindow?.postMessage({ type: "redfin:navigate", path: next } satisfies BridgeMessage, window.location.origin)
    )
  }

  return (
    // The workbench background and device frames dim along with the device screen while a tile is
    // selected (frames restyle via `data-dimmed`).
    <div
      data-dimmed={tile ? "" : undefined}
      className={cn(
        "group/workbench flex h-dvh flex-col transition-colors duration-300",
        // Same strength as the in-app overlay (80% toward white in light mode, black in dark), so the
        // whole scene fades evenly.
        tile
          ? "bg-[color-mix(in_oklab,var(--color-muted)_20%,white)] dark:bg-[color-mix(in_oklab,var(--color-muted)_20%,black)]"
          : "bg-muted"
      )}
    >
      <WorkbenchHeader path={path} onNavigate={goTo} />

      <div
        ref={stage}
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
      >
        {/* Devices share a top edge, with their names underneath. */}
        <div className="flex items-start" style={{ gap: DEVICE_GAP * scale }}>
          {kinds.map((kind) => (
            <ScaledDevice
              key={kind}
              kind={kind}
              scale={scale}
              // A device mounting now (first load or a layout change) opens with the selected tile, if any.
              initialPath={path + window.location.search}
              statusBar={!current.feature.hideStatusBar}
              frameRef={(el) => {
                if (el) frames.current.set(kind, el)
                else frames.current.delete(kind)
              }}
            />
          ))}
        </div>

        {/* Floats over the bottom of the stage so the devices don't move or resize when it opens. */}
        {tile ? (
          <TileNotes
            tile={tile}
            onVariant={(variant) => toFrames({ type: "redfin:tile-variant", key: tile.key, variant })}
            onClose={() => toFrames({ type: "redfin:tile-close" })}
          />
        ) : null}
      </div>

      {/* Bottom bar: appearance on the left, device layout on the right. */}
      <div className="flex shrink-0 items-center justify-between px-5 pt-2 pb-5">
        <ThemeToggle />
        <DeviceToggle layout={layout} onChange={changeLayout} />
      </div>
    </div>
  )
}

/** Scale that fits the chosen device(s) side by side inside the stage. */
function useFitScale(stage: React.RefObject<HTMLDivElement | null>, kinds: DeviceKind[]) {
  const [scale, setScale] = useState(DISPLAY_SCALE)
  const key = kinds.join(",")

  useLayoutEffect(() => {
    const el = stage.current
    if (!el) return
    const sizes = key.split(",").map((k) => outer(DEVICES[k as DeviceKind]))
    const totalW = sizes.reduce((sum, s) => sum + s.width, 0) + DEVICE_GAP * (sizes.length - 1)
    const maxH = Math.max(...sizes.map((s) => s.height))
    const update = () => {
      const pad = 48
      setScale(Math.min(DISPLAY_SCALE, (el.clientWidth - pad) / totalW, (el.clientHeight - pad - LABEL_HEIGHT) / maxH))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [stage, key])

  return scale
}

/** Reserves the scaled footprint in layout, then draws the full-size device scaled into it. */
function ScaledDevice({
  kind,
  scale,
  initialPath,
  statusBar,
  frameRef,
}: {
  kind: DeviceKind
  scale: number
  initialPath: string
  statusBar: boolean
  frameRef: (el: HTMLIFrameElement | null) => void
}) {
  const size = outer(DEVICES[kind])
  // The iframe keeps its own history after mount; later navigation arrives via postMessage.
  const [src] = useState(initialPath)

  return (
    <figure className="shrink-0">
      <div style={{ width: size.width * scale, height: size.height * scale }}>
        <div style={{ width: size.width, height: size.height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {kind === "iphone" ? (
            <IPhone src={src} statusBar={statusBar} frameRef={frameRef} />
          ) : (
            <IPad src={src} statusBar={statusBar} frameRef={frameRef} />
          )}
        </div>
      </div>
      <figcaption
        className="flex items-end justify-center text-sm text-muted-foreground transition-opacity duration-300 group-data-dimmed/workbench:opacity-30"
        style={{ height: LABEL_HEIGHT }}
      >
        {DEVICES[kind].label}
      </figcaption>
    </figure>
  )
}

type FrameProps = { src: string; statusBar: boolean; frameRef: (el: HTMLIFrameElement | null) => void }

function IPhone({ src, statusBar, frameRef }: FrameProps) {
  const d = DEVICES.iphone
  return (
    <div
      className="relative size-full rounded-[69px] bg-neutral-900 shadow-2xl ring-1 ring-neutral-700 transition-[background-color,box-shadow] duration-300 dark:ring-neutral-600 group-data-dimmed/workbench:bg-[color-mix(in_oklab,var(--color-neutral-900)_20%,white)] group-data-dimmed/workbench:shadow-none group-data-dimmed/workbench:ring-transparent dark:group-data-dimmed/workbench:bg-[color-mix(in_oklab,var(--color-neutral-900)_20%,black)] dark:group-data-dimmed/workbench:ring-transparent"
      style={{ padding: d.bezel }}
    >
      {/* Side buttons */}
      <span className="absolute top-[180px] -left-[3px] h-8 w-[3px] rounded-l bg-neutral-700 transition-opacity duration-300 group-data-dimmed/workbench:opacity-20" />
      <span className="absolute top-[240px] -left-[3px] h-16 w-[3px] rounded-l bg-neutral-700 transition-opacity duration-300 group-data-dimmed/workbench:opacity-20" />
      <span className="absolute top-[320px] -left-[3px] h-16 w-[3px] rounded-l bg-neutral-700 transition-opacity duration-300 group-data-dimmed/workbench:opacity-20" />
      <span className="absolute top-[260px] -right-[3px] h-24 w-[3px] rounded-r bg-neutral-700 transition-opacity duration-300 group-data-dimmed/workbench:opacity-20" />

      <div className="relative size-full overflow-hidden bg-background" style={{ borderRadius: d.radius }}>
        <iframe ref={frameRef} name="iphone" src={src} title={`${d.label} preview`} className="size-full border-0" />

        {/* Status bar + Dynamic Island + home indicator overlay the app like the real OS does. */}
        {statusBar ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[59px] items-center justify-between px-8 pt-1 text-foreground">
            <span className="w-[100px] text-center text-[17px] font-semibold tracking-tight">9:41</span>
            <span className="flex w-[100px] items-center justify-center gap-1.5">
              <SignalIcon className="size-[17px]" strokeWidth={2.5} />
              <WifiIcon className="size-[17px]" strokeWidth={2.5} />
              <BatteryFullIcon className="size-6" strokeWidth={2} />
            </span>
          </div>
        ) : null}
        <div className="pointer-events-none absolute top-[11px] left-1/2 h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black" />
        <div className="pointer-events-none absolute bottom-2 left-1/2 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-foreground" />
      </div>
    </div>
  )
}

function IPad({ src, statusBar, frameRef }: FrameProps) {
  const d = DEVICES.ipad
  return (
    <div
      className="relative size-full rounded-[40px] bg-neutral-900 shadow-2xl ring-1 ring-neutral-700 transition-[background-color,box-shadow] duration-300 dark:ring-neutral-600 group-data-dimmed/workbench:bg-[color-mix(in_oklab,var(--color-neutral-900)_20%,white)] group-data-dimmed/workbench:shadow-none group-data-dimmed/workbench:ring-transparent dark:group-data-dimmed/workbench:bg-[color-mix(in_oklab,var(--color-neutral-900)_20%,black)] dark:group-data-dimmed/workbench:ring-transparent"
      style={{ padding: d.bezel }}
    >
      {/* Landscape: top button on the left edge, volume buttons on top, camera centered on the top bezel */}
      <span className="absolute top-[90px] -left-[3px] h-16 w-[3px] rounded-l bg-neutral-700 transition-opacity duration-300 group-data-dimmed/workbench:opacity-20" />
      <span className="absolute -top-[3px] left-[110px] h-[3px] w-14 rounded-t bg-neutral-700 transition-opacity duration-300 group-data-dimmed/workbench:opacity-20" />
      <span className="absolute -top-[3px] left-[180px] h-[3px] w-14 rounded-t bg-neutral-700 transition-opacity duration-300 group-data-dimmed/workbench:opacity-20" />
      <span className="absolute top-[8px] left-1/2 size-[7px] -translate-x-1/2 rounded-full bg-neutral-700 transition-opacity duration-300 group-data-dimmed/workbench:opacity-20" />

      <div className="relative size-full overflow-hidden bg-background" style={{ borderRadius: d.radius }}>
        <iframe ref={frameRef} name="ipad" src={src} title={`${d.label} preview`} className="size-full border-0" />

        {statusBar ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex h-6 items-center justify-between px-6 text-[13px] font-semibold text-foreground">
            <span>9:41 Tue Sep 29</span>
            <span className="flex items-center gap-1.5">
              <WifiIcon className="size-[15px]" strokeWidth={2.5} />
              <span className="font-medium">100%</span>
              <BatteryFullIcon className="size-5" strokeWidth={2} />
            </span>
          </div>
        ) : null}
        <div className="pointer-events-none absolute bottom-2 left-1/2 h-[5px] w-[400px] -translate-x-1/2 rounded-full bg-foreground" />
      </div>
    </div>
  )
}
