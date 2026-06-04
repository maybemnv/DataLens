"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { FileText, Hash, Type, Calendar, ChevronRight, ChevronDown, Upload, Settings, Trash2 } from "lucide-react"
import { useWorkspaceStore } from "@/lib/store"

function SectionToggle({
  label,
  open,
  onToggle,
}: {
  label: string
  open: boolean
  onToggle: () => void
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between px-4 py-2 text-[11px] font-semibold uppercase tracking-widest text-text-muted transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      aria-expanded={open}
    >
      {label}
      {open ? <ChevronDown className="h-3 w-3" aria-hidden="true" /> : <ChevronRight className="h-3 w-3" aria-hidden="true" />}
    </button>
  )
}

export function Sidebar() {
  const [sections, setSections] = useState({ columns: true, history: false })
  const sessionInfo = useWorkspaceStore((s) => s.sessionInfo)

  const toggle = (k: keyof typeof sections) =>
    setSections((p) => ({ ...p, [k]: !p[k] }))

  const numericCols = sessionInfo?.columns.filter((c) => sessionInfo.dtypes[c]?.match(/int|float/i)) ?? []
  const textCols = sessionInfo?.columns.filter((c) => sessionInfo.dtypes[c]?.match(/object|string|category/i)) ?? []
  const dateCols = sessionInfo?.columns.filter((c) => sessionInfo.dtypes[c]?.match(/date|time/i)) ?? []
  const missingValues = sessionInfo?.missing_values ?? 0

  return (
    <div className="flex h-full flex-col" role="complementary" aria-label="Session sidebar">
      {/* Header */}
      <div className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-elevated">
            <FileText className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text-primary" title={sessionInfo?.filename}>
              {sessionInfo?.filename ?? "No file"}
            </p>
            {sessionInfo && (
              <p className="text-[11px] text-text-muted">
                {sessionInfo.shape[0].toLocaleString()} × {sessionInfo.shape[1]}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats — always visible when data loaded */}
      {sessionInfo && (
        <div className="mx-4 mb-3 rounded bg-elevated p-3" aria-label="Dataset quick stats">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Quick Stats
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { count: numericCols.length, label: "Numeric", icon: <Hash className="h-3 w-3" aria-hidden="true" /> },
              { count: textCols.length, label: "Text", icon: <Type className="h-3 w-3" aria-hidden="true" /> },
              { count: dateCols.length, label: "Date", icon: <Calendar className="h-3 w-3" aria-hidden="true" /> },
            ].map(({ count, label, icon }) => (
              <div key={label}>
                <div className="text-base font-bold text-text-primary">{count}</div>
                <div className="flex items-center justify-center gap-0.5 text-[10px] text-text-muted">
                  {icon}
                  {label}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-text-muted">
            <span aria-label={`${missingValues} missing values`}>
              {missingValues} missing value{missingValues !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        {/* Columns */}
        <SectionToggle label="Columns" open={sections.columns} onToggle={() => toggle("columns")} />
        {sections.columns && (
          <div className="px-2 pb-2">
            {[
              { name: "Numeric", cols: numericCols, color: "text-success" },
              { name: "Text", cols: textCols, color: "text-agent" },
              { name: "Date", cols: dateCols, color: "text-primary" },
            ].map(({ name, cols, color }) =>
              cols.length > 0 ? (
                <div key={name} className="mb-3">
                  <p className={cn("mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest", color)}>
                    {name}
                  </p>
                  <ul aria-label={`${name} columns`}>
                    {cols.map((col) => (
                      <li key={col}>
                        <button
                          className="flex w-full items-center rounded px-2 py-1.5 text-left text-sm text-text-secondary transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          aria-label={`Column: ${col}`}
                        >
                          {col}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null
            )}
            {!sessionInfo && (
              <p className="px-2 py-4 text-center text-xs text-text-disabled">Upload a file to browse columns</p>
            )}
          </div>
        )}

        <div className="my-1 mx-4 h-px bg-border" role="separator" />

        {/* History — no hardcoded items, show only if available */}
        <SectionToggle label="History" open={sections.history} onToggle={() => toggle("history")} />
        {sections.history && (
          <div className="px-2 pb-2">
            <p className="px-2 py-4 text-center text-xs text-text-disabled">
              Session history will appear here
            </p>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs text-text-muted transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Upload className="h-3.5 w-3.5" aria-hidden="true" />
            Upload
          </button>
          <button
            onClick={() => useWorkspaceStore.getState().reset()}
            className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-elevated hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Clear session"
            title="Clear session"
          >
            <Trash2 className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
          </button>
          <button className="flex h-8 w-8 items-center justify-center rounded transition-colors hover:bg-elevated hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label="Settings">
            <Settings className="h-3.5 w-3.5 text-text-muted" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  )
}
