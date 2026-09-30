import { KeyRoundIcon, type LucideIcon } from "lucide-react"

export type VariantStatus = "live" | "ideation"

export type Variant = {
  slug: string
  title: string
  href: string
  /** Shipped in the product, or still an idea. Defaults to "ideation". */
  status?: VariantStatus
}

export type Feature = {
  slug: string
  title: string
  /** Lucide stand-in for the iOS app's SF Symbol (noted beside each entry). */
  icon: LucideIcon
  /** Versions of the feature; the workbench cycles between them. The first is the default. May be empty. */
  variants: Variant[]
  /** Hide the time and status icons in the workbench device frames while on this feature. */
  hideStatusBar?: boolean
}

/**
 * The app's categories, in sidebar order. Add a variant here plus its route under `src/app`.
 * `/` redirects to the first variant of the first feature that has one.
 */
export const features: Feature[] = [
  {
    slug: "authentication",
    title: "Authentication",
    icon: KeyRoundIcon /* key */,
    hideStatusBar: true,
    variants: [{ slug: "live", title: "Live", href: "/authentication/live", status: "live" }],
  },
]

const withVariants = features.filter((f) => f.variants.length > 0)

/** Where `/` lands. */
export const defaultHref = withVariants[0].variants[0].href

const matches = (path: string, href: string) => path === href || path.startsWith(`${href}/`)

/** The feature and variant a path belongs to, falling back to the first variant. */
export function locate(path: string): { feature: Feature; variant: Variant } {
  for (const feature of withVariants) {
    const variant = feature.variants.find((v) => matches(path, v.href))
    if (variant) return { feature, variant }
  }
  // A feature's bare path (e.g. /cdc-checklist) lands on its first variant.
  const feature = withVariants.find((f) => matches(path, `/${f.slug}`)) ?? withVariants[0]
  return { feature, variant: feature.variants[0] }
}
