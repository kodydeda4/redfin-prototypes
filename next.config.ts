import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones/tablets on the local network use the dev server (JS, HMR), e.g.
  // http://Kodys-MacBook-Pro.local:3000 or the Mac's LAN IP. Dev-only; no effect on builds.
  allowedDevOrigins: ["*.local", "192.168.*.*", "10.*.*.*"],
  // Hide the dev-only "N" route indicator (it sits on top of the app); errors still show.
  devIndicators: false,
};

export default nextConfig;
