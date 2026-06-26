const BASE = import.meta.env.VITE_API_URL || '/api'

async function get(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}

export const api = {
  getMeta: () => get('/meta'),
  getMapData: (year, metric) => get(`/map?year=${year}&metric=${metric}`),
  getCountryList: () => get('/countries'),
  getCountryTrend: (country) => get(`/country/${encodeURIComponent(country)}`),
  getCorrelation: (year) => get(`/correlation?year=${year}`),
  getSummary: () => get('/summary')
}
