"use client"

import { useEffect, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { AlbumDetails } from "@/experiments/albums/album-details"
import { AlbumGrid } from "@/experiments/albums/albums-screen"
import { DetailsPage } from "@/experiments/shared/details-page"
import { artworkURL, fetchAlbums, setFavorite, type Album, type Artist, type Session } from "@/lib/jellyfin"
import { useSynced } from "@/lib/stored"

// Mirrors `iOSArtistDetailsFeature` in redfin-swift, laid out like the macOS artist page
// (`DetailsPage`): the artist's picture and name, Play / Shuffle / favorite, then an "Albums" grid of
// their albums, oldest first. Tapping an album pushes its details, with the artist as "back".

type Load = { status: "loading" } | { status: "loaded"; albums: Album[] } | { status: "failed"; message: string }

export function ArtistDetails({
  artist,
  session,
  backLabel = "Artists",
  onBack,
  onArtistChange,
}: {
  artist: Artist
  session: Session
  /** The screen "back" returns to — "Artists", or e.g. "Search". */
  backLabel?: string
  onBack: () => void
  /** The artist changed here (favorited), so the grid can keep its copy in step. */
  onArtistChange: (artist: Artist) => void
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" })
  // Shared by both device frames, like the rest of the navigation.
  const [openAlbumID, setOpenAlbumID] = useSynced<string | null>("artist-album-open", null)

  useEffect(() => {
    const controller = new AbortController()
    fetchAlbums(session, { artistID: artist.id }, controller.signal)
      .then((albums) => setLoad({ status: "loaded", albums }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [session, artist.id])

  // Optimistic, like the Swift reducers: flip now, flip back if the server says no.
  const toggleFavorite = () => {
    const isFavorite = !artist.isFavorite
    onArtistChange({ ...artist, isFavorite })
    setFavorite(session, artist.id, isFavorite).catch(() => onArtistChange({ ...artist, isFavorite: !isFavorite }))
  }

  const albums = load.status === "loaded" ? load.albums : []
  const openAlbum = albums.find((a) => a.id === openAlbumID)
  const updateAlbum = (album: Album) =>
    setLoad((load) =>
      load.status === "loaded" ? { ...load, albums: load.albums.map((a) => (a.id === album.id ? album : a)) } : load,
    )

  return (
    <>
      <div data-covered={openAlbum ? true : undefined} className="flex min-h-0 flex-1 flex-col data-covered:hidden">
        <DetailsPage
          art={artworkURL(session, artist, 600)}
          title={artist.name}
          meta={artist.genres[0]}
          isFavorite={artist.isFavorite}
          onToggleFavorite={toggleFavorite}
          backLabel={backLabel}
          onBack={() => {
            setOpenAlbumID(null)
            onBack()
          }}
        >
          <section className="pt-2">
            <h2 className="px-4 pb-3 text-xl font-bold tracking-tight md:px-8">Albums</h2>
            {load.status === "loading" ? (
              <div className="flex justify-center py-16">
                <Spinner className="size-6 text-muted-foreground" />
              </div>
            ) : load.status === "failed" ? (
              <p className="px-8 py-16 text-center text-sm text-muted-foreground">{load.message}</p>
            ) : albums.length === 0 ? (
              <p className="px-4 py-8 text-sm text-muted-foreground md:px-8">No albums.</p>
            ) : (
              <div className="md:px-4">
                {/* The artist is the same on every cell, so the second line is the year instead. */}
                <AlbumGrid
                  albums={albums}
                  session={session}
                  detail={(album) => album.productionYear}
                  onOpen={(album) => setOpenAlbumID(album.id)}
                />
              </div>
            )}
          </section>
        </DetailsPage>
      </div>
      {/* Always rendered, after the artist page, so opening an album never shifts its elements. */}
      <div className="contents">
        {openAlbum ? (
          <AlbumDetails
            album={openAlbum}
            session={session}
            backLabel={artist.name}
            onBack={() => setOpenAlbumID(null)}
            onAlbumChange={updateAlbum}
          />
        ) : null}
      </div>
    </>
  )
}
