"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Zap, X, ChevronRight, BarChart3, Sparkles } from "lucide-react"
import { useWorkspaceStore } from "@/lib/store"

interface Insight {
  title: string
  body: string
  type: "correlation" | "outlier" | "distribution" | "composition" | "trend" | "pattern"
}

interface AutoInsightModalProps {
  onDigDeeper: (insight: Insight) => void
  onShowVisualizations: () => void
  onDismiss: () => void
}

const TYPE_ICONS: Record<string, typeof Zap> = {
  correlation: Zap,
  outlier: Zap,
  distribution: BarChart3,
  composition: Sparkles,
  trend: BarChart3,
  pattern: Sparkles,
}

export function AutoInsightModal({ onDigDeeper, onShowVisualizations, onDismiss }: AutoInsightModalProps) {
  const [expanded, setExpanded] = useState<number | null>(0)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const sessionInfo = useWorkspaceStore((s) => s.sessionInfo)

  const insights = useMemo<Insight[]>(() => {
    if (!sessionInfo) return []
    const result: Insight[] = []
    const { columns, shape, dtypes, filename } = sessionInfo
    const numCols = columns.filter((c) => dtypes[c] === "number" || dtypes[c] === "float64" || dtypes[c] === "int64")
    const catCols = columns.filter((c) => dtypes[c] === "object" || dtypes[c] === "string" || dtypes[c] === "category")

    if (numCols.length >= 2) {
      result.push({
        type: "correlation",
        title: `${numCols.length} numeric columns available for correlation analysis`,
        body: `Dataset "${filename}" has ${numCols.length} numeric columns: ${numCols.slice(0, 5).join(", ")}${numCols.length > 5 ? ` and ${numCols.length - 5} more` : ""}. Correlations between these can reveal hidden relationships. ${numCols.length >= 3 ? "Consider running PCA on the top correlated features." : ""}`,
      })
    }

    if (catCols.length > 0) {
      result.push({
        type: "composition",
        title: `${catCols.length} categorical column${catCols.length > 1 ? "s" : ""} detected — group analysis available`,
        body: `Found ${catCols.length} categorical column${catCols.length > 1 ? "s" : ""}: ${catCols.join(", ")}. Use group_by_stats to break down numeric metrics by these categories.`,
      })
    }

    if (shape[0] > 100) {
      result.push({
        type: "distribution",
        title: `Large dataset detected: ${shape[0].toLocaleString()} rows × ${shape[1]} columns`,
        body: `With ${shape[0].toLocaleString()} rows, this dataset has enough data for meaningful statistical analysis. Consider checking for outliers, running clustering, or training a regression model. ${numCols.length >= 3 ? "UMAP or PCA can help visualize high-dimensional patterns." : ""}`,
      })
    }

    if (numCols.length >= 3) {
      result.push({
        type: "pattern",
        title: `Dimensionality reduction could reveal hidden structure`,
        body: `With ${numCols.length} numeric dimensions, PCA or UMAP can reduce this to 2D or 3D for visualization. Ask the agent to "run PCA" or "show me clusters" to explore the structure.`,
      })
    }

    if (result.length === 0) {
      result.push({
        type: "pattern",
        title: `Dataset "${filename}" has ${shape[1]} columns and ${shape[0].toLocaleString()} rows`,
        body: `Uploaded file: ${filename}. Shape: ${shape[0]} rows × ${shape[1]} columns. Columns: ${columns.join(", ")}. Ask the agent specific questions about your data.`,
      })
    }

    return result.slice(0, 5)
  }, [sessionInfo])

  useEffect(() => {
    closeButtonRef.current?.focus()
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss()
        return
      }
      if (e.key === "Tab" && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault()
            last?.focus()
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault()
            first?.focus()
          }
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [onDismiss])

  const handleExpand = useCallback((i: number) => {
    setExpanded((prev) => (prev === i ? null : i))
  }, [])

  if (!sessionInfo) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/10 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="insight-modal-title"
      aria-describedby="insight-modal-desc"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl overflow-hidden rounded-lg border border-border bg-surface shadow-xl animate-scale-in"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
              <Zap className="h-4 w-4 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 id="insight-modal-title" className="text-sm font-semibold text-text-primary">
                Auto-Insights — {sessionInfo.filename}
              </h2>
              <p id="insight-modal-desc" className="text-[11px] text-text-muted">
                {insights.length} patterns found
              </p>
            </div>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onDismiss}
            className="rounded p-1.5 text-text-muted transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Close insights"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Insights list */}
        <div className="divide-y divide-border">
          {insights.map((insight, i) => {
            const Icon = TYPE_ICONS[insight.type] || Zap
            return (
              <button
                key={i}
                onClick={() => handleExpand(i)}
                className="flex w-full items-start gap-3 px-6 py-4 text-left transition-colors hover:bg-elevated/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                aria-expanded={expanded === i}
              >
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  <Icon className="h-3 w-3" aria-hidden="true" />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-text-primary">{insight.title}</p>
                  {expanded === i && (
                    <p className="mt-2 text-sm leading-relaxed text-text-secondary animate-fade-in-up">
                      {insight.body}
                    </p>
                  )}
                </div>
                <ChevronRight
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0 text-text-muted transition-transform duration-200",
                    expanded === i && "rotate-90"
                  )}
                  aria-hidden="true"
                />
              </button>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
          <button
            onClick={onDismiss}
            className="rounded px-4 py-2 text-sm text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Dismiss
          </button>
          <button
            onClick={onShowVisualizations}
            className="flex items-center gap-1.5 rounded border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
            Visualizations
          </button>
          {expanded !== null && (
            <button
              onClick={() => onDigDeeper(insights[expanded])}
              className="flex items-center gap-1.5 rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Dig Deeper
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
