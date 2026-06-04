"use client"

import { useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Sidebar } from "@/components/layout/sidebar"
import { AgentChat } from "@/components/agent/AgentChat"
import { VizPanel } from "@/components/layout/VizPanel"
import { useWorkspaceStore } from "@/lib/store"
import type { VegaLiteSpec } from "@/lib/types"
import { PanelLeftClose, PanelLeftOpen, X, ChartBar } from "lucide-react"

interface ThreePanelLayoutProps {
  sessionId: string
  sessionInfo?: {
    filename: string
    shape: [number, number]
    columns: string[]
    dtypes: Record<string, string>
    missing_values?: number
  }
}

/**
 * ThreePanelLayout — responsive workspace layout.
 * - Desktop (>1280px): 3-column layout with sidebar, chat, viz panel
 * - Tablet (768-1280px): 2-column, sidebar collapses, viz panel overlays
 * - Mobile (<768px): single column, both panels overlay
 */
export function ThreePanelLayout({ sessionId, sessionInfo }: ThreePanelLayoutProps) {
  const setChartSpec = useWorkspaceStore((s) => s.setChartSpec)
  const addTimelineStep = useWorkspaceStore((s) => s.addTimelineStep)
  const timelineSteps = useWorkspaceStore((s) => s.timelineSteps)
  const agentState = useWorkspaceStore((s) => s.agentState)
  const sidebarOpen = useWorkspaceStore((s) => s.sidebarOpen)
  const setSidebarOpen = useWorkspaceStore((s) => s.setSidebarOpen)
  const vizPanelFullscreen = useWorkspaceStore((s) => s.vizPanelFullscreen)
  const vizPanelOpen = useWorkspaceStore((s) => s.vizPanelView === "2d")

  // Set session info on mount
  useState(() => {
    if (sessionInfo) {
      useWorkspaceStore.getState().setSessionInfo({
        filename: sessionInfo.filename,
        shape: sessionInfo.shape,
        columns: sessionInfo.columns,
        dtypes: sessionInfo.dtypes,
        missing_values: sessionInfo.missing_values,
      })
    }
  })

  const handleChartSpec = useCallback((spec: VegaLiteSpec) => {
    setChartSpec(spec)
  }, [setChartSpec])

  const handleTimelineStep = useCallback((step: { label: string; timestamp: string }) => {
    addTimelineStep(step)
  }, [addTimelineStep])

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — responsive width */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-full w-[280px] flex-shrink-0 flex-col bg-surface transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 lg:w-[260px]",
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:w-0 lg:overflow-hidden"
        )}
      >
        <Sidebar />
      </aside>

      {/* Toggle sidebar button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={cn(
          "absolute top-3 z-50 flex h-8 w-8 items-center justify-center rounded border border-border bg-surface text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          sidebarOpen ? "left-[268px] lg:left-auto" : "left-3"
        )}
        aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
      >
        {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </button>

      {/* Agent Chat — flex grow */}
      <main className="flex min-w-0 flex-1 flex-col bg-background" role="main">
        <AgentChat
          sessionId={sessionId}
          onChartSpec={handleChartSpec}
          onTimelineStep={handleTimelineStep}
        />

        {/* Timeline bar */}
        <div className="shrink-0 border-t border-border bg-surface px-4 py-2">
          <div className="flex items-center gap-1 overflow-x-auto" role="list" aria-label="Agent timeline">
            {timelineSteps.length === 0 ? (
              <span className="text-[11px] text-text-disabled">
                Agent timeline — steps appear here as the agent works
              </span>
            ) : (
              timelineSteps.map((step, i) => (
                <button
                  key={`${step.label}-${i}`}
                  onClick={() => useWorkspaceStore.getState().setActiveTimelineIndex(i)}
                  className="flex shrink-0 items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  role="listitem"
                  aria-label={`Step ${i + 1}: ${step.label}`}
                >
                  <div className="flex flex-col items-center gap-0.5">
                    <div
                      className={cn(
                        "h-2 w-2 rounded-full transition-transform",
                        i === timelineSteps.length - 1 && agentState !== "idle"
                          ? "bg-primary animate-pulse-fast"
                          : "bg-success",
                        useWorkspaceStore.getState().activeTimelineIndex === i && "scale-150"
                      )}
                      aria-hidden="true"
                    />
                    <span className="max-w-[72px] truncate text-[10px] text-text-muted hover:text-text-primary transition-colors" title={step.label}>
                      {step.label}
                    </span>
                    <span className="font-mono text-[9px] tabular-nums text-text-disabled">
                      {step.timestamp}
                    </span>
                  </div>
                  {i < timelineSteps.length - 1 && (
                    <div className="mx-1.5 h-px w-5 bg-border" aria-hidden="true" />
                  )}
                </button>
              ))
            )}
            {agentState === "idle" && timelineSteps.length > 0 && (
              <span className="ml-auto shrink-0 text-[11px] text-success" aria-label="Analysis complete">
                ✓ Done
              </span>
            )}
          </div>
        </div>
      </main>

      {/* Viz Panel — toggleable on desktop, overlay on mobile */}
      {vizPanelFullscreen ? (
        <div className="fixed inset-0 z-50 bg-elevated">
          <button
            onClick={() => useWorkspaceStore.getState().setVizPanelFullscreen(false)}
            className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded bg-surface/90 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="Exit fullscreen"
          >
            <X className="h-4 w-4" />
          </button>
          <VizPanel />
        </div>
      ) : (
        <>
          {/* Toggle viz panel button — always visible */}
          <button
            onClick={() => useWorkspaceStore.getState().setVizPanelView(vizPanelOpen ? "3d" : "2d")}
            className={cn(
              "fixed bottom-24 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
              vizPanelOpen
                ? "bg-primary text-primary-foreground hover:bg-primary-hover"
                : "bg-surface border border-border text-text-muted hover:text-text-primary"
            )}
            aria-label={vizPanelOpen ? "Hide visualization panel" : "Show visualization panel"}
            title="Toggle visualization panel"
          >
            <ChartBar className="h-4 w-4" />
          </button>

          {/* Viz Panel — desktop only, slide-in panel */}
          <aside
            className={cn(
              "fixed inset-y-0 right-0 z-40 flex h-full w-[400px] flex-shrink-0 flex-col bg-elevated transition-transform duration-200 ease-in-out",
              vizPanelOpen ? "translate-x-0" : "translate-x-full"
            )}
          >
            <VizPanel />
          </aside>

          {/* Overlay when viz panel is open on smaller screens */}
          {vizPanelOpen && (
            <div
              className="fixed inset-0 z-30 bg-background/40 backdrop-blur-sm xl:hidden"
              onClick={() => useWorkspaceStore.getState().setVizPanelView("3d")}
              aria-hidden="true"
            />
          )}
        </>
      )}
    </div>
  )
}
