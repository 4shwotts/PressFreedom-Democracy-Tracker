// The sleeping-server experience, tested with a fake clock: no real waiting.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import WakeGate from './WakeGate'
import { api } from '../api'
import { WAKE_DEFAULTS } from '../lib/useServerWake'

const WAKING = /Waking the server — this can take up to a minute/

// a health check that never answers until aborted, like a sleeping server
const hang = ({ signal } = {}) => new Promise((_, reject) => {
  signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
})

const advance = ms => act(() => vi.advanceTimersByTimeAsync(ms))

function renderGate() {
  return render(<WakeGate><p>Dashboard content</p></WakeGate>)
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('WakeGate', () => {
  it('shows the dashboard straight away when the server is awake', async () => {
    vi.spyOn(api, 'health').mockResolvedValue({ status: 'ok' })
    renderGate()
    await advance(0)
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
    expect(screen.queryByText(WAKING)).not.toBeInTheDocument()
  })

  it('does not show the waking message in the first 2 seconds', async () => {
    vi.spyOn(api, 'health').mockImplementation(hang)
    renderGate()
    await advance(1999)
    expect(screen.queryByText(WAKING)).not.toBeInTheDocument()
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows "Waking the server" after 2 seconds without an answer', async () => {
    vi.spyOn(api, 'health').mockImplementation(hang)
    renderGate()
    await advance(2000)
    expect(screen.getByText(WAKING)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite')
  })

  it('shows the dashboard once a slow server finally answers', async () => {
    let answer
    vi.spyOn(api, 'health').mockImplementation(() => new Promise(resolve => { answer = resolve }))
    renderGate()
    await advance(30000)
    expect(screen.getByText(WAKING)).toBeInTheDocument()
    await act(async () => answer({ status: 'ok' }))
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })

  it('keeps retrying after failed health checks until one succeeds', async () => {
    const health = vi.spyOn(api, 'health')
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValue({ status: 'ok' })
    renderGate()
    await advance(WAKE_DEFAULTS.retryEvery * 2 + 10)
    expect(health).toHaveBeenCalledTimes(3)
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })

  it('offers Retry after the time limit instead of a blank page', async () => {
    vi.spyOn(api, 'health').mockImplementation(hang)
    renderGate()
    await advance(WAKE_DEFAULTS.timeout)
    expect(screen.getByText('The server didn’t respond')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
    expect(screen.queryByText('Dashboard content')).not.toBeInTheDocument()
  })

  it('Retry starts again and can succeed', async () => {
    const health = vi.spyOn(api, 'health').mockImplementation(hang)
    renderGate()
    await advance(WAKE_DEFAULTS.timeout)
    health.mockResolvedValue({ status: 'ok' })
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await advance(0)
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })

  it('abandons a single health check that hangs and tries again', async () => {
    const health = vi.spyOn(api, 'health').mockImplementationOnce(hang).mockResolvedValue({ status: 'ok' })
    renderGate()
    await advance(WAKE_DEFAULTS.requestTimeout + WAKE_DEFAULTS.retryEvery + 10)
    expect(health).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Dashboard content')).toBeInTheDocument()
  })
})
