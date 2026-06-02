// API status check hook for frontend
import { useEffect, useState } from 'react'

export interface BackendStatus {
  connected: boolean
  backendUrl: string
  wsUrl: string
  sessionCount?: number
  error?: string
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000'

export function useBackendStatus() {
  const [status, setStatus] = useState<BackendStatus>({
    connected: false,
    backendUrl: API_BASE_URL,
    wsUrl: WS_BASE_URL,
  })

  useEffect(() => {
    async function checkBackend() {
      try {
        // Check HTTP health
        const healthRes = await fetch(`${API_BASE_URL}/health`)
        if (!healthRes.ok) {
          throw new Error(`Health check failed: ${healthRes.status}`)
        }
        await healthRes.json()

        // Check sessions endpoint
        const sessionsRes = await fetch(`${API_BASE_URL}/sessions`)
        let sessionCount = 0
        if (sessionsRes.ok) {
          const sessions = await sessionsRes.json()
          sessionCount = sessions.count
        }

        setStatus({
          connected: true,
          backendUrl: API_BASE_URL,
          wsUrl: WS_BASE_URL,
          sessionCount,
          error: undefined,
        })
      } catch (error) {
        setStatus({
          connected: false,
          backendUrl: API_BASE_URL,
          wsUrl: WS_BASE_URL,
          sessionCount: 0,
          error: error instanceof Error ? error.message : 'Backend unreachable',
        })
      }
    }

    checkBackend()
    
    // Re-check every 30 seconds
    const interval = setInterval(checkBackend, 30000)
    return () => clearInterval(interval)
  }, [])

  return status
}
