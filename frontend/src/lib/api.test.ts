import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { api, createWebSocketClient, WS_BASE_URL, validateFile, MAX_UPLOAD_SIZE } from '@/lib/api'

// ─── Mock XMLHttpRequest ─────────────────────────────────────────────
function mockXHR() {
  const xhr = {
    open: vi.fn(),
    send: vi.fn(),
    abort: vi.fn(),
    upload: { addEventListener: vi.fn() },
    addEventListener: vi.fn((event: string, handler: () => void) => {
      if (event === 'load') xhr._loadHandler = handler
      if (event === 'error') xhr._errorHandler = handler
    }),
    // Internal handlers for test control
    _loadHandler: null as (() => void) | null,
    _errorHandler: null as (() => void) | null,
    status: 200,
    responseText: '{}',
  }

  vi.stubGlobal('XMLHttpRequest', vi.fn(() => xhr))
  return xhr
}

describe('validateFile', () => {
  it('accepts a valid CSV file under 100 MB', () => {
    const file = new File(['a,b,c\n1,2,3'], 'data.csv', { type: 'text/csv' })
    expect(() => validateFile(file)).not.toThrow()
  })

  it('accepts xlsx files', () => {
    const file = new File(['binary'], 'data.xlsx', { type: 'application/vnd.openxmlformats' })
    expect(() => validateFile(file)).not.toThrow()
  })

  it('rejects unsupported extensions', () => {
    const file = new File(['data'], 'data.json', { type: 'application/json' })
    expect(() => validateFile(file)).toThrow(/Unsupported format/)
  })

  it('rejects files larger than 100 MB', () => {
    // Create a fake file with size > 100 MB
    const file = new File([new ArrayBuffer(MAX_UPLOAD_SIZE + 1)], 'huge.csv', { type: 'text/csv' })
    expect(() => validateFile(file)).toThrow(/File too large/)
  })
})

describe('api.upload', () => {
  let xhr: ReturnType<typeof mockXHR>

  beforeEach(() => {
    xhr = mockXHR()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('uploads a file successfully', async () => {
    const mockResponse = {
      session_id: 'test-123',
      filename: 'test.csv',
      rows: 100,
      columns: 5,
      column_names: ['a', 'b', 'c', 'd', 'e'],
    }
    xhr.status = 200
    xhr.responseText = JSON.stringify(mockResponse)

    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    const promise = api.upload(file)

    // Simulate XHR load
    xhr._loadHandler?.()

    const result = await promise
    expect(result).toEqual(mockResponse)
  })

  it('throws error on failed upload', async () => {
    xhr.status = 400
    xhr.responseText = JSON.stringify({ detail: 'Invalid file' })

    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    const promise = api.upload(file)

    xhr._loadHandler?.()

    await expect(promise).rejects.toThrow('Invalid file')
  })

  it('calls onProgress callback during upload', async () => {
    const onProgress = vi.fn()
    xhr.status = 200
    xhr.responseText = JSON.stringify({ session_id: 'test' })

    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    const promise = api.upload(file, onProgress)

    // Get the progress listener
    const progressListener = xhr.upload.addEventListener.mock.calls[0]?.[1]
    expect(progressListener).toBeDefined()

    // Simulate progress event
    progressListener?.({ loaded: 50, total: 100, lengthComputable: true })
    expect(onProgress).toHaveBeenCalledWith(50)

    // Complete the upload
    xhr._loadHandler?.()
    await promise
  })

  it('rejects on network error', async () => {
    const file = new File(['test'], 'test.csv', { type: 'text/csv' })
    const promise = api.upload(file)

    // Simulate XHR error
    xhr._errorHandler?.()

    await expect(promise).rejects.toThrow('Network error during upload')
  })
})

describe('api.getSessionInfo', () => {
  it('fetches session info successfully', async () => {
    const mockResponse = {
      session_id: 'test-123',
      filename: 'test.csv',
      shape: [100, 5],
      columns: ['a', 'b', 'c'],
      dtypes: { a: 'float64', b: 'object', c: 'int64' },
    }

    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await api.getSessionInfo('test-123')
    expect(result).toEqual(mockResponse)

    vi.unstubAllGlobals()
  })

  it('throws error when session not found', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 404,
    })
    vi.stubGlobal('fetch', mockFetch)

    await expect(api.getSessionInfo('nonexistent')).rejects.toThrow('Session not found')

    vi.unstubAllGlobals()
  })
})

describe('api.deleteSession', () => {
  it('deletes session successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', mockFetch)

    await expect(api.deleteSession('test-123')).resolves.not.toThrow()

    vi.unstubAllGlobals()
  })

  it('handles 404 gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 })
    vi.stubGlobal('fetch', mockFetch)

    await expect(api.deleteSession('nonexistent')).resolves.not.toThrow()

    vi.unstubAllGlobals()
  })
})

describe('api.chat', () => {
  it('sends chat message successfully', async () => {
    const mockResponse = {
      answer: 'Test answer',
      has_error: false,
      chart_spec: null,
      steps: [],
    }
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await api.chat('test-123', 'Hello')
    expect(result).toEqual(mockResponse)

    vi.unstubAllGlobals()
  })

  it('throws error on chat failure', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, status: 404 })
    vi.stubGlobal('fetch', mockFetch)

    await expect(api.chat('nonexistent', 'Hello')).rejects.toThrow('Session not found')

    vi.unstubAllGlobals()
  })
})

describe('api.health', () => {
  it('returns health status', async () => {
    const mockResponse = { status: 'ok', version: '1.0.0' }
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    })
    vi.stubGlobal('fetch', mockFetch)

    const result = await api.health()
    expect(result).toEqual(mockResponse)

    vi.unstubAllGlobals()
  })

  it('throws error on health check failure', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false })
    vi.stubGlobal('fetch', mockFetch)

    await expect(api.health()).rejects.toThrow('Health check failed')

    vi.unstubAllGlobals()
  })
})

describe('WebSocket client', () => {
  let mockWsInstance: {
    send: ReturnType<typeof vi.fn>
    close: ReturnType<typeof vi.fn>
    onopen: (() => void) | null
    onclose: (() => void) | null
    onmessage: ((event: { data: string }) => void) | null
    onerror: ((error: Event) => void) | null
    readyState: number
  }

  beforeEach(() => {
    mockWsInstance = {
      send: vi.fn(),
      close: vi.fn(),
      onopen: null,
      onclose: null,
      onmessage: null,
      onerror: null,
      readyState: 1, // WebSocket.OPEN
    }

    const MockWs = vi.fn(() => mockWsInstance)
    MockWs.OPEN = 1
    MockWs.CONNECTING = 0
    MockWs.CLOSING = 2
    MockWs.CLOSED = 3
    vi.stubGlobal('WebSocket', MockWs)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates WebSocket connection with correct URL', () => {
    createWebSocketClient({
      sessionId: 'test-123',
      onConnect: vi.fn(),
    })

    expect(WebSocket).toHaveBeenCalledWith(`${WS_BASE_URL}/ws/test-123?token=`)
  })

  it('calls onConnect callback when connection opens', () => {
    const onConnect = vi.fn()
    createWebSocketClient({
      sessionId: 'test-123',
      onConnect,
    })

    mockWsInstance.onopen?.()

    expect(onConnect).toHaveBeenCalled()
  })

  it('sends message correctly when WebSocket is open', () => {
    const client = createWebSocketClient({
      sessionId: 'test-123',
    })

    expect(mockWsInstance.readyState).toBe(1)

    client.send('Hello world')

    expect(mockWsInstance.send).toHaveBeenCalledWith(
      JSON.stringify({ message: 'Hello world' })
    )
  })

  it('parses and dispatches message by type', () => {
    const onThought = vi.fn()
    const onChart = vi.fn()
    const onAnswer = vi.fn()

    createWebSocketClient({
      sessionId: 'test-123',
      onThought,
      onChart,
      onAnswer,
    })

    mockWsInstance.onmessage?.({
      data: JSON.stringify({ type: 'thought', content: 'Thinking...' }),
    })

    mockWsInstance.onmessage?.({
      data: JSON.stringify({ type: 'chart', spec: { mark: 'bar' } }),
    })

    mockWsInstance.onmessage?.({
      data: JSON.stringify({ type: 'answer', content: 'Final answer' }),
    })

    expect(onThought).toHaveBeenCalledWith('Thinking...')
    expect(onChart).toHaveBeenCalledWith({ mark: 'bar' })
    expect(onAnswer).toHaveBeenCalledWith('Final answer')
  })

  it('handles error messages', () => {
    const onError = vi.fn()

    createWebSocketClient({
      sessionId: 'test-123',
      onError,
    })

    mockWsInstance.onmessage?.({
      data: JSON.stringify({ type: 'error', message: 'Something went wrong' }),
    })

    expect(onError).toHaveBeenCalledWith('Something went wrong')
  })

  it('calls onDone when done message received', () => {
    const onDone = vi.fn()

    createWebSocketClient({
      sessionId: 'test-123',
      onDone,
    })

    mockWsInstance.onmessage?.({
      data: JSON.stringify({ type: 'done' }),
    })

    expect(onDone).toHaveBeenCalled()
  })

  it('closes connection on client.close()', () => {
    const client = createWebSocketClient({
      sessionId: 'test-123',
    })

    client.close()

    expect(mockWsInstance.close).toHaveBeenCalled()
  })

  it('handles pong messages silently', () => {
    const onMessage = vi.fn()

    createWebSocketClient({
      sessionId: 'test-123',
      onMessage,
    })

    mockWsInstance.onmessage?.({
      data: JSON.stringify({ type: 'pong' }),
    })

    // onMessage should NOT be called for pong (it's filtered out)
    expect(onMessage).not.toHaveBeenCalled()
  })
})
