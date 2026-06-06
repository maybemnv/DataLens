import { create } from "zustand"
import { authApi, setToken, clearToken, getToken, type User } from "@/lib/auth"

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  hasHydrated: boolean

  register: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  clearError: () => void
  setHasHydrated: (v: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  // token starts as null on both server and client first render to avoid
  // hydration mismatch. Real token is loaded in the browser by checkAuth()
  // and by reading localStorage on the client.
  user: null,
  token: null,
  isLoading: false,
  error: null,
  hasHydrated: false,

  register: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const res = await authApi.register(email, password)
      setToken(res.access_token)
      set({ user: res.user, token: res.access_token, isLoading: false })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Registration failed", isLoading: false })
      throw e
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const res = await authApi.login(email, password)
      setToken(res.access_token)
      set({ user: res.user, token: res.access_token, isLoading: false })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : "Login failed", isLoading: false })
      throw e
    }
  },

  logout: () => {
    clearToken()
    set({ user: null, token: null, error: null })
  },

  checkAuth: async () => {
    const token = getToken()
    if (!token) {
      set({ user: null, token: null, hasHydrated: true })
      return
    }
    try {
      const user = await authApi.me()
      set({ user, token, hasHydrated: true })
    } catch {
      clearToken()
      set({ user: null, token: null, hasHydrated: true })
    }
  },

  clearError: () => set({ error: null }),

  setHasHydrated: (v) => set({ hasHydrated: v }),
}))
