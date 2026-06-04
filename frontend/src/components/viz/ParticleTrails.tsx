"use client"

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface ParticleTrail {
  origin: [number, number, number]
  color: string
  confidence: number
}

interface ParticleTrailsProps {
  trails: ParticleTrail[]
  particleCount?: number
}

function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000
  return x - Math.floor(x)
}

/**
 * ParticleTrails — emitting particles from cluster centers to show assignment confidence.
 * Uses seeded pseudo-random for stable deterministic positions.
 */
export function ParticleTrails({ trails, particleCount = 30 }: ParticleTrailsProps) {
  const pointsRef = useRef<THREE.Points>(null)
  const timeRef = useRef(0)

  const { positions, colors } = useMemo(() => {
    const total = trails.length * particleCount
    const pos = new Float32Array(total * 3)
    const col = new Float32Array(total * 3)
    const siz = new Float32Array(total)

    let seed = 42
    trails.forEach((trail, i) => {
      const color = new THREE.Color(trail.color)
      for (let j = 0; j < particleCount; j++) {
        const idx = i * particleCount + j
        seed += 1
        const angle1 = seededRandom(seed) * Math.PI * 2
        seed += 1
        const angle2 = seededRandom(seed) * Math.PI * 2
        seed += 1
        const dist = seededRandom(seed) * trail.confidence * 2

        pos[idx * 3] = trail.origin[0] + Math.sin(angle1) * Math.cos(angle2) * dist
        pos[idx * 3 + 1] = trail.origin[1] + Math.sin(angle2) * dist
        pos[idx * 3 + 2] = trail.origin[2] + Math.cos(angle1) * Math.cos(angle2) * dist

        col[idx * 3] = color.r
        col[idx * 3 + 1] = color.g
        col[idx * 3 + 2] = color.b

        seed += 1
        siz[idx] = 0.02 + seededRandom(seed) * 0.04
      }
    })

    return { positions: pos, colors: col, sizes: siz }
  }, [trails, particleCount])

  const geometryRef = useRef<THREE.BufferGeometry>(null)

  useFrame((_, delta) => {
    timeRef.current += delta
    if (!geometryRef.current || !pointsRef.current) return

    const pos = geometryRef.current.attributes.position.array as Float32Array
    const total = trails.length * particleCount

    for (let i = 0; i < total; i++) {
      const trailIdx = Math.floor(i / particleCount)
      const trail = trails[trailIdx]
      const particleOffset = timeRef.current * 0.5 + (i % particleCount) * 0.1

      const angle1 = Math.sin(particleOffset + i) * Math.PI
      const angle2 = Math.cos(particleOffset * 0.7 + i * 0.3) * Math.PI
      const dist = (Math.sin(particleOffset + i * 0.5) * 0.5 + 0.5) * trail.confidence * 2

      pos[i * 3] = trail.origin[0] + Math.sin(angle1) * Math.cos(angle2) * dist
      pos[i * 3 + 1] = trail.origin[1] + Math.sin(angle2) * dist
      pos[i * 3 + 2] = trail.origin[2] + Math.cos(angle1) * Math.cos(angle2) * dist
    }

    geometryRef.current.attributes.position.needsUpdate = true
  })

  if (trails.length === 0) return null

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          args={[positions, 3]}
          attach="attributes-position"
          count={positions.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          args={[colors, 3]}
          attach="attributes-color"
          count={colors.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
