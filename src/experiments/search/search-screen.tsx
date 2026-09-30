"use client"

import { useEffect, useState } from "react"
import { SearchIcon } from "lucide-react"

import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Spinner } from "@/components/ui/spinner"
import { AlbumDetails } from "@/experiments/albums/album-details"
import { ArtistDetails } from "@/experiments/artists/artist-details"
import { BrowseHeader, SignedOut } from "@/experiments/shared/browse"
import { Artwork } from "@/experiments/shared/details-page"
import { SongRow } from "@/experiments/songs/songs-screen"
import {
  artworkURL,
  search,
  SessionExpiredError,
  useSelectedLibrary,
  useSession,
  type Album,
  type Artist,
  type SearchResults,
  type Session,
} from "@/lib/jellyfin"
import { useSynced } from "@/lib/stored"

// Mirrors `SearchFeature` in redfin-swift: search the library as you type (300 ms after the last
// keystroke, dropping any older request), with matches grouped into Artists, Albums, and Songs.
// "Search Library" before there's a query; "No Results" when nothing matches. Tapping an artist or
// album pushes its details, with "Search" as back; songs don't play yet.

const DEBOUNCE_MS = 300

type Load =
  | { status: "idle" }
  | { status: "loading"; term: string }
  | { status: "loaded"; term: string; results: SearchResults }
  | { status: "failed"; message: string }
  | { status: "expired" }

/** The Search screen on its own, filling (and scrolling within) its parent — the sidebar embeds it. */
export function SearchScreen() {
  const session = useSession()
  const library = useSelectedLibrary()

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {session === undefined || library === undefined ? null : session ? (
        <Search key={`${session.accessToken}:${library?.id}`} session={session} libraryID={library?.id} />
      ) : (
        <SignedOut noun="library" icon={SearchIcon} />
      )}
    </div>
  )
}

function Search({ session, libraryID }: { session: Session; libraryID?: string }) {
  // Shared by both device frames, so typing on either searches on both.
  const [query, setQuery] = useSynced("search-query", "")
  const [open, setOpen] = useSynced<{ kind: "artist" | "album"; id: string } | null>("search-open", null)
  const [load, setLoad] = useState<Load>({ status: "idle" })
  const term = query.trim()

  useEffect(() => {
    if (!term) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      setLoad({ status: "loading", term })
      search(session, term, libraryID, controller.signal)
        .then((results) => setLoad({ status: "loaded", term, results }))
        .catch((error: unknown) => {
          if (controller.signal.aborted) return
          if (error instanceof SessionExpiredError) return setLoad({ status: "expired" })
          setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) })
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [session, libraryID, term])

  // Results for an older query stay up while the new one loads, so the list doesn't flash empty.
  const results = term && load.status === "loaded" ? load.results : undefined
  const openArtist = open?.kind === "artist" ? results?.artists.find((a) => a.id === open.id) : undefined
  const openAlbum = open?.kind === "album" ? results?.albums.find((a) => a.id === open.id) : undefined
  const isCovered = Boolean(openArtist ?? openAlbum)
  const back = () => setOpen(null)

  // Favoriting in a pushed page updates the results so it sticks when you come back.
  const replace = <T extends { id: string }>(items: T[], item: T) => items.map((i) => (i.id === item.id ? item : i))
  const updateArtist = (artist: Artist) =>
    setLoad((l) => (l.status === "loaded" ? { ...l, results: { ...l.results, artists: replace(l.results.artists, artist) } } : l))
  const updateAlbum = (album: Album) =>
    setLoad((l) => (l.status === "loaded" ? { ...l, results: { ...l.results, albums: replace(l.results.albums, album) } } : l))

  return (
    <>
      <div
        data-covered={isCovered || undefined}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-(--safe-bottom) data-covered:hidden"
      >
        <BrowseHeader title="Search" placeholder="Artists, Albums, Songs" search={query} onSearch={setQuery} />
        <SearchBody
          term={term}
          load={load}
          results={results}
          session={session}
          onOpen={(kind, id) => setOpen({ kind, id })}
        />
      </div>
      {/* Always rendered, after the results, so pushing a page never shifts their elements — the
          workbench finds the elements for replayed taps by their position. */}
      <div className="contents">
        {openArtist ? (
          <ArtistDetails
            key={openArtist.id}
            artist={openArtist}
            session={session}
            backLabel="Search"
            onBack={back}
            onArtistChange={updateArtist}
          />
        ) : openAlbum ? (
          <AlbumDetails
            key={openAlbum.id}
            album={openAlbum}
            session={session}
            backLabel="Search"
            onBack={back}
            onAlbumChange={updateAlbum}
          />
        ) : null}
      </div>
    </>
  )
}

function SearchBody({
  term,
  load,
  results,
  session,
  onOpen,
}: {
  term: string
  load: Load
  results?: SearchResults
  session: Session
  onOpen: (kind: "artist" | "album", id: string) => void
}) {
  if (!term) {
    return <Message title="Search Library" description="Find artists, albums, and songs." />
  }
  if (load.status === "expired") {
    return <Message title="Session Expired" description="The server signed you out. Sign in again to search." />
  }
  if (load.status === "failed") {
    return <Message title="Couldn't Search" description={load.message} />
  }
  if (!results) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Spinner className="size-6 text-muted-foreground" />
      </div>
    )
  }
  const { artists, albums, songs } = results
  if (artists.length + albums.length + songs.length === 0) {
    // The term the results are for — it can trail the field by a keystroke while the next one loads.
    const shown = load.status === "loaded" ? load.term : term
    return <Message title={`No Results for “${shown}”`} description="Check the spelling or try a new search." />
  }

  return (
    <div className="flex flex-col gap-6 pb-6">
      {artists.length > 0 ? (
        <Section title="Artists">
          {artists.map((artist) => (
            <li key={artist.id}>
              <button
                type="button"
                onClick={() => onOpen("artist", artist.id)}
                className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-foreground/5 active:opacity-70"
              >
                <Artwork src={artworkURL(session, artist, 120)} className="size-12 shrink-0 rounded-full" />
                <span className="flex min-h-12 min-w-0 flex-1 items-center truncate border-b border-border/60 text-[15px]">
                  {artist.name}
                </span>
              </button>
            </li>
          ))}
        </Section>
      ) : null}
      {albums.length > 0 ? (
        <Section title="Albums">
          {albums.map((album) => (
            <li key={album.id}>
              <button
                type="button"
                onClick={() => onOpen("album", album.id)}
                className="flex w-full items-start gap-3 rounded-lg p-2 text-left transition-colors hover:bg-foreground/5 active:opacity-70"
              >
                <Artwork src={artworkURL(session, album, 200)} className="size-16 shrink-0 rounded-md md:size-20" />
                <div className="min-w-0 flex-1 self-stretch border-b border-border/60 pt-1">
                  <p className="truncate text-[15px] font-medium">{album.name}</p>
                  {album.albumArtist ? (
                    <p className="truncate text-sm text-muted-foreground">{album.albumArtist}</p>
                  ) : null}
                </div>
              </button>
            </li>
          ))}
        </Section>
      ) : null}
      {songs.length > 0 ? (
        <Section title="Songs">
          {songs.map((song) => (
            <li key={song.id}>
              <SongRow song={song} session={session} />
            </li>
          ))}
        </Section>
      ) : null}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mx-4 border-b pb-2 text-xs font-semibold text-muted-foreground md:mx-6">{title}</h2>
      <ul className="px-2 pt-1 md:px-4">{children}</ul>
    </section>
  )
}

function Message({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="flex-1">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchIcon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  )
}
