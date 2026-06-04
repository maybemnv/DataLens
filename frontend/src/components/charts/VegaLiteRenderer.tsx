"use client"

import { useMemo, useCallback, useRef } from "react"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import type { VegaLiteSpec } from "@/lib/types"
import { parseVegaLiteSpec } from "@/lib/vega-lite-utils"
import { Download } from "lucide-react"

interface VegaLiteRendererProps {
  spec: VegaLiteSpec
  onExportPNG?: () => void
}

const COLORS = ["#FF6B35", "#00DCB4", "#9D4EDD", "#F59E0B", "#EF4444", "#3B82F6", "#8B5CF6", "#EC4899"]

const CUSTOM_TOOLTIP = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded border border-border bg-surface/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-medium text-text-primary">{label ?? ""}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-text-secondary">
          {entry.name}: <span className="font-medium text-text-primary">{typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}</span>
        </p>
      ))}
    </div>
  )
}

function exportChartToPNG(container: HTMLElement | null, filename = "chart.png") {
  if (!container) return
  const svg = container.querySelector("svg")
  if (!svg) return

  const svgData = new XMLSerializer().serializeToString(svg)
  const canvas = document.createElement("canvas")
  const rect = svg.getBoundingClientRect()
  canvas.width = rect.width * 2
  canvas.height = rect.height * 2
  const ctx = canvas.getContext("2d")
  if (!ctx) return

  ctx.scale(2, 2)
  const img = new Image()
  const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  img.onload = () => {
    ctx.fillStyle = "#1A1714"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, rect.width, rect.height)
    URL.revokeObjectURL(url)
    canvas.toBlob((b) => {
      if (!b) return
      const a = document.createElement("a")
      a.href = URL.createObjectURL(b)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    }, "image/png")
  }
  img.src = url
}

export function VegaLiteRenderer({ spec, onExportPNG }: VegaLiteRendererProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const config = useMemo(() => parseVegaLiteSpec(spec), [spec])

  const isHorizontal = useMemo(() => {
    if (!spec?.encoding) return false
    const enc = spec.encoding as Record<string, unknown>
    const encY = enc.y as Record<string, unknown> | undefined
    return encY?.type === "nominal" || encY?.type === "ordinal"
  }, [spec])

  const handleExport = useCallback(() => {
    if (onExportPNG) {
      onExportPNG()
    } else {
      exportChartToPNG(chartRef.current)
    }
  }, [onExportPNG])

  const chartContent = useMemo(() => {
    if (!config || config.data.length === 0) return null

    const data = config.data
    const xKey = config.xField || Object.keys(data[0])[0] || ""
    const yKey = config.yField || (Object.keys(data[0]).length > 1 ? Object.keys(data[0])[1] : "") || ""
    const colorKey = config.colorField

    const commonProps = {
      width: 500,
      height: 300,
      data,
      margin: { top: 10, right: 20, bottom: 40, left: 60 },
    }

    const grid = <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
    const tooltip = <Tooltip content={<CUSTOM_TOOLTIP />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
    const axisStyle = { fill: "#8B8B9E", fontSize: 11, fontFamily: "Geist Mono, monospace" }
    const axisLineStyle = { stroke: "rgba(255,255,255,0.1)" }
    const labelStyle = { fill: "#6B6B80", fontSize: 10, fontFamily: "Geist Mono, monospace" }

    switch (config.type) {
      case "bar": {
        const isGrouped = colorKey && data.some((d) => d[colorKey])

        if (isHorizontal) {
          return (
            <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
              <BarChart {...commonProps} layout="vertical" margin={{ top: 10, right: 20, bottom: 20, left: 120 }}>
                {grid}
                <XAxis type="number" tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.xLabel, position: "bottom", ...labelStyle }} />
                <YAxis type="category" dataKey={xKey} tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.yLabel, angle: -90, position: "insideLeft", ...labelStyle }} width={110} />
                {tooltip}
                <Bar dataKey={yKey} fill="#FF6B35" radius={[0, 2, 2, 0]} maxBarSize={24}>
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )
        }

        if (isGrouped) {
          const groups = [...new Set(data.map((d) => String(d[colorKey])))] as string[]
          return (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart {...commonProps}>
                {grid}
                <XAxis dataKey={xKey} tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.xLabel, position: "bottom", ...labelStyle }} angle={xKey.length > 12 ? -25 : 0} textAnchor={xKey.length > 12 ? "end" : "middle"} height={60} />
                <YAxis tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.yLabel, angle: -90, position: "insideLeft", ...labelStyle }} />
                {tooltip}
                {groups.map((group, i) => (
                  <Bar key={group} dataKey={yKey} fill={COLORS[i % COLORS.length]} name={group} radius={[2, 2, 0, 0]} maxBarSize={32} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )
        }
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart {...commonProps}>
              {grid}
              <XAxis dataKey={xKey} tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.xLabel, position: "bottom", ...labelStyle }} angle={xKey.length > 12 ? -25 : 0} textAnchor={xKey.length > 12 ? "end" : "middle"} height={60} />
              <YAxis tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.yLabel, angle: -90, position: "insideLeft", ...labelStyle }} />
              {tooltip}
              <Bar dataKey={yKey} fill="#FF6B35" radius={[2, 2, 0, 0]} maxBarSize={48}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }

      case "histogram": {
        const bins = 20
        const values = data.map((d) => Number(d[xKey] ?? d[yKey] ?? 0)).filter((v) => !isNaN(v))
        if (values.length === 0) return null
        const min = Math.min(...values)
        const max = Math.max(...values)
        const binWidth = (max - min) / bins || 1
        const binned = Array.from({ length: bins }, (_, i) => {
          const start = min + i * binWidth
          const end = start + binWidth
          return { range: `${start.toFixed(1)}–${end.toFixed(1)}`, count: values.filter((v) => v >= start && v < end).length }
        })
        return (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart width={500} height={300} data={binned} margin={{ top: 10, right: 20, bottom: 40, left: 50 }}>
              {grid}
              <XAxis dataKey="range" tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.xLabel || xKey, position: "bottom", ...labelStyle }} angle={-25} textAnchor="end" height={80} />
              <YAxis tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: "Count", angle: -90, position: "insideLeft", ...labelStyle }} />
              {tooltip}
              <Bar dataKey="count" fill="#FF6B35" radius={[2, 2, 0, 0]}>
                {binned.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }

      case "line":
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart {...commonProps}>
              {grid}
              <XAxis dataKey={xKey} tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.xLabel, position: "bottom", ...labelStyle }} angle={xKey.length > 12 ? -25 : 0} textAnchor={xKey.length > 12 ? "end" : "middle"} height={60} />
              <YAxis tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.yLabel, angle: -90, position: "insideLeft", ...labelStyle }} />
              {tooltip}
              <Line type="monotone" dataKey={yKey} stroke="#FF6B35" strokeWidth={2} dot={{ fill: "#FF6B35", r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        )

      case "scatter":
        return (
          <ResponsiveContainer width="100%" height={320}>
            <ScatterChart {...commonProps} margin={{ top: 10, right: 20, bottom: 40, left: 50 }}>
              {grid}
              <XAxis dataKey={xKey} tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.xLabel, position: "bottom", ...labelStyle }} />
              <YAxis tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.yLabel, angle: -90, position: "insideLeft", ...labelStyle }} />
              {tooltip}
              <Scatter data={data} fill="#FF6B35">
                {data.map((_, i) => (
                  <Cell key={i} fill={colorKey && data[i][colorKey] ? COLORS[String(data[i][colorKey]).length % COLORS.length] : COLORS[i % COLORS.length]} />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        )

      case "area":
        return (
          <ResponsiveContainer width="100%" height={320}>
            <AreaChart {...commonProps}>
              {grid}
              <XAxis dataKey={xKey} tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.xLabel, position: "bottom", ...labelStyle }} angle={xKey.length > 12 ? -25 : 0} textAnchor={xKey.length > 12 ? "end" : "middle"} height={60} />
              <YAxis tick={axisStyle} axisLine={axisLineStyle} tickLine={axisLineStyle} label={{ value: config.yLabel, angle: -90, position: "insideLeft", ...labelStyle }} />
              {tooltip}
              <Area type="monotone" dataKey={yKey} stroke="#00DCB4" fill="#00DCB4" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )

      default:
        return null
    }
  }, [config, isHorizontal])

  return (
    <div>
      <div ref={chartRef} className="relative">
        {chartContent}
        {config && (
          <button
            onClick={handleExport}
            className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded bg-surface/80 text-text-muted opacity-0 transition-opacity hover:opacity-100 hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Export as PNG"
            aria-label="Export chart as PNG"
          >
            <Download className="h-3 w-3" />
          </button>
        )}
      </div>
      {!config && (
        <div className="rounded border border-border bg-elevated p-4 font-mono text-[11px] text-text-muted">
          <pre className="overflow-x-auto">Unsupported or empty chart spec</pre>
        </div>
      )}
    </div>
  )
}
