"use client"

import { SidebarShell } from "@/experiments/sidebar/sidebar-shell"

// Search inside the app's sidebar, like the macOS app (see `SearchScreen`).
export default function LiveSearch() {
  return <SidebarShell scope="search" initialTag="search" />
}
