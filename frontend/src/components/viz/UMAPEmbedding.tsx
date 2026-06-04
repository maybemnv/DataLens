"use client"

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface UMAPPoint {
  position: [number, number, number]
  targetPosition: [number, number, number]
  label?: string
  group?: number
}

interface UMAPEmbeddingProps {
  points: UMAPPoint[]
  pointSize?: number
  morphSpeed?: number
  colors?: string[]
}

/**
 * UMAPEmbedding — animated morph between n_neighbors values.
 * Each point interpolates between its current position and target position.
 */
export function UMAPEmbedding({
  points,
  pointSize = 0.12,
  morphSpeed = 0.02,
  colors = ["#FF6B35", "#00DCB4", "#9D4EDD", "#F59E0B", "#EF4444"],
}: UMAPEmbeddingProps) {
  const morphProgress = useRef(0)
  const direction = useRef(1)

  const { geometryData, colorArray } = useMemo(() => {
    const positions = new Float32Array(points.length * 3)
    const targets = new Float32Array(points.length * 3)
    const colArray = new Float32Array(points.length * 3)

    points.forEach((p, i) => {
      positions[i * 3] = p.position[0]
      positions[i * 3 + 1] = p.position[1]
      positions[i * 3 + 2] = p.position[2]

      targets[i * 3] = p.targetPosition[0]
      targets[i * 3 + 1] = p.targetPosition[1]
      targets[i * 3 + 2] = p.targetPosition[2]

      const color = new THREE.Color(colors[(p.group ?? 0) % colors.length])
      colArray[i * 3] = color.r
      colArray[i * 3 + 1] = color.g
      colArray[i * 3 + 2] = color.b
    })

    return { geometryData: { positions, targets }, colorArray: colArray }
  }, [points, colors])

  const geometryRef = useRef<THREE.BufferGeometry>(null)

  useFrame(() => {
    if (!geometryRef.current) return

    morphProgress.current += direction.current * morphSpeed
    if (morphProgress.current >= 1 || morphProgress.current <= 0) {
      direction.current *= -1
      morphProgress.current = Math.max(0, Math.min(1, morphProgress.current))
    }

    const t = morphProgress.current
    const pos = geometryRef.current.attributes.position.array as Float32Array
    const targets = geometryData.targets

    for (let i = 0; i < points.length; i++) {
      pos[i * 3] = geometryData.positions[i * 3] + (targets[i * 3] - geometryData.positions[i * 3]) * t
      pos[i * 3 + 1] = geometryData.positions[i * 3 + 1] + (targets[i * 3 + 1] - geometryData.positions[i * 3 + 1]) * t
      pos[i * 3 + 2] = geometryData.positions[i * 3 + 2] + (targets[i * 3 + 2] - geometryData.positions[i * 3 + 2]) * t
    }

    geometryRef.current.attributes.position.needsUpdate = true
  })

  if (points.length === 0) return null

  return (
    <points>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute
          args={[geometryData.positions, 3]}
          attach="attributes-position"
          count={points.length}
          itemSize={3}
        />
        <bufferAttribute
          args={[colorArray, 3]}
          attach="attributes-color"
          count={points.length}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={pointSize}
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  )
}
