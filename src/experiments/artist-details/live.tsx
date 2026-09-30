"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// An artist's details, reached the way the app does: the sidebar's Artists grid with an artist opened
// (see `ArtistDetails`) — the one picked in the workbench's Preview menu, else the first. "‹ Artists"
// goes back to the grid.
export default function LiveArtistDetails() {
  return <SidebarShell scope="artist-details" initialTag="artists" openPreview />
}
