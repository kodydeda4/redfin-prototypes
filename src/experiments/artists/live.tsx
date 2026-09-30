"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// Artists inside the app's sidebar, like the macOS app (see `ArtistsScreen` for the grid itself).
export default function LiveArtists() {
  return <SidebarShell scope="artists" initialTag="artists" />
}
