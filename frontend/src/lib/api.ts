// API client for DataLens backend
// Base URLs - configure via environment variables or detect from window.location
const getOrigin = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000'
  return `${window.location.protocol}//${window.location.hostname}:8000`
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || getOrigin()
const WS_BASE_URL = process.env.NEXT_PUBLIC_WS_URL || getOrigin().replace('http', 'ws')

// Auth token helper
function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  const token = localStorage.getItem('datalens_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// Maximum upload file size: 100 MB
export const MAX_UPLOAD_SIZE = 100 * 1024 * 1024

// Supported file extensions
export const SUPPORTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.parquet']

/**
 * Validate a file before upload — checks extension and size.
 * Throws a descriptive Error if validation fails.
 */
export function validateFile(file: File): void {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()

  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new Error(
      `Unsupported format "${ext}". Supported: ${SUPPORTED_EXTENSIONS.join(', ')}`
    )
  }

  if (file.size > MAX_UPLOAD_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    throw new Error(
      `File too large (${sizeMB} MB). Maximum size is 100 MB.`
    )
  }
}

// Types
export interface UploadResponse {
  session_id: string
  filename: string
  rows: number
  columns: number
  column_names: string[]
}

export interface SessionInfo {
  session_id: string
  filename: string
  shape: [number, number]
  columns: string[]
  dtypes: Record<string, string>
  numeric_columns?: string[]
  categorical_columns?: string[]
  missing_values?: number
}

export interface ChatResponse {
  answer: string
  chart_spec?: Record<string, unknown>
  has_error: boolean
  steps: Array<{
    tool: string
    args: Record<string, unknown>
    result: unknown
  }>
}

// API Client
export const api = {
  /**
   * Upload a dataset file with real progress tracking via XMLHttpRequest.
   * @param file - The file to upload
   * @param onProgress - Callback with progress percentage (0-100)
   */
  upload(
    file: File,
    onProgress?: (percentage: number) => void
  ): Promise<UploadResponse> {
    // Validate before starting
    validateFile(file)

    return new Promise((resolve, reject) => {
      const formData = new FormData()
      formData.append('file', file)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable && onProgress) {
          const percentage = Math.round((event.loaded / event.total) * 100)
          onProgress(percentage)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText))
          } catch {
            reject(new Error('Invalid response from server'))
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.detail || `Upload failed (${xhr.status})`))
          } catch {
            reject(new Error(`Upload failed (${xhr.status})`))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload was cancelled'))
      })

      xhr.open('POST', `${API_BASE_URL}/upload`)
      // Add auth header
      const token = typeof window !== 'undefined' ? localStorage.getItem('datalens_token') : null
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
      xhr.send(formData)
    })
  },

  /**
   * Get session information
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo> {
    const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
      headers: getAuthHeaders(),
    })

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Session not found')
      }
      throw new Error('Failed to fetch session info')
    }

    return res.json()
  },

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    })

    if (!res.ok && res.status !== 404) {
      throw new Error('Failed to delete session')
    }
  },

  /**
   * Chat via HTTP (non-streaming)
   */
  async chat(sessionId: string, message: string): Promise<ChatResponse> {
    const res = await fetch(`${API_BASE_URL}/chat/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify({ message }),
    })

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Session not found')
      }
      throw new Error('Chat request failed')
    }

    return res.json()
  },

  /**
   * Health check
   */
  async health(): Promise<{ status: string; version: string }> {
    const res = await fetch(`${API_BASE_URL}/health`)
    if (!res.ok) throw new Error('Health check failed')
    return res.json()
  },
}

// ─── WebSocket client with reconnection & heartbeat ──────────────────

export interface WSMessage {
  type: 'thought' | 'tool_call' | 'tool_result' | 'chart' | 'answer' | 'error' | 'done' | 'ping' | 'pong'
  content?: string
  tool?: string
  args?: Record<string, unknown>
  result?: unknown
  spec?: Record<string, unknown>
  message?: string
}

export interface CreateWebSocketClientOptions {
  sessionId: string
  onMessage?: (message: WSMessage) => void
  onThought?: (content: string) => void
  onToolCall?: (tool: string, args: Record<string, unknown>) => void
  onToolResult?: (tool: string, result: unknown) => void
  onChart?: (spec: Record<string, unknown>) => void
  onAnswer?: (content: string) => void
  onError?: (message: string) => void
  onDone?: () => void
  onConnect?: () => void
  onDisconnect?: () => void
  /** Maximum reconnection attempts (0 = no reconnection). Default: 10 */
  maxReconnectAttempts?: number
  /** Base reconnect delay in ms. Default: 1000 */
  reconnectBaseDelay?: number
}

export interface WebSocketClient {
  ws: WebSocket | null
  send: (message: string | Record<string, unknown>) => void
  close: () => void
}

/**
 * createWebSocketClient — WebSocket client with:
 * - Exponential backoff reconnection
 * - Heartbeat/ping-pong for dead connection detection
 * - Proper error propagation
 */
export function createWebSocketClient({
  sessionId,
  onMessage,
  onThought,
  onToolCall,
  onToolResult,
  onChart,
  onAnswer,
  onError,
  onDone,
  onConnect,
  onDisconnect,
  maxReconnectAttempts = 10,
  reconnectBaseDelay = 1000,
}: CreateWebSocketClientOptions): WebSocketClient {
  const token = typeof window !== 'undefined' ? localStorage.getItem('datalens_token') : ''
  const wsUrl = `${WS_BASE_URL}/ws/${sessionId}?token=${encodeURIComponent(token ?? '')}`
  console.log('[WS] Connecting:', wsUrl)

  let ws: WebSocket | null = null
  let reconnectAttempts = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let closed = false // user-initiated close, don't reconnect

  /** Start heartbeat: send ping every 30s, detect dead connections */
  const startHeartbeat = (socket: WebSocket) => {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'ping' }))
        // If no pong within 10s, consider dead
        setTimeout(() => {
          if (socket.readyState === WebSocket.OPEN) {
            console.warn('[WS] Heartbeat timeout — closing connection')
            socket.close(4000, 'Heartbeat timeout')
          }
        }, 10_000)
      }
    }, 30_000)
  }

  const stopHeartbeat = () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
  }

  /** Calculate reconnect delay with exponential backoff + jitter */
  const getReconnectDelay = () => {
    const exp = Math.min(reconnectAttempts, 6) // cap at 2^6 = 64s
    const base = reconnectBaseDelay * Math.pow(2, exp)
    const jitter = Math.random() * 1000 // add 0-1s jitter to avoid thundering herd
    return Math.min(base + jitter, 60_000) // max 60s
  }

  /** Attempt to reconnect with backoff */
  const scheduleReconnect = () => {
    if (closed) return
    if (reconnectAttempts >= maxReconnectAttempts) {
      console.error(`[WS] Max reconnection attempts (${maxReconnectAttempts}) reached`)
      onError?.('Connection lost. Please refresh the page.')
      onDisconnect?.()
      return
    }

    reconnectAttempts++
    const delay = getReconnectDelay()
    console.log(`[WS] Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`)

    reconnectTimer = setTimeout(() => {
      console.log(`[WS] Reconnection attempt ${reconnectAttempts}`)
      ws = createSocket()
    }, delay)
  }

  /** Create the actual WebSocket and wire up handlers */
  const createSocket = (): WebSocket => {
    const socket = new WebSocket(wsUrl)

    socket.onopen = () => {
      console.log('[WS] Connected')
      reconnectAttempts = 0 // reset on successful connection
      startHeartbeat(socket)
      onConnect?.()
    }

    socket.onclose = (event) => {
      console.log('[WS] Closed:', event.code, event.reason)
      stopHeartbeat()

      if (event.code === 4004) {
        console.error('[WS] Session not found on backend')
        onError?.('Session not found. It may have expired or been deleted.')
      } else if (event.code === 1006) {
        console.warn('[WS] Connection lost - will reconnect')
      } else if (event.code === 4000) {
        console.warn('[WS] Heartbeat timeout detected')
      } else if (event.code === 1000 || event.code === 1001) {
        console.log('[WS] Connection closed normally')
      }

      if (!closed) {
        onDisconnect?.()
        scheduleReconnect()
      }
    }

    socket.onerror = (error) => {
      console.error('[WS] Error:', {
        readyState: socket.readyState,
        url: socket.url,
        error,
      })
    }

    socket.onmessage = (event) => {
      try {
        const message: WSMessage = JSON.parse(event.data)

        // Handle pong response (heartbeat)
        if (message.type === 'pong') {
          return // heartbeat confirmed, no action needed
        }

        console.log('[WS] Message:', message.type)
        onMessage?.(message)

        switch (message.type) {
          case 'thought':
            onThought?.(message.content || '')
            break
          case 'tool_call':
            onToolCall?.(message.tool || '', message.args || {})
            break
          case 'tool_result':
            onToolResult?.(message.tool || '', message.result)
            break
          case 'chart':
            onChart?.(message.spec || {})
            break
          case 'answer':
            onAnswer?.(message.content || '')
            break
          case 'error':
            onError?.(message.message || 'Unknown error')
            break
          case 'done':
            onDone?.()
            break
          case 'ping':
            // Backend pinging us — respond with pong
            socket.send(JSON.stringify({ type: 'pong' }))
            break
        }
      } catch (e) {
        console.error('[WS] Failed to parse message:', e)
      }
    }

    return socket
  }

  // Initial connection
  ws = createSocket()

  return {
    get ws() {
      return ws
    },
    send: (message: string | Record<string, unknown>) => {
      const payload = typeof message === 'string'
        ? JSON.stringify({ message })
        : JSON.stringify(message)

      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(payload)
      } else if (ws?.readyState === WebSocket.CONNECTING) {
        console.warn('[WS] Connection still connecting, will send when ready')
      } else {
        console.error('[WS] Cannot send message - connection not open (readyState:', ws?.readyState, ')')
      }
    },
    close: () => {
      closed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      stopHeartbeat()
      ws?.close()
      ws = null
    },
  }
}

// Export constants
export { API_BASE_URL, WS_BASE_URL }
