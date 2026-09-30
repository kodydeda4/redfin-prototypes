// Mirrors what you do in one workbench device onto the other: clicks, typing, and scrolling.
// Both devices render the same page (only CSS differs), so an element's position in the DOM
// tree identifies it in either frame. Scroll is mirrored as a fraction of the scrollable range,
// since the phone and iPad layouts have different heights.

export type MirrorEvent =
  | { kind: "click"; path: number[] }
  | { kind: "input"; path: number[]; value: string }
  | { kind: "scroll"; path: number[] | null; x: number; y: number }

/** Child-index path from <body> to `el`. */
function pathTo(el: Element): number[] | null {
  const path: number[] = []
  let node: Element | null = el
  while (node && node !== document.body) {
    const parent: Element | null = node.parentElement
    if (!parent) return null
    path.unshift(Array.prototype.indexOf.call(parent.children, node))
    node = parent
  }
  return node === document.body ? path : null
}

function resolve(path: number[]): Element | null {
  let node: Element | null = document.body
  for (const i of path) node = node?.children[i] ?? null
  return node
}

const scrollerOf = (target: EventTarget | null): Element | null =>
  target instanceof Element ? target : document.scrollingElement

const fraction = (pos: number, range: number) => (range > 0 ? pos / range : 0)

/** Scroll positions we just applied from the other device, so their scroll events aren't sent back. */
const applied = new WeakMap<Element, { x: number; y: number }>()

/** Start reporting this frame's clicks, typing, and scrolling. Returns a cleanup function. */
export function watch(send: (event: MirrorEvent) => void) {
  const onClick = (e: MouseEvent) => {
    // Only the person's own clicks; replayed ones are synthetic and must not bounce back.
    if (!e.isTrusted || !(e.target instanceof Element)) return
    const path = pathTo(e.target)
    if (path) send({ kind: "click", path })
  }

  const onInput = (e: Event) => {
    const el = e.target
    if (!e.isTrusted || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return
    if (el.type === "checkbox" || el.type === "radio") return // covered by the click
    const path = pathTo(el)
    if (path) send({ kind: "input", path, value: el.value })
  }

  let frame = 0
  let pending: Element | null = null
  const onScroll = (e: Event) => {
    const el = scrollerOf(e.target)
    if (!el) return
    const echo = applied.get(el)
    if (echo && Math.abs(el.scrollTop - echo.y) < 2 && Math.abs(el.scrollLeft - echo.x) < 2) return
    applied.delete(el)
    pending = el
    // One message per frame is plenty.
    if (!frame) {
      frame = requestAnimationFrame(() => {
        frame = 0
        const target = pending
        if (!target) return
        const path = target === document.scrollingElement ? null : pathTo(target)
        if (target !== document.scrollingElement && !path) return
        send({
          kind: "scroll",
          path,
          x: fraction(target.scrollLeft, target.scrollWidth - target.clientWidth),
          y: fraction(target.scrollTop, target.scrollHeight - target.clientHeight),
        })
      })
    }
  }

  document.addEventListener("click", onClick, true)
  document.addEventListener("input", onInput, true)
  document.addEventListener("scroll", onScroll, true)
  return () => {
    document.removeEventListener("click", onClick, true)
    document.removeEventListener("input", onInput, true)
    document.removeEventListener("scroll", onScroll, true)
    cancelAnimationFrame(frame)
  }
}

/** Replay an event from the other device in this frame. */
export function replay(event: MirrorEvent) {
  if (event.kind === "scroll") {
    const el = event.path ? resolve(event.path) : document.scrollingElement
    if (!el) return
    const x = event.x * (el.scrollWidth - el.clientWidth)
    const y = event.y * (el.scrollHeight - el.clientHeight)
    applied.set(el, { x, y })
    el.scrollTo({ left: x, top: y, behavior: "instant" })
    return
  }

  const el = resolve(event.path)
  if (!el) return

  if (event.kind === "click") {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }))
    return
  }

  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Go through the native setter so React sees the change.
    const proto = el instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype
    Object.getOwnPropertyDescriptor(proto, "value")?.set?.call(el, event.value)
    el.dispatchEvent(new Event("input", { bubbles: true }))
  }
}
