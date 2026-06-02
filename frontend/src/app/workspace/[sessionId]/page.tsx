"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { ThreePanelLayout } from "@/components/layout/ThreePanelLayout"
import { AutoInsightModal } from "@/components/agent/AutoInsightModal"
import { BackendStatusIndicator } from "@/components/ui/BackendStatusIndicator"
import { api, type SessionInfo } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth"
import { useWorkspaceStore } from "@/lib/store"
import { AlertCircle, Sparkles } from "lucide-react"

const AUTO_INSIGHTS = [
  {
    title: "Spending variance is increasing over time",
    body: "While total budget grew over the period, variance between agencies is accelerating — suggesting diverging budget priorities across departments.",
  },
  {
    title: "One category dominates disproportionate budget share",
    body: "A small subset of categories consumes the majority of total expenditure relative to their program count, indicating a high cost-per-program ratio.",
  },
  {
    title: "Q4 spending spikes correlate with lower outcome scores",
    body: "Agencies that spend heavily in Q4 show lower output metrics — consistent with rushed end-of-year budget consumption.",
  },
]

export default function WorkspacePage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const { checkAuth } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const autoInsightOpen = useWorkspaceStore((s) => s.autoInsightOpen)
  const setAutoInsightOpen = useWorkspaceStore((s) => s.setAutoInsightOpen)
  const resetWorkspace = useWorkspaceStore((s) => s.reset)

  // Check auth on mount
  useEffect(() => {
    checkAuth().then(() => {
      const t = localStorage.getItem("datalens_token")
      if (!t) {
        router.push(`/login?redirect=/workspace/${sessionId}`)
      }
    })
  }, [checkAuth, router, sessionId])

  // Fetch session info on mount
  useEffect(() => {
    const t = localStorage.getItem("datalens_token")
    if (!t) return

    let cancelled = false

    api.getSessionInfo(sessionId)
      .then((info) => {
        if (cancelled) return
        setSessionInfo(info)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Session not found")
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      resetWorkspace()
    }
  }, [resetWorkspace])

  const handleShowInsights = useCallback(() => {
    setAutoInsightOpen(true)
  }, [setAutoInsightOpen])

  const handleDismissInsights = useCallback(() => {
    setAutoInsightOpen(false)
  }, [setAutoInsightOpen])

  const handleDigDeeper = useCallback(() => {
    setAutoInsightOpen(false)
  }, [setAutoInsightOpen])

  const handleShowVisualizations = useCallback(() => {
    setAutoInsightOpen(false)
  }, [setAutoInsightOpen])

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background" role="status" aria-label="Loading workspace">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary animate-pulse-fast" aria-hidden="true" />
          <p className="text-sm text-text-muted">Loading session…</p>
        </div>
      </div>
    )
  }

  if (error || !sessionInfo) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center" role="alert" aria-label="Session error">
        <AlertCircle className="h-12 w-12 text-error/60" aria-hidden="true" />
        <div>
          <h2 className="text-lg font-semibold text-text-primary">{error || "Session not found"}</h2>
          <p className="mt-1 max-w-sm text-sm text-text-muted">
            The session may have expired or the backend restarted.
          </p>
        </div>
        <BackendStatusIndicator />
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/")}
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Upload New Dataset
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Retry
          </button>
        </div>
        <pre className="max-w-md break-all rounded bg-surface px-4 py-2 font-mono text-[11px] text-text-muted">
          {sessionId}
        </pre>
      </div>
    )
  }

  return (
    <>
      {/* Insight modal — triggered by user action, not a timer */}
      {autoInsightOpen && (
        <AutoInsightModal
          insights={AUTO_INSIGHTS}
          onDigDeeper={handleDigDeeper}
          onShowVisualizations={handleShowVisualizations}
          onDismiss={handleDismissInsights}
        />
      )}
      <ThreePanelLayout
        sessionId={sessionId}
        sessionInfo={{
          filename: sessionInfo.filename,
          shape: sessionInfo.shape as [number, number],
          columns: sessionInfo.columns,
          dtypes: sessionInfo.dtypes,
          missing_values: sessionInfo.missing_values,
        }}
      />

      {/* Floating button to trigger insights manually */}
      <button
        onClick={handleShowInsights}
        className="fixed bottom-6 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        aria-label="Show auto insights"
        title="Show insights"
      >
        <Sparkles className="h-4 w-4" aria-hidden="true" />
      </button>
    </>
  )
}
