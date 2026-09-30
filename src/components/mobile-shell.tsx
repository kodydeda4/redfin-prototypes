import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"

import { FullscreenToggle } from "@/components/fullscreen-toggle"
import { ModeToggle } from "@/components/mode-toggle"
import { Button } from "@/components/ui/button"

/** Full-screen phone app layout. Pads the top safe area; pages pad the bottom with `--safe-bottom` so their backgrounds reach the edge. */
export function MobileShell({
  title,
  backHref,
  children,
}: {
  title: string
  backHref?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-[calc(4.5rem+var(--safe-top))] shrink-0 items-center gap-2 border-b bg-background/80 px-3 pt-(--safe-top) backdrop-blur">
        {backHref ? (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            nativeButton={false}
            render={<Link href={backHref} />}
          >
            <ChevronLeftIcon />
          </Button>
        ) : null}
        <h1 className="flex-1 truncate text-lg font-semibold">{title}</h1>
        <FullscreenToggle />
        <ModeToggle />
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        {children}
      </main>
    </div>
  )
}
