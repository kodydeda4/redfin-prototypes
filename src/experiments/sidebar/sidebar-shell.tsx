"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  ChevronRightIcon,
  ChevronsUpDownIcon,
  CircleUserRoundIcon,
  ClockIcon,
  Grid3x3Icon,
  GuitarIcon,
  ListMusicIcon,
  MicVocalIcon,
  MusicIcon,
  SearchIcon,
  SquareStackIcon,
  type LucideIcon,
} from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { AlbumsScreen } from "@/experiments/albums/albums-screen"
import { ArtistsScreen } from "@/experiments/artists/artists-screen"
import { GenresScreen } from "@/experiments/genres/genres-screen"
import { PlaylistsScreen } from "@/experiments/playlists/playlists-screen"
import { SearchScreen } from "@/experiments/search/search-screen"
import { SettingsSheet, useSettingsOpen } from "@/experiments/settings/settings-sheet"
import { SongsScreen } from "@/experiments/songs/songs-screen"
import { FadeImage } from "@/experiments/shared/details-page"
import { ShellBackButton, ShellBackContext } from "@/experiments/sidebar/shell-back"
import {
  fetchAvatarURL,
  fetchLibraries,
  fetchPlaylists,
  selectLibrary,
  useSelectedLibrary,
  useSession,
  type Item,
  type Session,
} from "@/lib/jellyfin"
import { SyncScope, useSynced } from "@/lib/stored"
import { cn } from "@/lib/utils"

// Mirrors `SidebarFeature` in redfin-swift (the macOS sidebar): Browse, Library, and Playlists
// sections over an account footer. On iPad it sits beside the selected screen; on iPhone it's the
// root list, and picking a row pushes that screen with a back button (like a collapsed split view).
//
// Each live page wraps its screen in this shell with its own row selected (Albums Live → Albums).
// Both layouts render the same DOM — only CSS differs — so the workbench can mirror taps between the
// iPhone and iPad frames.

export type Tag = "search" | "recently-added" | "artists" | "albums" | "songs" | "genres" | "all-playlists" | `playlist:${string}`

const browse: { tag: Tag; title: string; icon: LucideIcon }[] = [
  { tag: "search", title: "Search", icon: SearchIcon /* magnifyingglass */ },
  { tag: "recently-added", title: "Recently Added", icon: ClockIcon /* clock */ },
  { tag: "artists", title: "Artists", icon: MicVocalIcon /* music.microphone */ },
  { tag: "albums", title: "Albums", icon: SquareStackIcon /* square.stack */ },
  { tag: "songs", title: "Songs", icon: MusicIcon /* music.note */ },
  { tag: "genres", title: "Genres", icon: GuitarIcon /* guitars */ },
]

type ShellProps = {
  initialTag: Tag
  /** Start with the settings sheet open (Settings Live). */
  openSettings?: boolean
  /**
   * Open the starting screen's previewed item (picked in the workbench's Preview State, else the
   * first) once it loads — the Artist, Album, and Genre Details Live pages.
   */
  openPreview?: boolean
}

/**
 * The app's sidebar beside (iPad) or under (iPhone) the selected screen, starting on `initialTag`.
 * `scope` keeps each feature page's synced navigation state separate.
 */
export function SidebarShell({ scope, ...props }: ShellProps & { scope: string }) {
  return (
    <SyncScope value={scope}>
      <Shell {...props} />
    </SyncScope>
  )
}

function Shell({ initialTag, openPreview = false, openSettings = false }: ShellProps) {
  const session = useSession()
  // Shared by both device frames, so a tap on either shows on both.
  const [tag, setTag] = useSynced<Tag>("sidebar-tag", initialTag)
  // iPhone only: whether the selected screen is pushed over the list — it starts on the page's own
  // screen, with the sidebar one tap back. iPad CSS ignores it.
  const [isPushed, setIsPushed] = useSynced("sidebar-pushed", true)

  const select = (next: Tag) => {
    setTag(next)
    setIsPushed(true)
  }

  if (session === undefined) return null

  return (
    <div className="flex h-dvh w-full bg-background">
      <nav
        data-pushed={isPushed || undefined}
        className="flex w-full shrink-0 flex-col border-r-0 bg-background data-pushed:hidden md:w-80 md:border-r md:bg-muted/40 md:data-pushed:flex"
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-[calc(var(--safe-top)+0.75rem)] pb-3">
          <h1 className="px-2 pb-3 text-3xl font-bold tracking-tight md:text-2xl">Redfin</h1>
          {session ? <Sections key={session.accessToken} session={session} tag={tag} onSelect={select} /> : null}
        </div>
        <AccountFooter session={session} openSettings={openSettings} />
      </nav>

      <main
        data-pushed={isPushed || undefined}
        className="hidden min-w-0 flex-1 flex-col data-pushed:flex md:flex"
      >
        <ShellBackContext value={{ label: "Redfin", onBack: () => setIsPushed(false) }}>
          <Detail tag={tag} openPreview={openPreview && tag === initialTag} />
        </ShellBackContext>
      </main>
    </div>
  )
}

function Sections({ session, tag, onSelect }: { session: Session; tag: Tag; onSelect: (tag: Tag) => void }) {
  const [libraries, setLibraries] = useState<Item[]>([])
  const [playlists, setPlaylists] = useState<Item[]>([])

  useEffect(() => {
    const controller = new AbortController()
    // Best-effort, like the Swift sidebar: sections just stay empty if the server can't list them.
    fetchLibraries(session, controller.signal).then(setLibraries, () => {})
    fetchPlaylists(session, controller.signal).then(setPlaylists, () => {})
    return () => controller.abort()
  }, [session])

  return (
    <div className="flex flex-col gap-5">
      <Section title="Browse">
        {browse.map((row) => (
          <Row key={row.tag} icon={row.icon} title={row.title} isSelected={tag === row.tag} onClick={() => onSelect(row.tag)} />
        ))}
      </Section>
      <Section title="Library">
        <LibraryPicker libraries={libraries} />
      </Section>
      <Section title="Playlists">
        <Row
          icon={Grid3x3Icon /* square.grid.3x3 */}
          title="All Playlists"
          isSelected={tag === "all-playlists"}
          onClick={() => onSelect("all-playlists")}
        />
        {playlists.map((playlist) => (
          <Row
            key={playlist.id}
            icon={ListMusicIcon /* music.note.list */}
            title={playlist.name}
            isSelected={tag === `playlist:${playlist.id}`}
            onClick={() => onSelect(`playlist:${playlist.id}`)}
          />
        ))}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-0.5">
      <h2 className="px-2 pb-1 text-xs font-semibold text-muted-foreground">{title}</h2>
      {children}
    </section>
  )
}

const rowClass =
  "group/row flex h-11 w-full min-w-0 items-center gap-3 rounded-lg px-2 text-left text-[17px] transition-colors hover:bg-muted md:h-9 md:text-[15px]"

/** A sidebar row. The red selection only shows beside a screen (iPad); on iPhone the row pushes it. */
function Row({
  icon: Icon,
  title,
  isSelected,
  onClick,
}: {
  icon: LucideIcon
  title: string
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      data-selected={isSelected || undefined}
      onClick={onClick}
      className={cn(rowClass, "md:data-selected:bg-red-500 md:data-selected:text-white md:data-selected:hover:bg-red-500")}
    >
      <Icon className="size-5 shrink-0 text-red-500 md:size-[18px] md:group-data-selected/row:text-white" />
      <span className="min-w-0 flex-1 truncate">{title}</span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60 md:hidden" />
    </button>
  )
}

/** The Swift sidebar's library `Menu`: pick which library the app browses. */
function LibraryPicker({ libraries }: { libraries: Item[] }) {
  const selected = useSelectedLibrary()
  const title = selected?.name ?? "All Libraries"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={rowClass}>
        <ListMusicIcon className="size-5 shrink-0 text-red-500 md:size-[18px]" />
        <span className="min-w-0 flex-1 truncate">{title}</span>
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56">
        <DropdownMenuRadioGroup
          value={selected?.id ?? ""}
          onValueChange={(id) => selectLibrary(libraries.find((l) => l.id === id) ?? null)}
        >
          <DropdownMenuRadioItem value="" closeOnClick>
            All Libraries
          </DropdownMenuRadioItem>
          {libraries.length > 0 ? <DropdownMenuSeparator /> : null}
          {libraries.map((library) => (
            <DropdownMenuRadioItem key={library.id} value={library.id} closeOnClick>
              {library.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** The signed-in account: avatar, name, and server — or a way to sign in. */
/** The signed-in account — tapping it opens Settings — or a way to sign in. */
function AccountFooter({ session, openSettings }: { session: Session | null; openSettings: boolean }) {
  const [avatar, setAvatar] = useState<{ token: string; url?: string }>()
  const [, setSettingsOpen] = useSettingsOpen(openSettings)

  useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    fetchAvatarURL(session, 60, controller.signal).then(
      (url) => setAvatar({ token: session.accessToken, url }),
      () => {},
    )
    return () => controller.abort()
  }, [session])

  // Only trust an avatar fetched for the current session.
  const avatarURL = session && avatar?.token === session.accessToken ? avatar.url : undefined

  const className =
    "flex w-full shrink-0 items-center gap-2.5 border-t px-4 pt-3 pb-[calc(var(--safe-bottom)+0.75rem)] text-left transition-colors hover:bg-muted"
  const content = (
    <>
      {avatarURL ? (
        <div className="size-[30px] shrink-0 overflow-hidden rounded-full bg-muted">
          <FadeImage src={avatarURL} className="size-full object-cover" />
        </div>
      ) : (
        <CircleUserRoundIcon className="size-[30px] shrink-0 text-muted-foreground" strokeWidth={1.5} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{session?.username ?? "Not signed in"}</p>
        {session ? <p className="truncate text-xs text-muted-foreground">{session.serverURL}</p> : null}
      </div>
    </>
  )

  if (!session) {
    return (
      <Link href="/authentication/live" className={className}>
        {content}
      </Link>
    )
  }
  return (
    <>
      <button type="button" onClick={() => setSettingsOpen(true)} className={className}>
        {content}
      </button>
      <SettingsSheet session={session} initialOpen={openSettings} />
    </>
  )
}

/** The selected screen. Every sidebar row has one; the fallback only catches an unknown tag. */
function Detail({ tag, openPreview }: { tag: Tag; openPreview: boolean }) {
  if (tag === "search") return <SearchScreen />
  if (tag === "recently-added") return <AlbumsScreen recentlyAdded />
  if (tag === "albums") return <AlbumsScreen openPreview={openPreview} />
  if (tag === "artists") return <ArtistsScreen openPreview={openPreview} />
  if (tag === "songs") return <SongsScreen />
  if (tag === "genres") return <GenresScreen openPreview={openPreview} />
  if (tag === "all-playlists") return <PlaylistsScreen openPreview={openPreview} />
  // Keyed so each playlist starts fresh (its own load and scroll).
  if (tag.startsWith("playlist:")) return <PlaylistsScreen key={tag} playlistID={tag.slice("playlist:".length)} />

  const row = browse.find((b) => b.tag === tag)
  const title = row?.title ?? "Coming Soon"
  const Icon = row?.icon ?? SearchIcon
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="px-4 pt-(--safe-top)">
        <ShellBackButton />
      </div>
      <Empty className="flex-1">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>This screen hasn&apos;t been prototyped yet.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    </div>
  )
}
