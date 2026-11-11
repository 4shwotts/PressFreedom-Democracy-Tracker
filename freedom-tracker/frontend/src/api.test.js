import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError } from './api'

// a fresh Response per call — a response body can only be read once
const respond = (status, body) => vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
  new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))

afterEach(() => vi.restoreAllMocks())

describe('api client', () => {
  it('returns the parsed JSON on success', async () => {
    respond(200, { status: 'ok' })
    await expect(api.health()).resolves.toEqual({ status: 'ok' })
  })

  it('builds encoded query strings and paths', async () => {
    const fetch = respond(200, {})
    await api.getMapData(2023, 'PressFreedomScore')
    await api.getCountryTrend("Cote d'Ivoire")
    await api.getCorrelation('all')
    expect(fetch.mock.calls.map(c => c[0])).toEqual([
      '/api/map?year=2023&metric=PressFreedomScore',
      "/api/country/Cote%20d'Ivoire",
      '/api/correlation?year=all'
    ])
  })

  it('throws an ApiError with the API’s own error message', async () => {
    respond(400, { error: 'year must be a whole number between 2013 and 2023' })
    const err = await api.getMapData('abc', 'DemocracyScore').catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(400)
    expect(err.message).toBe('year must be a whole number between 2013 and 2023')
  })

  it('falls back to a generic message when the error body is not JSON', async () => {
    respond(502, '<html>Bad gateway</html>')
    const err = await api.getMeta().catch(e => e)
    expect(err.message).toBe('The server returned an error (502)')
  })

  it('passes an abort signal through for the health check', async () => {
    const fetch = respond(200, { status: 'ok' })
    const controller = new AbortController()
    await api.health({ signal: controller.signal })
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal)
  })
})
