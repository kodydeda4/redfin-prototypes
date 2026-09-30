"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// Recently Added inside the app's sidebar, like the macOS app (see `AlbumsScreen`, which draws it).
export default function LiveRecentlyAdded() {
  return <SidebarShell scope="recently-added" initialTag="recently-added" />
}
