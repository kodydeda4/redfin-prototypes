"use client"

import { useEffect, useState } from "react"
import { ListMusicIcon } from "lucide-react"

import { PlaylistDetails, playlistSummary } from "@/experiments/playlists/playlist-details"
import { BrowseHeader, browseStatus, matches, SignedOut, useOpenPreview, type Load } from "@/experiments/shared/browse"
import { Artwork } from "@/experiments/shared/details-page"
import { artworkURL, fetchPlaylists, SessionExpiredError, useSession, type Playlist, type Session } from "@/lib/jellyfin"
import { useSynced } from "@/lib/stored"

// Mirrors `AllPlaylistsFeature` in redfin-swift: every playlist on the server (they sit outside the
// music libraries, so the library picker doesn't narrow them), each with its art and "N songs ·
// duration", and a name search. Tapping one pushes its details.
//
// `playlistID` instead shows that one playlist on its own — what a playlist row in the sidebar opens.

/** The Playlists screen on its own, filling (and scrolling within) its parent — the sidebar embeds it. */
export function PlaylistsScreen({ openPreview = false, playlistID }: { openPreview?: boolean; playlistID?: string }) {
  const session = useSession()

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {session === undefined ? null : session ? (
        // Keyed so switching account starts a fresh load.
        <Playlists key={session.accessToken} session={session} openPreview={openPreview} playlistID={playlistID} />
      ) : (
        <SignedOut noun="playlists" icon={ListMusicIcon} />
      )}
    </div>
  )
}

function Playlists({
  session,
  openPreview,
  playlistID,
}: {
  session: Session
  openPreview: boolean
  playlistID?: string
}) {
  const [load, setLoad] = useState<Load<Playlist>>({ status: "loading" })
  const [attempt, setAttempt] = useState(0)
  // Shared by both device frames, so searching or opening a playlist on either shows on both.
  const [search, setSearch] = useSynced("playlists-search", "")
  // The playlist pushed over the list. The list stays mounted underneath, keeping its scroll position.
  const [openID, setOpenID] = useSynced<string | null>("playlists-open", null)

  useEffect(() => {
    const controller = new AbortController()
    fetchPlaylists(session, controller.signal)
      .then((items) => setLoad({ status: "loaded", items }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        if (error instanceof SessionExpiredError) return setLoad({ status: "expired" })
        setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [session, attempt])

  // Playlist Details Live opens the playlist picked in the workbench's Preview State (or the first).
  useOpenPreview("playlist", openPreview, load.status === "loaded" ? load.items : null, setOpenID)

  const retry = () => {
    setLoad({ status: "loading" })
    setAttempt((n) => n + 1)
  }

  const playlists = load.status === "loaded" ? load.items : []
  const shown = playlists.filter((p) => matches(search, p.name))
  const updatePlaylist = (playlist: Playlist) =>
    setLoad((load) =>
      load.status === "loaded" ? { ...load, items: load.items.map((p) => (p.id === playlist.id ? playlist : p)) } : load,
    )

  // Opened straight from the sidebar: just that playlist, with the sidebar as "back".
  if (playlistID) {
    const playlist = playlists.find((p) => p.id === playlistID)
    if (!playlist) {
      return browseStatus({ load, shown: [], search: "", noun: "playlists", icon: ListMusicIcon, onRetry: retry })
    }
    return <PlaylistDetails key={playlist.id} playlist={playlist} session={session} onPlaylistChange={updatePlaylist} />
  }

  const open = playlists.find((p) => p.id === openID)

  return (
    <>
      <div
        data-covered={open ? true : undefined}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-(--safe-bottom) data-covered:hidden"
      >
        <BrowseHeader title="Playlists" search={search} onSearch={setSearch} />
        {browseStatus({ load, shown, search, noun: "playlists", icon: ListMusicIcon, onRetry: retry }) ?? (
          <ul className="px-2 pb-6 md:px-4">
            {shown.map((playlist) => (
              <li key={playlist.id}>
                <button
                  type="button"
                  onClick={() => setOpenID(playlist.id)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-foreground/5 active:opacity-70"
                >
                  <Artwork src={artworkURL(session, playlist, 120)} className="size-14 shrink-0 rounded-md" />
                  <div className="flex min-h-14 min-w-0 flex-1 flex-col justify-center border-b border-border/60">
                    <p className="truncate text-[15px] font-medium">{playlist.name}</p>
                    <p className="text-xs text-muted-foreground">{playlistSummary(playlist)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Always rendered, after the list, so opening a playlist never shifts the list's elements — the
          workbench finds the elements for replayed taps by their position. */}
      <div className="contents">
        {open ? (
          <PlaylistDetails
            key={open.id}
            playlist={open}
            session={session}
            backLabel="Playlists"
            onBack={() => setOpenID(null)}
            onPlaylistChange={updatePlaylist}
          />
        ) : null}
      </div>
    </>
  )
}
