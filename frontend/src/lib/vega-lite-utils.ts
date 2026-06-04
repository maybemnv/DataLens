import type { VegaLiteSpec } from "@/lib/types"

export interface ChartConfig {
  type: "bar" | "line" | "scatter" | "area" | "histogram" | "box" | "heatmap" | "unknown"
  xField: string
  yField: string
  colorField: string | null
  title: string
  data: Record<string, unknown>[]
  xLabel: string
  yLabel: string
}

export function parseVegaLiteSpec(spec: VegaLiteSpec | null): ChartConfig | null {
  if (!spec || !spec.data?.values || spec.data.values.length === 0) return null

  const mark = typeof spec.mark === "string" ? spec.mark : spec.mark?.type || "unknown"
  const encoding = spec.encoding || {}
  const encX = encoding.x as Record<string, unknown> | undefined
  const encY = encoding.y as Record<string, unknown> | undefined
  const encColor = encoding.color as Record<string, unknown> | undefined

  const xField = (encX?.field as string) || ""
  const yField = (encY?.field as string) || ""
  const colorField = (encColor?.field as string) || null

  const rawTitle = spec.title
  const titleText = typeof rawTitle === "string" ? rawTitle : (rawTitle as { text?: string })?.text || ""

  const values = spec.data.values

  let chartType: ChartConfig["type"] = "unknown"
  if (mark === "bar") chartType = "bar"
  else if (mark === "line") chartType = "line"
  else if (mark === "point" || mark === "circle" || mark === "scatter") chartType = "scatter"
  else if (mark === "area") chartType = "area"
  else if (mark === "boxplot") chartType = "box"
  else if (mark === "histogram") chartType = "histogram"
  else if (mark === "heatmap") chartType = "heatmap"

  return {
    type: chartType,
    xField,
    yField,
    colorField,
    title: titleText,
    data: values,
    xLabel: (encX?.title as string) || xField,
    yLabel: (encY?.title as string) || yField,
  }
}
