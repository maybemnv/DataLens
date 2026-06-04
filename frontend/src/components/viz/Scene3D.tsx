"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, PerspectiveCamera, Environment, ContactShadows } from "@react-three/drei"
import { EffectComposer, Bloom, DepthOfField } from "@react-three/postprocessing"
import { Suspense } from "react"
import { cn } from "@/lib/utils"
import { Maximize2, RotateCcw, Download } from "lucide-react"
import { Button } from "@/components/ui/button"

interface Scene3DProps {
  children: React.ReactNode
  className?: string
  showControls?: boolean
}

/**
 * Scene3D — React Three Fiber canvas with professional lighting, bloom, and depth-of-field.
 * Canvas automatically fills its container and is responsive via R3F built-in resize handling.
 */
export function Scene3D({ children, className, showControls = true }: Scene3DProps) {
  return (
    <div className={cn("relative h-full w-full bg-background", className)}>
      {/* Control buttons */}
      {showControls && (
        <div className="absolute right-4 top-4 z-10 flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-border bg-surface/80 text-text-secondary hover:bg-surface hover:text-text-primary"
            onClick={() => window.location.reload()}
            title="Reset view"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-border bg-surface/80 text-text-secondary hover:bg-surface hover:text-text-primary"
            title="Export PNG (coming soon)"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 border-border bg-surface/80 text-text-secondary hover:bg-surface hover:text-text-primary"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen()
              } else {
                document.exitFullscreen()
              }
            }}
            title="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <PerspectiveCamera makeDefault position={[5, 3, 5]} fov={50} />

        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <pointLight position={[-10, -10, -10]} intensity={0.5} />

        {/* Environment for reflections */}
        <Environment preset="city" />

        {/* Shadow catcher */}
        <ContactShadows
          position={[0, -2, 0]}
          opacity={0.4}
          scale={20}
          blur={2}
          far={4}
        />

        {/* Camera controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={2}
          maxDistance={20}
          autoRotate={false}
          autoRotateSpeed={0.5}
          dampingFactor={0.1}
          zoomSpeed={0.5}
        />

        {/* Post-processing effects: Bloom + Depth of Field */}
        <EffectComposer>
          <Bloom luminanceThreshold={0.6} luminanceSmoothing={0.02} intensity={0.8} mipmapBlur />
          <DepthOfField
            focusDistance={0.02}
            focalLength={0.08}
            bokehScale={2.5}
            height={480}
          />
        </EffectComposer>

        <Suspense fallback={null}>{children}</Suspense>
      </Canvas>

      {/* Loading state */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-xs text-text-muted">Loading 3D scene...</div>
      </div>
    </div>
  )
}
