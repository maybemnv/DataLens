"use client"

import { useCallback, useEffect, useMemo } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Maximize2, Minimize2, ImageDown, BarChart3, ScatterChart, Wifi, WifiOff } from "lucide-react"
import { useWorkspaceStore } from "@/lib/store"
import type { VegaLiteSpec } from "@/lib/types"
import { VegaLiteRenderer } from "@/components/charts/VegaLiteRenderer"
import { Scene3D } from "@/components/viz/Scene3D"
import { PCAScatter3D } from "@/components/viz/PCAScatter3D"
import { ClusterOrbs } from "@/components/viz/ClusterOrbs"
import { ParticleTrails } from "@/components/viz/ParticleTrails"
import { UMAPEmbedding } from "@/components/viz/UMAPEmbedding"
import { Sound } from "@/lib/sound"

interface VizPanelProps {
  chartSpec?: VegaLiteSpec | null
}

export function VizPanel({ chartSpec }: VizPanelProps) {
  const view = useWorkspaceStore((s) => s.vizPanelView)
  const setView = useWorkspaceStore((s) => s.setVizPanelView)
  const fullscreen = useWorkspaceStore((s) => s.vizPanelFullscreen)
  const setFullscreen = useWorkspaceStore((s) => s.setVizPanelFullscreen)
  const agentState = useWorkspaceStore((s) => s.agentState)
  const vizExpanded = useWorkspaceStore((s) => s.vizExpanded)
  const setVizExpanded = useWorkspaceStore((s) => s.setVizExpanded)
  const isActive = agentState === "thinking" || agentState === "executing"
  const isConnected = agentState !== "idle" || chartSpec !== null

  // Expand panel on first chart spec arrival
  useEffect(() => {
    if (chartSpec && !vizExpanded) {
      setVizExpanded(true)
      Sound.toggle()
      Sound.chime()
      Sound.toggle()
    }
  }, [chartSpec, vizExpanded, setVizExpanded])

  const handleToggleFullscreen = useCallback(() => {
    setFullscreen(!fullscreen)
  }, [fullscreen, setFullscreen])

  const handleExport = useCallback(() => {
    if (!chartSpec) return
    const blob = new Blob([JSON.stringify(chartSpec, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "chart-spec.json"
    a.click()
    URL.revokeObjectURL(url)
  }, [chartSpec])

  // Detect 3D-capable data
  const has3DData = useMemo(() => {
    if (!chartSpec?.data?.values || chartSpec.data.values.length === 0) return false
    const first = chartSpec.data.values[0]
    return (
      typeof first === "object" &&
      first !== null &&
      "x" in first &&
      "y" in first &&
      "z" in first
    )
  }, [chartSpec])

  // Extract 3D points
  const points3D = useMemo(() => {
    if (!has3DData || !chartSpec?.data?.values) return []
    return chartSpec.data.values.map((d) => ({
      x: Number(d.x ?? 0),
      y: Number(d.y ?? 0),
      z: Number(d.z ?? 0),
      label: "label" in d ? String(d.label) : undefined,
      group: "group" in d ? Number(d.group) : undefined,
    }))
  }, [has3DData, chartSpec])

  // Detect cluster data for ClusterOrbs + ParticleTrails
  const clusterOrbsData = useMemo(() => {
    if (!chartSpec?.data?.values || chartSpec.data.values.length === 0) return []
    const groups = new Map<string | number, { x: number; y: number; z: number; group?: number }[]>()
    chartSpec.data.values.forEach((d) => {
      const g = "group" in d ? d.group : "cluster" in d ? d.cluster : null
      if (g !== null && "x" in d && "y" in d && "z" in d) {
        const key = String(g)
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push({
          x: Number(d.x),
          y: Number(d.y),
          z: Number(d.z),
          group: Number(g),
        })
      }
    })
    if (groups.size === 0) return []

    const COLORS = ["#FF6B35", "#00DCB4", "#9D4EDD", "#F59E0B", "#EF4444"]
    const centers: { center: [number, number, number]; radius: number; color: string; label: string; points?: { position: [number, number, number] }[] }[] = []

    groups.forEach((pts, key) => {
      const avgX = pts.reduce((s, p) => s + p.x, 0) / pts.length
      const avgY = pts.reduce((s, p) => s + p.y, 0) / pts.length
      const avgZ = pts.reduce((s, p) => s + p.z, 0) / pts.length
      const maxDist = Math.sqrt(
        Math.max(...pts.map((p) => (p.x - avgX) ** 2 + (p.y - avgY) ** 2 + (p.z - avgZ) ** 2)),
      ) || 0.3
      const clusterNum = pts[0]?.group ?? 0
      centers.push({
        center: [avgX, avgY, avgZ],
        radius: maxDist + 0.1,
        color: COLORS[clusterNum % COLORS.length],
        label: `Cluster ${key}`,
        points: pts.slice(0, 20).map((p) => ({ position: [p.x, p.y, p.z] as [number, number, number] })),
      })
    })

    return centers
  }, [chartSpec])

  // Detect UMAP data (two sets of positions)
  const umapData = useMemo(() => {
    if (!chartSpec?.data?.values || chartSpec.data.values.length === 0) return []
    const hasEmbedding = chartSpec.data.values.some(
      (d) => "embedding_x" in d && "embedding_y" in d && "embedding_z" in d,
    )
    if (!hasEmbedding) return []

    return chartSpec.data.values.map((d) => ({
      position: [
        Number(d.x ?? d.pc1 ?? 0),
        Number(d.y ?? d.pc2 ?? 0),
        Number(d.z ?? d.pc3 ?? 0),
      ] as [number, number, number],
      targetPosition: [
        Number(d.embedding_x ?? d.x ?? 0),
        Number(d.embedding_y ?? d.y ?? 0),
        Number(d.embedding_z ?? d.z ?? 0),
      ] as [number, number, number],
      label: "label" in d ? String(d.label) : undefined,
      group: "group" in d ? Number(d.group) : undefined,
    }))
  }, [chartSpec])

  // Extract particle trail data from cluster confidence
  const trailData = useMemo(() => {
    if (!chartSpec?.data?.values || chartSpec.data.values.length === 0) return []
    const hasConfidence = chartSpec.data.values.some(
      (d) => "cluster" in d && "confidence" in d && "x" in d && "y" in d && "z" in d,
    )
    if (!hasConfidence) return []

    const groups = new Map<string, { x: number; y: number; z: number; confidence: number }[]>()
    chartSpec.data.values.forEach((d) => {
      const g = "cluster" in d ? String(d.cluster) : "group" in d ? String(d.group) : null
      if (g !== null && "confidence" in d && "x" in d && "y" in d && "z" in d) {
        if (!groups.has(g)) groups.set(g, [])
        groups.get(g)!.push({
          x: Number(d.x),
          y: Number(d.y),
          z: Number(d.z),
          confidence: Number(d.confidence),
        })
      }
    })

    const COLORS = ["#FF6B35", "#00DCB4", "#9D4EDD", "#F59E0B", "#EF4444"]
    const trails: { origin: [number, number, number]; color: string; confidence: number }[] = []

    groups.forEach((pts, key) => {
      const avgX = pts.reduce((s, p) => s + p.x, 0) / pts.length
      const avgY = pts.reduce((s, p) => s + p.y, 0) / pts.length
      const avgZ = pts.reduce((s, p) => s + p.z, 0) / pts.length
      const avgConf = pts.reduce((s, p) => s + p.confidence, 0) / pts.length
      const clusterNum = parseInt(key) || 0
      trails.push({
        origin: [avgX, avgY, avgZ],
        color: COLORS[clusterNum % COLORS.length],
        confidence: avgConf,
      })
    })

    return trails
  }, [chartSpec])

  const render2DView = useMemo(() => {
    if (chartSpec) {
      const titleText =
        typeof chartSpec.title === "string"
          ? chartSpec.title
          : chartSpec.title && typeof chartSpec.title === "object" && "text" in chartSpec.title
            ? String((chartSpec.title as { text: string }).text)
            : "Chart"

      return (
        <div className={cn("h-full p-4", vizExpanded && "animate-fade-in-up")}>
          <div className="rounded border border-border bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="text-sm font-semibold text-text-primary">{titleText}</p>
            </div>

            <VegaLiteRenderer spec={chartSpec} />

            {/* Data table fallback */}
            {chartSpec.data?.values && chartSpec.data.values.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-[11px] font-medium text-text-muted hover:text-text-secondary">
                  Data ({chartSpec.data.values.length} rows)
                </summary>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-left text-xs" aria-label="Chart data">
                    <thead>
                      <tr className="border-b border-border">
                        {Object.keys(chartSpec.data.values[0]).map((key) => (
                          <th key={key} className="px-2 py-1.5 font-medium text-text-muted">
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chartSpec.data.values.slice(0, 10).map((row, i) => (
                        <tr key={i} className="border-b border-border/50 animate-unfold" style={{ animationDelay: `${i * 30}ms` }}>
                          {Object.values(row).map((val, j) => (
                            <td key={j} className="px-2 py-1.5 text-text-secondary">
                              {String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {chartSpec.data.values.length > 10 && (
                    <p className="mt-2 text-center text-[11px] text-text-muted">
                      Showing 10 of {chartSpec.data.values.length} rows
                    </p>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <BarChart3 className="mb-3 h-10 w-10 text-text-disabled" aria-hidden="true" />
        <p className="text-sm font-medium text-text-secondary">No chart yet</p>
        <p className="mt-1 text-xs text-text-muted">Ask the agent to create a visualization</p>
      </div>
    )
  }, [chartSpec, vizExpanded])

  const render3DView = useMemo(() => {
    const hasOrbs = clusterOrbsData.length > 0
    const hasTrails = trailData.length > 0
    const hasUMAP = umapData.length > 0

    if (points3D.length > 0 || hasOrbs || hasTrails || hasUMAP) {
      return (
        <Scene3D>
          {points3D.length > 0 && <PCAScatter3D points={points3D} showLabels />}
          {hasOrbs && <ClusterOrbs clusters={clusterOrbsData} />}
          {hasTrails && <ParticleTrails trails={trailData} />}
          {hasUMAP && <UMAPEmbedding points={umapData} />}
        </Scene3D>
      )
    }
    if (chartSpec) {
      return (
        <Scene3D>
          <PCAScatter3D points={[]} />
        </Scene3D>
      )
    }
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-text-muted">
          3D view requires real data. Ask the agent to run PCA or clustering.
        </p>
      </div>
    )
  }, [points3D, chartSpec, clusterOrbsData, trailData, umapData])

  return (
    <div
      className={cn(
        "flex flex-col",
        fullscreen ? "fixed inset-0 z-50 bg-elevated" : "h-full",
      )}
      role="region"
      aria-label="Visualization panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-text-muted">VIZ</span>
          <span
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              isConnected ? "bg-success/10 text-success" : "bg-elevated text-text-disabled",
            )}
            aria-label={isConnected ? "Agent active" : "Standby"}
          >
            {isConnected ? <Wifi className="h-2.5 w-2.5" aria-hidden="true" /> : <WifiOff className="h-2.5 w-2.5" aria-hidden="true" />}
            {isConnected ? (isActive ? "Active" : "Ready") : "Standby"}
          </span>
          {chartSpec && (
            <span className="animate-fade-in-up text-[10px] text-success">✦ New</span>
          )}
        </div>

        <div className="flex items-center gap-0.5" role="toolbar" aria-label="Visualization controls">
          {[
            { id: "3d" as const, title: "3D view", Icon: ScatterChart },
            { id: "2d" as const, title: "2D view", Icon: BarChart3 },
          ].map(({ id, title, Icon }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              title={title}
              aria-label={title}
              aria-pressed={view === id}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                view === id ? "bg-elevated text-text-primary" : "text-text-muted hover:text-text-secondary",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ))}
          <button
            title="Export chart spec"
            onClick={handleExport}
            disabled={!chartSpec}
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:text-text-secondary disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Export chart specification as JSON"
          >
            <ImageDown className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            onClick={handleToggleFullscreen}
            className="flex h-7 w-7 items-center justify-center rounded text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={fullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden border-t border-border">
        {view === "3d" ? (
          render3DView
        ) : (
          <ScrollArea className="h-full">
            {render2DView}
          </ScrollArea>
        )}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-t border-border px-2 py-1.5 sm:px-3 sm:py-2" role="tablist" aria-label="Visualization types">
        {["PCA", "Clusters", "Forecast"].map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={false}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              "text-text-muted hover:text-text-secondary",
            )}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  )
}
