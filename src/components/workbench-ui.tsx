"use client"

import type { LucideIcon } from "lucide-react"

import { features, sections, type Feature, type Variant, type VariantStatus } from "@/experiments/registry"
import { cn } from "@/lib/utils"

// Bits the workbench's header and Features sidebar share.

export const statusStyles: Record<VariantStatus, { label: string; className: string; dot: string }> = {
  live: {
    label: "Live",
    className: "bg-green-500/15 text-green-700 ring-green-600/25 dark:text-green-400",
    dot: "bg-green-500",
  },
  ideation: {
    label: "Ideation",
    className: "bg-yellow-400/20 text-yellow-800 ring-yellow-500/30 dark:text-yellow-300",
    dot: "bg-yellow-500",
  },
}

/** Monochrome app-icon tile: iOS corner radius, soft gradient, hairline edge. */
export function CategoryIcon({ icon: Icon, size = "lg", className }: { icon: LucideIcon; size?: "sm" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-[22.37%] bg-linear-to-b from-neutral-100 to-neutral-200 text-foreground shadow-sm outline outline-1 -outline-offset-1 outline-black/5 dark:from-neutral-700 dark:to-neutral-800 dark:outline-white/10",
        size === "lg" ? "size-14 [&_svg]:size-7" : "size-8 [&_svg]:size-4",
        className
      )}
    >
      <Icon strokeWidth={1.75} />
    </span>
  )
}

export type Result = { feature: Feature; variant: Variant }

/** Every variant matching `query` (by section, feature, or variant name), in registry order. */
export function search(query: string): Result[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  return features.flatMap((feature) =>
    feature.variants
      .filter((variant) => {
        const section = sections.find((s) => s.slug === feature.section)
        const haystack = `${section?.title ?? ""} ${feature.title} ${variant.title}`.toLowerCase()
        return terms.every((t) => haystack.includes(t))
      })
      .map((variant) => ({ feature, variant }))
  )
}
