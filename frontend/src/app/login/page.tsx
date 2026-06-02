"use client"

import { Suspense, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { useAuthStore } from "@/lib/stores/auth"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get("redirect") || "/"

  const { login, isLoading, error, clearError } = useAuthStore()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [formError, setFormError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError("")
    clearError()

    if (!email || !password) {
      setFormError("Please fill in all fields")
      return
    }

    try {
      await login(email, password)
      router.push(redirectTo)
    } catch {
      // Error is set by the store
    }
  }

  const storeError = error || formError

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="text-lg font-semibold tracking-tight text-text-primary">
            DataLens<span className="text-primary"> AI</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-text-primary">Sign in</h1>
          <p className="mt-2 text-sm text-text-muted">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Create one
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-surface p-8">
          {storeError && (
            <div className="mb-4 rounded border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
              {storeError}
            </div>
          )}

          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-text-primary">
              Email
            </label>
            <input
              id="email"
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
              placeholder="you@example.com"
              autoComplete="username"
            />
          </div>

          <div className="mb-6">
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-text-primary">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-text-muted">Loading...</p>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
