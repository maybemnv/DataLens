"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/stores/auth"
import { authApi } from "@/lib/auth"
import { LogOut, Trash2, ExternalLink, Clock, FileText } from "lucide-react"

interface SessionItem {
  session_id: string
  filename: string
  shape: [number, number]
  created_at: string
  expires_at: string | null
}

export default function HistoryPage() {
  const router = useRouter()
  const { user, token, logout, checkAuth } = useAuthStore()
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    checkAuth().then(() => {
      const t = localStorage.getItem("datalens_token")
      if (!t) {
        router.push("/login?redirect=/history")
        return
      }
      loadSessions()
    })
  }, [checkAuth, router])

  const loadSessions = async () => {
    try {
      const data = await authApi.getSessions()
      setSessions(data)
    } catch {
      setError("Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (sessionId: string) => {
    if (!confirm("Delete this session? This cannot be undone.")) return
    try {
      await authApi.deleteSession(sessionId)
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId))
    } catch {
      alert("Failed to delete session")
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    } catch {
      return iso
    }
  }

  if (!token) return null

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-border px-6 py-4 sm:px-10">
        <Link href="/" className="text-sm font-semibold tracking-tight text-text-primary">
          DataLens<span className="text-primary"> AI</span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-xs text-text-muted">{user?.email}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-text-muted hover:text-text-primary"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
        </div>
      </nav>

      {/* Content */}
      <main className="flex-1 px-6 py-8 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-6 text-xl font-bold text-text-primary">Session History</h1>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-text-muted">
              <Clock className="h-4 w-4 animate-spin" />
              Loading sessions...
            </div>
          )}

          {error && (
            <div className="rounded border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {error}
            </div>
          )}

          {!loading && !error && sessions.length === 0 && (
            <div className="rounded-lg border border-border bg-surface p-8 text-center">
              <FileText className="mx-auto mb-3 h-8 w-8 text-text-muted" />
              <p className="text-sm text-text-muted">No sessions yet.</p>
              <Link
                href="/"
                className="mt-3 inline-block rounded bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                Upload a dataset
              </Link>
            </div>
          )}

          {!loading && sessions.length > 0 && (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-elevated text-xs text-text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">File</th>
                    <th className="px-4 py-3 font-medium">Rows</th>
                    <th className="px-4 py-3 font-medium">Columns</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.session_id} className="border-b border-border/50 last:border-0">
                      <td className="px-4 py-3 font-medium text-text-primary">{s.filename}</td>
                      <td className="px-4 py-3 text-text-muted">{s.shape[0]?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-text-muted">{s.shape[1]}</td>
                      <td className="px-4 py-3 text-text-muted">{formatDate(s.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={`/workspace/${s.session_id}`}
                            className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-primary"
                            title="Open workspace"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(s.session_id)}
                            className="rounded p-1.5 text-text-muted hover:bg-surface hover:text-error"
                            title="Delete session"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
