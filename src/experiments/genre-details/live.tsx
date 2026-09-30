"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// A genre's details, reached the way the app does: the sidebar's Genres list with a genre opened (see
// `GenreDetails`) — the one picked in the workbench's Preview State, else the first. "‹ Genres" goes
// back to the list.
export default function LiveGenreDetails() {
  return <SidebarShell scope="genre-details" initialTag="genres" openPreview />
}
