"use client"

import { useRef, useEffect, useCallback } from "react"
import * as d3Force from "d3-force"

interface ForceNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
}

interface ForceLink {
  source: string
  target: string
  value: number
}

interface ForceDirectedGraphProps {
  nodes: { id: string; group?: number; weight?: number }[]
  links: { source: string; target: string; value: number }[]
  width?: number
  height?: number
  nodeColor?: (node: { id: string; group?: number }) => string
  linkColor?: (value: number) => string
  onNodeClick?: (id: string) => void
}

const DEFAULT_NODE_COLORS = ["#FF6B35", "#00DCB4", "#9D4EDD", "#F59E0B", "#EF4444", "#3B82F6"]

export function ForceDirectedGraph({
  nodes: inNodes,
  links: inLinks,
  width = 400,
  height = 300,
  nodeColor,
  linkColor,
  onNodeClick,
}: ForceDirectedGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const simRef = useRef<d3Force.Simulation<ForceNode, ForceLink> | null>(null)

  const getNodeColor = useCallback(
    (n: { id: string; group?: number }) =>
      nodeColor?.(n) ?? DEFAULT_NODE_COLORS[(n.group ?? 0) % DEFAULT_NODE_COLORS.length],
    [nodeColor],
  )

  const getLinkColor = useCallback(
    (v: number) => linkColor?.(v) ?? (v > 0.5 ? "#00DCB4" : v > 0.3 ? "#FF6B35" : "rgba(255,255,255,0.15)"),
    [linkColor],
  )

  useEffect(() => {
    if (!svgRef.current) return

    const svg = svgRef.current
    const svgNS = "http://www.w3.org/2000/svg"

    // Build simulation
    const forceNodes: ForceNode[] = inNodes.map((n) => ({ id: n.id, x: width / 2, y: height / 2, vx: 0, vy: 0 }))
    const forceLinks: ForceLink[] = inLinks.map((l) => ({ source: l.source, target: l.target, value: l.value }))
    const nodeMap = new Map(forceNodes.map((n) => [n.id, n]))

    const simulation = d3Force
      .forceSimulation(forceNodes)
      .force("link", d3Force.forceLink<ForceNode, ForceLink>(forceLinks).id((d) => d.id).distance(80).strength((l) => Math.abs(l.value)))
      .force("charge", d3Force.forceManyBody().strength(-200))
      .force("center", d3Force.forceCenter(width / 2, height / 2))
      .force("collision", d3Force.forceCollide().radius(25))

    simRef.current = simulation

    // Draw links
    const linkGroup = document.createElementNS(svgNS, "g")
    const linkElements: SVGLineElement[] = forceLinks.map((l) => {
      const line = document.createElementNS(svgNS, "line")
      line.setAttribute("stroke", getLinkColor(l.value))
      line.setAttribute("stroke-width", String(Math.max(1, Math.abs(l.value) * 4)))
      line.setAttribute("stroke-opacity", "0.5")
      line.setAttribute("stroke-linecap", "round")
      linkGroup.appendChild(line)
      return line
    })
    svg.appendChild(linkGroup)

    // Draw nodes
    const nodeGroup = document.createElementNS(svgNS, "g")
    const nodeElements: { circle: SVGCircleElement; label: SVGTextElement }[] = forceNodes.map((n) => {
      const g = document.createElementNS(svgNS, "g")
      g.style.cursor = "pointer"

      const circle = document.createElementNS(svgNS, "circle")
      circle.setAttribute("r", "8")
      circle.setAttribute("fill", getNodeColor({ id: n.id, group: inNodes.find((x) => x.id === n.id)?.group }))
      circle.setAttribute("stroke", "rgba(255,255,255,0.2)")
      circle.setAttribute("stroke-width", "1")
      g.appendChild(circle)

      const label = document.createElementNS(svgNS, "text")
      label.textContent = n.id
      label.setAttribute("fill", "#C8C4BC")
      label.setAttribute("font-size", "10")
      label.setAttribute("font-family", "Geist Mono, monospace")
      label.setAttribute("dx", "12")
      label.setAttribute("dy", "4")
      g.appendChild(label)

      if (onNodeClick) {
        g.addEventListener("click", () => onNodeClick(n.id))
      }

      nodeGroup.appendChild(g)
      return { circle, label }
    })
    svg.appendChild(nodeGroup)

    // Tick
    simulation.on("tick", () => {
      linkElements.forEach((line, i) => {
        const l = forceLinks[i]
        const src = typeof l.source === "object" ? l.source : nodeMap.get(l.source as string)
        const tgt = typeof l.target === "object" ? l.target : nodeMap.get(l.target as string)
        if (src && tgt) {
          line.setAttribute("x1", String(src.x))
          line.setAttribute("y1", String(src.y))
          line.setAttribute("x2", String(tgt.x))
          line.setAttribute("y2", String(tgt.y))
        }
      })
      nodeElements.forEach((el, i) => {
        const n = forceNodes[i]
        el.circle.setAttribute("cx", String(n.x))
        el.circle.setAttribute("cy", String(n.y))
        el.label.setAttribute("x", String(n.x))
        el.label.setAttribute("y", String(n.y))
      })
    })

    // Warm up
    simulation.alpha(1).restart()

    return () => {
      simulation.stop()
      svg.innerHTML = ""
    }
  }, [inNodes, inLinks, width, height, getNodeColor, getLinkColor, onNodeClick])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="overflow-visible"
      style={{ background: "transparent" }}
    />
  )
}
