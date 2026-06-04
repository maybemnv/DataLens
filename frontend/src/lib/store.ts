import { create } from "zustand"
import type { AgentState, VegaLiteSpec } from "@/lib/types"

// ─── Workspace Store ───────────────────────────────────────────────
// Centralized state for the workspace: chart specs, agent state,
// timeline steps, session info, and UI preferences.
// Eliminates prop-drilling and scattered useState calls.

export interface TimelineStep {
  label: string
  timestamp: string
}

export interface SessionInfo {
  filename: string
  shape: [number, number]
  columns: string[]
  dtypes: Record<string, string>
  missing_values?: number
}

interface WorkspaceState {
  // Chart visualization
  chartSpec: VegaLiteSpec | null
  setChartSpec: (spec: VegaLiteSpec | null) => void

  // Agent state
  agentState: AgentState
  setAgentState: (state: AgentState) => void

  // Timeline
  timelineSteps: TimelineStep[]
  addTimelineStep: (step: TimelineStep) => void
  clearTimelineSteps: () => void

  // Session info
  sessionInfo: SessionInfo | null
  setSessionInfo: (info: SessionInfo | null) => void

  // UI
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void

  vizPanelView: "3d" | "2d"
  setVizPanelView: (view: "3d" | "2d") => void

  vizPanelFullscreen: boolean
  setVizPanelFullscreen: (fs: boolean) => void

  autoInsightOpen: boolean
  setAutoInsightOpen: (open: boolean) => void

  // Timeline scrubber
  activeTimelineIndex: number | null
  setActiveTimelineIndex: (index: number | null) => void

  // Reset everything
  reset: () => void
}

const initialState = {
  chartSpec: null,
  agentState: "idle" as AgentState,
  timelineSteps: [] as TimelineStep[],
  sessionInfo: null as SessionInfo | null,
  sidebarOpen: true,
  vizPanelView: "3d" as "3d" | "2d",
  vizPanelFullscreen: false,
  autoInsightOpen: false,
  activeTimelineIndex: null as number | null,
}

export const useWorkspaceStore = create<WorkspaceState>()((set) => ({
  ...initialState,

  setChartSpec: (spec) => set({ chartSpec: spec }),

  setAgentState: (state) => set({ agentState: state }),

  addTimelineStep: (step) =>
    set((s) => ({
      timelineSteps: [...s.timelineSteps.slice(-19), step], // keep last 20
    })),

  clearTimelineSteps: () => set({ timelineSteps: [] }),

  setSessionInfo: (info) => set({ sessionInfo: info }),

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  setVizPanelView: (view) => set({ vizPanelView: view }),

  setVizPanelFullscreen: (fs) => set({ vizPanelFullscreen: fs }),

  setAutoInsightOpen: (open) => set({ autoInsightOpen: open }),

  setActiveTimelineIndex: (index) => set({ activeTimelineIndex: index }),

  reset: () => set(initialState),
}))
