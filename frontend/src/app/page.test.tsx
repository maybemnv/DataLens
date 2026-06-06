import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useParams: () => ({}),
}))

const mockAuthState: {
  user: { email: string } | null
  token: string | null
  hasHydrated: boolean
  checkAuth: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
} = {
  user: null,
  token: null,
  hasHydrated: false,
  checkAuth: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn(),
}
vi.mock('@/lib/stores/auth', () => ({
  useAuthStore: () => mockAuthState,
}))

vi.mock('@/lib/api', () => ({
  api: { upload: vi.fn() },
  validateFile: vi.fn(),
  MAX_UPLOAD_SIZE: 100 * 1024 * 1024,
}))

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}))

import HomePage from '@/app/page'

describe('HomePage hydration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuthState.user = null
    mockAuthState.token = null
    mockAuthState.hasHydrated = false
  })

  it('does not render the CTA row before hasHydrated (matches server HTML)', () => {
    mockAuthState.token = 'fake-token'
    mockAuthState.user = { email: 'test@example.com' }
    mockAuthState.hasHydrated = false

    const { container } = render(<HomePage />)

    // Server-side and pre-hydration: token should NOT drive rendering.
    // This is what prevents the server/client HTML mismatch.
    expect(container.querySelector('[aria-label="Upload requirements"]')).toBeNull()
  })

  it('renders the CTA row after hasHydrated when token is present', async () => {
    mockAuthState.token = 'fake-token'
    mockAuthState.user = { email: 'test@example.com' }
    mockAuthState.hasHydrated = true

    const { container } = render(<HomePage />)

    await waitFor(() => {
      expect(
        container.querySelector('[aria-label="Upload requirements"]')
      ).not.toBeNull()
    })
  })

  it('does not render the CTA row when no token even after hydration', () => {
    mockAuthState.token = null
    mockAuthState.user = null
    mockAuthState.hasHydrated = true

    const { container } = render(<HomePage />)

    expect(container.querySelector('[aria-label="Upload requirements"]')).toBeNull()
  })

  it('does not render the nav user menu before hasHydrated', () => {
    mockAuthState.token = 'fake-token'
    mockAuthState.user = { email: 'test@example.com' }
    mockAuthState.hasHydrated = false

    const { container } = render(<HomePage />)

    // No History link, no email span, no Logout button
    expect(container.querySelector('a[href="/history"]')).toBeNull()
  })
})
