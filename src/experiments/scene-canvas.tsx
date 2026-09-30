"use client"

import { Suspense } from "react"
import { Canvas, type CanvasProps } from "@react-three/fiber"
import { useTheme } from "next-themes"

/** Palette for 3D scenes that follows the resolved light/dark theme. */
export function useSceneColors() {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  return {
    dark,
    accent: dark ? "#a78bfa" : "#6d28d9",
    shadow: dark ? "#000000" : "#1f1f1f",
  }
}

/** Full-bleed, transparent R3F canvas so the page background (and theme) shows through. */
export function SceneCanvas({ children, ...props }: CanvasProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true }}
      className="touch-none"
      {...props}
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 2]} intensity={1.2} castShadow />
      <Suspense fallback={null}>{children}</Suspense>
    </Canvas>
  )
}
