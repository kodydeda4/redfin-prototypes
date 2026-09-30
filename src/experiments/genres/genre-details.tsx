"use client"

import { useEffect, useState } from "react"

import { Spinner } from "@/components/ui/spinner"
import { AlbumDetails } from "@/experiments/albums/album-details"
import { AlbumGrid } from "@/experiments/albums/albums-screen"
import { BackButton } from "@/experiments/sidebar/shell-back"
import { fetchAlbums, type Album, type Genre, type Session } from "@/lib/jellyfin"
import { useSynced } from "@/lib/stored"

// Mirrors `GenreFeature` in redfin-swift: the genre's name and album count over an "Albums" grid of
// every album in it. Tapping an album pushes its details, with the genre as "back".

type Load = { status: "loading" } | { status: "loaded"; albums: Album[] } | { status: "failed"; message: string }

export function GenreDetails({
  genre,
  session,
  libraryID,
  onBack,
}: {
  genre: Genre
  session: Session
  libraryID?: string
  onBack: () => void
}) {
  const [load, setLoad] = useState<Load>({ status: "loading" })
  // Shared by both device frames, like the rest of the navigation.
  const [openAlbumID, setOpenAlbumID] = useSynced<string | null>("genre-album-open", null)

  useEffect(() => {
    const controller = new AbortController()
    fetchAlbums(session, { libraryID, genreID: genre.id }, controller.signal)
      .then((albums) => setLoad({ status: "loaded", albums }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoad({ status: "failed", message: error instanceof Error ? error.message : String(error) })
      })
    return () => controller.abort()
  }, [session, libraryID, genre.id])

  const albums = load.status === "loaded" ? load.albums : []
  const openAlbum = albums.find((a) => a.id === openAlbumID)
  const updateAlbum = (album: Album) =>
    setLoad((load) =>
      load.status === "loaded" ? { ...load, albums: load.albums.map((a) => (a.id === album.id ? album : a)) } : load,
    )

  return (
    <>
      <div
        data-covered={openAlbum ? true : undefined}
        className="min-h-0 flex-1 overflow-y-auto bg-background pb-(--safe-bottom) data-covered:hidden"
      >
        <div className="sticky top-0 z-10 bg-background/80 px-4 pt-(--safe-top) backdrop-blur-xl">
          <BackButton
            label="Genres"
            onClick={() => {
              setOpenAlbumID(null)
              onBack()
            }}
          />
        </div>

        <header className="flex flex-col gap-1 px-4 pt-2 pb-6 md:px-8">
          <h1 className="line-clamp-2 text-3xl font-bold tracking-tight text-balance md:text-4xl">{genre.name}</h1>
          <p className="text-sm text-muted-foreground">
            {load.status === "loaded" ? `${albums.length} ${albums.length === 1 ? "album" : "albums"}` : " "}
          </p>
        </header>

        <section>
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
              <AlbumGrid albums={albums} session={session} onOpen={(album) => setOpenAlbumID(album.id)} />
            </div>
          )}
        </section>
      </div>
      {/* Always rendered, after the genre page, so opening an album never shifts its elements. */}
      <div className="contents">
        {openAlbum ? (
          <AlbumDetails
            album={openAlbum}
            session={session}
            backLabel={genre.name}
            onBack={() => setOpenAlbumID(null)}
            onAlbumChange={updateAlbum}
          />
        ) : null}
      </div>
    </>
  )
}
