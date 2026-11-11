import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { useApi } from './useApi'
import { deferred } from '../test/mocks'

describe('useApi', () => {
  it('loads data and clears the loading flag', async () => {
    const { result } = renderHook(() => useApi(() => Promise.resolve([1, 2]), []))
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toEqual([1, 2]))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('reports an error, and retry() loads again', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce('ok')
    const { result } = renderHook(() => useApi(load, []))
    await waitFor(() => expect(result.current.error?.message).toBe('offline'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.data).toBe('ok'))
    expect(result.current.error).toBeNull()
    expect(load).toHaveBeenCalledTimes(2)
  })

  it('ignores a response for deps that have since changed', async () => {
    const slow = deferred()
    const fast = deferred()
    const load = vi.fn(key => (key === 'a' ? slow.promise : fast.promise))
    const { result, rerender } = renderHook(({ key }) => useApi(() => load(key), [key]), { initialProps: { key: 'a' } })
    rerender({ key: 'b' })
    await act(async () => fast.resolve('B'))
    await act(async () => slow.resolve('A'))
    expect(result.current.data).toBe('B')
  })

  it('ignores an error for deps that have since changed', async () => {
    const slow = deferred()
    const { result, rerender } = renderHook(({ key }) => useApi(() => (key === 'a' ? slow.promise : Promise.resolve('B')), [key]),
      { initialProps: { key: 'a' } })
    rerender({ key: 'b' })
    await waitFor(() => expect(result.current.data).toBe('B'))
    await act(async () => slow.reject(new Error('late failure')))
    expect(result.current.error).toBeNull()
  })

  it('keeps the previous data while new data loads', async () => {
    const next = deferred()
    const { result, rerender } = renderHook(({ key }) => useApi(() => (key === 1 ? Promise.resolve('first') : next.promise), [key]),
      { initialProps: { key: 1 } })
    await waitFor(() => expect(result.current.data).toBe('first'))
    rerender({ key: 2 })
    expect(result.current.loading).toBe(true)
    expect(result.current.data).toBe('first')
  })

  it('does nothing while disabled', () => {
    const load = vi.fn(() => Promise.resolve('x'))
    const { result } = renderHook(() => useApi(load, [], { enabled: false }))
    expect(load).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
  })
})
