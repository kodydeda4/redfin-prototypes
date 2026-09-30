import {
  ClockIcon,
  DiscAlbumIcon,
  Grid3x3Icon,
  GuitarIcon,
  KeyRoundIcon,
  LibraryBigIcon,
  ListMusicIcon,
  MicVocalIcon,
  MusicIcon,
  SearchIcon,
  SettingsIcon,
  SquareStackIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react"

import type { PreviewKind } from "@/lib/jellyfin"

export type VariantStatus = "live" | "ideation"

export type Variant = {
  slug: string
  title: string
  href: string
  /** Shipped in the product, or still an idea. Defaults to "ideation". */
  status?: VariantStatus
  /** A details page: the workbench's Preview State gets a picker for which item it opens. */
  preview?: PreviewKind
}

/** A group of related features — one card in the workbench's feature dropdown. */
export type Section = {
  slug: string
  title: string
  icon: LucideIcon
}

/** The dropdown's sections, in order (the sidebar's order, bracketed by sign-in and settings). */
export const sections: Section[] = [
  { slug: "authentication", title: "Authentication", icon: KeyRoundIcon /* key */ },
  { slug: "search", title: "Search", icon: SearchIcon /* magnifyingglass */ },
  { slug: "recently-added", title: "Recently Added", icon: ClockIcon /* clock */ },
  { slug: "artists", title: "Artists", icon: MicVocalIcon /* music.microphone */ },
  { slug: "albums", title: "Albums", icon: SquareStackIcon /* square.stack */ },
  { slug: "songs", title: "Songs", icon: MusicIcon /* music.note */ },
  { slug: "genres", title: "Genres", icon: GuitarIcon /* guitars */ },
  { slug: "playlists", title: "Playlists", icon: ListMusicIcon /* music.note.list */ },
  { slug: "settings", title: "Settings", icon: SettingsIcon /* gearshape */ },
]

export type Feature = {
  slug: string
  title: string
  /** The `Section` it's listed under. */
  section: string
  /** Lucide stand-in for the iOS app's SF Symbol (noted beside each entry). */
  icon: LucideIcon
  /** Versions of the feature; the workbench cycles between them. The first is the default. May be empty. */
  variants: Variant[]
}

/**
 * The app's features, grouped under `sections` in the dropdown. Add a variant here plus its route
 * under `src/app`.
 * `/` redirects to the first variant of the first feature that has one.
 */
export const features: Feature[] = [
  {
    slug: "authentication",
    section: "authentication",
    title: "Login",
    icon: KeyRoundIcon /* key */,
    variants: [{ slug: "live", title: "Live", href: "/authentication/live", status: "live" }],
  },
  {
    slug: "search",
    section: "search",
    title: "Search",
    icon: SearchIcon /* magnifyingglass */,
    variants: [{ slug: "live", title: "Live", href: "/search/live", status: "live" }],
  },
  {
    slug: "recently-added",
    section: "recently-added",
    title: "Recently Added",
    icon: ClockIcon /* clock */,
    variants: [{ slug: "live", title: "Live", href: "/recently-added/live", status: "live" }],
  },
  {
    slug: "artists",
    section: "artists",
    title: "Artists",
    icon: MicVocalIcon /* music.microphone */,
    variants: [{ slug: "live", title: "Live", href: "/artists/live", status: "live" }],
  },
  {
    slug: "artist-details",
    section: "artists",
    title: "Artist Details",
    icon: UserRoundIcon /* person */,
    variants: [{ slug: "live", title: "Live", href: "/artist-details/live", status: "live", preview: "artist" }],
  },
  {
    slug: "albums",
    section: "albums",
    title: "Albums",
    icon: SquareStackIcon /* square.stack */,
    variants: [{ slug: "live", title: "Live", href: "/albums/live", status: "live" }],
  },
  {
    slug: "album-details",
    section: "albums",
    title: "Album Details",
    icon: DiscAlbumIcon /* opticaldisc */,
    variants: [{ slug: "live", title: "Live", href: "/album-details/live", status: "live", preview: "album" }],
  },
  {
    slug: "songs",
    section: "songs",
    title: "Songs",
    icon: MusicIcon /* music.note */,
    variants: [{ slug: "live", title: "Live", href: "/songs/live", status: "live" }],
  },
  {
    slug: "genres",
    section: "genres",
    title: "Genres",
    icon: GuitarIcon /* guitars */,
    variants: [{ slug: "live", title: "Live", href: "/genres/live", status: "live" }],
  },
  {
    slug: "genre-details",
    section: "genres",
    title: "Genre Details",
    icon: LibraryBigIcon /* books.vertical */,
    variants: [{ slug: "live", title: "Live", href: "/genre-details/live", status: "live", preview: "genre" }],
  },
  {
    slug: "playlists",
    section: "playlists",
    title: "Playlists",
    icon: Grid3x3Icon /* square.grid.3x3 */,
    variants: [{ slug: "live", title: "Live", href: "/playlists/live", status: "live" }],
  },
  {
    slug: "playlist-details",
    section: "playlists",
    title: "Playlist Details",
    icon: ListMusicIcon /* music.note.list */,
    variants: [{ slug: "live", title: "Live", href: "/playlist-details/live", status: "live", preview: "playlist" }],
  },
  {
    slug: "settings",
    section: "settings",
    title: "Settings",
    icon: SettingsIcon /* gearshape */,
    variants: [{ slug: "live", title: "Live", href: "/settings/live", status: "live" }],
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
