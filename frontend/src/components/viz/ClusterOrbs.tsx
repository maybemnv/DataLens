"use client"

import { useMemo, useRef } from "react"
import { useFrame } from "@react-three/fiber"
import * as THREE from "three"

interface ClusterPoint {
  position: [number, number, number]
  label?: string
}

interface ClusterOrbsProps {
  clusters: {
    center: [number, number, number]
    radius: number
    color: string
    label: string
    points?: ClusterPoint[]
  }[]
}

/**
 * ClusterOrbs — refractive semi-transparent spheres with interior points visible through layers.
 */
export function ClusterOrbs({ clusters }: ClusterOrbsProps) {
  const meshRefs = useRef<(THREE.Mesh | null)[]>([])

  const orbs = useMemo(() => {
    return clusters.map((c, i) => ({
      ...c,
      key: `orb-${i}`,
    }))
  }, [clusters])

  useFrame((_, delta) => {
    meshRefs.current.forEach((mesh) => {
      if (mesh) {
        mesh.rotation.x += delta * 0.05
        mesh.rotation.y += delta * 0.08
      }
    })
  })

  return (
    <group>
      {orbs.map((orb, i) => (
        <group key={orb.key}>
          {/* Refractive sphere */}
          <mesh
            ref={(el) => { meshRefs.current[i] = el }}
            position={orb.center}
          >
            <sphereGeometry args={[orb.radius, 48, 48]} />
            <meshPhysicalMaterial
              color={orb.color}
              transparent
              opacity={0.25}
              roughness={0.1}
              metalness={0.0}
              transmission={0.6}
              thickness={0.5}
              ior={1.5}
              envMapIntensity={0.4}
              clearcoat={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Interior points */}
          {orb.points?.map((pt, j) => (
            <mesh key={`pt-${j}`} position={pt.position}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshBasicMaterial color={orb.color} transparent opacity={0.7} />
            </mesh>
          ))}

          {/* Outer glow ring */}
          <mesh position={orb.center} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[orb.radius * 0.9, orb.radius * 1.1, 64]} />
            <meshBasicMaterial
              color={orb.color}
              transparent
              opacity={0.15}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
