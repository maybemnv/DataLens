"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Upload, FileText, CheckCircle2, AlertCircle, X, LogOut, Clock } from "lucide-react"
import { api, validateFile, MAX_UPLOAD_SIZE } from "@/lib/api"
import { useAuthStore } from "@/lib/stores/auth"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"

type UploadState = "idle" | "uploading" | "parsing" | "done" | "error"

const PREVIEW_COLUMNS = ["date", "agency", "category", "amount"] as const

export default function HomePage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<(() => void) | null>(null)

  const { user, token, logout, checkAuth, hasHydrated } = useAuthStore()

  const [state, setState] = useState<UploadState>("idle")
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState("")
  const [error, setError] = useState("")
  const [isDragging, setIsDragging] = useState(false)

  // Redirect to login if not authenticated
  useEffect(() => {
    checkAuth().then(() => {
      const t = localStorage.getItem("datalens_token")
      if (!t) {
        router.push("/login?redirect=/")
      }
    })
  }, [checkAuth, router])

  const handleLogout = () => {
    logout()
    router.push("/login")
  }

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name)
    setError("")

    // Validate immediately before any network activity
    try {
      validateFile(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid file")
      setState("error")
      return
    }

    setState("uploading")
    setProgress(0)

    try {
      const { session_id } = await api.upload(file, (pct) => {
        setProgress(pct)
      })

      setState("parsing")
      setProgress(100)

      // Brief pause to show parsing state (backend already has the data)
      await new Promise((r) => setTimeout(r, 600))

      setState("done")
      await new Promise((r) => setTimeout(r, 400))
      router.push(`/workspace/${session_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
      setState("error")
    }
  }, [router])

  const handleCancel = useCallback(() => {
    abortRef.current?.()
    setState("idle")
    setProgress(0)
    setFileName("")
    setError("")
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }, [handleFile])

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 sm:px-10 sm:py-5" role="navigation" aria-label="Main navigation">
        <Link href="/" className="text-sm font-semibold tracking-tight text-text-primary">
          DataLens<span className="text-primary"> AI</span>
        </Link>
        <div className="flex items-center gap-3">
          {hasHydrated && token && user && (
            <>
              <Link
                href="/history"
                className="flex items-center gap-1 rounded px-2 py-1.5 text-xs font-medium text-text-muted transition-colors hover:text-text-primary"
              >
                <Clock className="h-3.5 w-3.5" />
                History
              </Link>
              <span className="text-xs text-text-muted">{user.email}</span>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1 rounded px-2 py-1.5 text-xs text-text-muted transition-colors hover:text-text-primary"
              >
                <LogOut className="h-3.5 w-3.5" />
                Logout
              </button>
            </>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 pb-20 pt-12" role="main">
        {/* Orange radial — the ONE accent region */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-start justify-center"
          style={{
            background:
              "radial-gradient(ellipse 60% 40% at 50% 20%, rgba(228,77,10,0.09) 0%, transparent 70%)",
          }}
        />

        {/* Ghost code texture — upper right, decorative only */}
        <pre
          aria-hidden="true"
          className="pointer-events-none absolute right-10 top-24 hidden select-none font-mono text-[11px] leading-5 text-text-primary opacity-[0.04] lg:block"
        >
          {`const df = pd.read_csv(file)
schema = df.dtypes.to_dict()
agent.run(query, context=schema)
insights = llm.analyze(df.head(100))`}
        </pre>

        <div className="relative w-full max-w-xl">
          {/* Headline */}
          <div className="mb-10 text-center">
            <h1 className="mb-3 text-4xl font-bold tracking-tight text-text-primary sm:text-5xl">
              Ingest. Analyze. Act.
            </h1>
            <p className="text-base text-text-muted">
              Drop your dataset. The agent does the rest.
            </p>
          </div>

          {/* Upload card */}
          <div
            className="rounded-lg border border-border bg-surface"
            role="region"
            aria-label="File upload"
            aria-live="polite"
          >
            {state === "idle" && (
              <div
                onDrop={onDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click() }}
                role="button"
                tabIndex={0}
                aria-label="Click or drag files to upload"
                className={cn(
                  "flex cursor-pointer flex-col items-center px-10 py-14 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                  isDragging ? "bg-elevated" : "hover:bg-elevated/50"
                )}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <p className="mb-1 text-sm font-medium text-text-primary">
                  Drop your file here
                </p>
                <p className="text-xs text-text-muted">CSV · XLSX · Parquet · up to 100 MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls,.parquet"
                  className="hidden"
                  onChange={handleFileInput}
                  aria-label="Select file to upload"
                />
              </div>
            )}

            {(state === "uploading" || state === "parsing") && (
              <div className="px-10 py-10">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    {state === "parsing" ? (
                      <FileText className="h-4 w-4 animate-pulse text-primary" aria-hidden="true" />
                    ) : (
                      <FileText className="h-4 w-4 text-text-muted" aria-hidden="true" />
                    )}
                    <span className="text-sm font-medium text-text-primary truncate max-w-[200px]">{fileName}</span>
                  </div>
                  <button
                    onClick={handleCancel}
                    className="rounded p-1 text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Cancel upload"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                {/* Progress bar — real percentage from XHR upload */}
                <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-elevated" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Upload progress: ${progress}%`}>
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mb-6 text-right text-xs text-text-muted">{progress}%</p>

                {/* Skeleton table — parsing state */}
                {state === "parsing" && (
                  <div className="overflow-hidden rounded border border-border font-mono text-[11px]">
                    <div className="grid grid-cols-4 border-b border-border bg-elevated px-3 py-2 font-semibold text-text-muted">
                      {PREVIEW_COLUMNS.map((h) => (
                        <span key={h}>{h}</span>
                      ))}
                    </div>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="grid grid-cols-4 gap-2 border-b border-border/50 px-3 py-2 last:border-0"
                      >
                        {PREVIEW_COLUMNS.map((col) => (
                          <Skeleton key={col} variant="text" height="12px" className="w-full" />
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {state === "done" && (
              <div className="flex flex-col items-center px-10 py-14">
                <CheckCircle2 className="mb-3 h-10 w-10 text-success animate-scale-in" aria-hidden="true" />
                <p className="text-sm font-medium text-text-primary">Dataset ready — redirecting</p>
                <p className="mt-1 text-xs text-text-muted">Opening workspace…</p>
              </div>
            )}

            {state === "error" && (
              <div className="px-10 py-10 text-center">
                <AlertCircle className="mx-auto mb-3 h-8 w-8 text-error" aria-hidden="true" />
                <p className="mb-1 text-sm font-medium text-text-primary">{error}</p>
                {fileName && (
                  <p className="mb-4 text-xs text-text-muted">{fileName}</p>
                )}
                <button
                  onClick={() => { setState("idle"); setError(""); setFileName(""); setProgress(0) }}
                  className="rounded-full border border-border px-5 py-2 text-sm text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Try again
                </button>
              </div>
            )}
          </div>

          {/* Inline CTA row — gated on `hasHydrated` to avoid hydration mismatch
              (token lives in localStorage and is only available after the auth
              store has rehydrated from localStorage on the client) */}
          {hasHydrated && state === "idle" && token && (
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs text-text-muted" aria-label="Upload requirements">
              <span>CSV, XLSX, Parquet</span>
              <span className="h-3 w-px bg-border" aria-hidden="true" />
              <span>Up to {formatFileSize(MAX_UPLOAD_SIZE)}</span>
            </div>
          )}
        </div>

        {/* Typographic counterweight */}
        <p
          aria-hidden="true"
          className="pointer-events-none absolute bottom-8 right-10 hidden select-none font-mono text-[80px] font-bold leading-none tracking-tighter text-text-primary opacity-[0.03] lg:block"
        >
          DL.AI
        </p>
      </main>
    </div>
  )
}
