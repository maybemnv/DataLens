"use client"

import { useMemo } from "react"
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

interface VegaLiteRendererProps {
  spec: VegaLiteSpec
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

export function VegaLiteRenderer({ spec }: VegaLiteRendererProps) {
  const config = useMemo(() => parseVegaLiteSpec(spec), [spec])

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
      margin: { top: 10, right: 20, bottom: 40, left: 50 },
    }

    const grid = <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
    const xAxis = (
      <XAxis
        dataKey={xKey}
        tick={{ fill: "#8B8B9E", fontSize: 11, fontFamily: "Geist Mono, monospace" }}
        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
        label={{ value: config.xLabel, position: "bottom", fill: "#6B6B80", fontSize: 10, fontFamily: "Geist Mono, monospace" }}
        angle={xKey.length > 12 ? -25 : 0}
        textAnchor={xKey.length > 12 ? "end" : "middle"}
        height={60}
      />
    )
    const yAxis = (
      <YAxis
        tick={{ fill: "#8B8B9E", fontSize: 11, fontFamily: "Geist Mono, monospace" }}
        axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
        tickLine={{ stroke: "rgba(255,255,255,0.1)" }}
        label={{ value: config.yLabel, angle: -90, position: "insideLeft", fill: "#6B6B80", fontSize: 10, fontFamily: "Geist Mono, monospace" }}
      />
    )
    const tooltip = <Tooltip content={<CUSTOM_TOOLTIP />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />

    switch (config.type) {
      case "bar": {
        const isGrouped = colorKey && data.some((d) => d[colorKey])
        if (isGrouped) {
          const groups = [...new Set(data.map((d) => String(d[colorKey])))] as string[]
          return (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart {...commonProps}>
                {grid}
                {xAxis}
                {yAxis}
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
              {xAxis}
              {yAxis}
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

      case "line":
        return (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart {...commonProps}>
              {grid}
              {xAxis}
              {yAxis}
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
              {xAxis}
              {yAxis}
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
              {xAxis}
              {yAxis}
              {tooltip}
              <Area type="monotone" dataKey={yKey} stroke="#00DCB4" fill="#00DCB4" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )

      default:
        return null
    }
  }, [config])

  if (!config) return null
  if (chartContent) return chartContent

  return (
    <div className="rounded border border-border bg-elevated p-4 font-mono text-[11px] text-text-muted">
      <pre className="overflow-x-auto">Unsupported chart type: {config.type}</pre>
    </div>
  )
}
