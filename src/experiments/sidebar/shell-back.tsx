"use client"

import { createContext, useContext } from "react"
import { ChevronLeftIcon } from "lucide-react"

import { cn } from "@/lib/utils"

// On iPhone the sidebar shell pushes each screen over its list. Rather than stacking its own bar on
// top, the shell hands the "back to the list" action down, and each screen puts `ShellBackButton` in
// its header — so a screen that pushes further (Albums → an album) never shows two back bars.

type ShellBack = { label: string; onBack: () => void }

export const ShellBackContext = createContext<ShellBack | null>(null)

/** An iOS-style back button: a chevron plus the previous screen's title, in the accent color. */
export function BackButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("-ml-2 flex h-11 items-center gap-0.5 pr-2 text-[17px] text-red-500", className)}
    >
      <ChevronLeftIcon className="size-6" />
      {label}
    </button>
  )
}

/**
 * Back to the sidebar list — iPhone only (the list is always beside the screen on iPad). Renders
 * nothing outside the shell, e.g. when a screen is shown on its own.
 */
export function ShellBackButton() {
  const back = useContext(ShellBackContext)
  if (!back) return null
  return <BackButton label={back.label} onClick={back.onBack} className="md:hidden" />
}
