// In production VITE_API_URL points at the hosted Flask API (set in the
// frontend host's environment settings); locally Vite proxies /api to Flask.
const BASE = import.meta.env.VITE_API_URL || '/api'

/** An API error with the HTTP status and the API's own error message. */
export class ApiError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function get(path, { signal } = {}) {
  const res = await fetch(`${BASE}${path}`, { signal })
  if (!res.ok) {
    let message = `The server returned an error (${res.status})`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch { /* not JSON — keep the generic message */ }
    throw new ApiError(res.status, message)
  }
  return res.json()
}

export const api = {
  health: options => get('/health', options),
  getMeta: () => get('/meta'),
  getMapData: (year, metric) => get(`/map?year=${encodeURIComponent(year)}&metric=${encodeURIComponent(metric)}`),
  getCountryList: () => get('/countries'),
  getCountryTrend: country => get(`/country/${encodeURIComponent(country)}`),
  getCorrelation: year => get(`/correlation?year=${encodeURIComponent(year)}`),
  getSummary: () => get('/summary')
}
