"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// An album's details, reached the way the app does: the sidebar's Albums grid with an album opened (see
// `AlbumDetails`) — the one picked in the workbench's Preview menu, else the first. "‹ Albums" goes
// back to the grid.
export default function LiveAlbumDetails() {
  return <SidebarShell scope="album-details" initialTag="albums" openPreview />
}
