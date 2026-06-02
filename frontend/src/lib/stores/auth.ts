import { create } from "zustand"
import { authApi, setToken, clearToken, getToken, type User } from "@/lib/auth"

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null

  register: (email: string, password: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  checkAuth: () => Promise<void>
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: getToken(),
  isLoading: false,
  error: null,

  register: async (email: string, password: string) => {
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

  login: async (email: string, password: string) => {
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
      set({ user: null, token: null })
      return
    }
    try {
      const user = await authApi.me()
      set({ user, token })
    } catch {
      clearToken()
      set({ user: null, token: null })
    }
  },

  clearError: () => set({ error: null }),
}))
