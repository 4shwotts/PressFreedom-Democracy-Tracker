// Pure data-preparation helpers for the charts, kept out of the components so
// they can be unit tested directly.
import { scaleLinear } from 'd3-scale'

export const METRICS = [
  { value: 'DemocracyScore', label: 'Democracy score', short: 'democracy', max: 10 },
  { value: 'PressFreedomScore', label: 'Press freedom score', short: 'press freedom', max: 100 }
]

export const metricInfo = value => METRICS.find(m => m.value === value) ?? METRICS[0]

// ---------------------------------------------------------------- formatting

/** "+1.2", "-0.4", "0" — or an em dash when there's no value. */
export function fmtChange(value) {
  if (value === null || value === undefined) return '—'
  return `${value > 0 ? '+' : ''}${value}`
}

/** "29 of 148" */
export const rankText = (rank, total) => `${rank} of ${total}`

// ---------------------------------------------------------------- map

// colour stops run dark red (low) → orange → light blue → dark navy (high),
// at 0%, 40%, 70% and 100% of the metric's range
const MAP_STOPS = [0, 0.4, 0.7, 1]
const MAP_COLOURS = ['#E11D48', '#D97706', '#5B9FE8', '#1E3A5F']

export function mapColourScale(metric) {
  const { max } = metricInfo(metric)
  return scaleLinear().domain(MAP_STOPS.map(s => s * max)).range(MAP_COLOURS)
}

/** Labelled legend entries for the map colour scale, so colour is never the only key. */
export function mapLegend(metric) {
  const { max } = metricInfo(metric)
  const scale = mapColourScale(metric)
  return MAP_STOPS.map(s => ({ value: s * max, fraction: s, colour: scale(s * max) }))
}

/** Rows keyed by ISO alpha-3 code — the map joins on ISO codes, never names. */
export function byIso(rows = []) {
  return Object.fromEntries(rows.map(r => [r.iso, r]))
}

// ---------------------------------------------------------------- country trends

/**
 * Merges one country's series with an optional comparison country's, by year,
 * for the line chart. Years only one country has are kept, with gaps for the other.
 */
export function trendChartData(primary, compare) {
  const years = new Map()
  for (const p of primary?.series ?? []) {
    years.set(p.year, { year: p.year, democracyScore: p.democracyScore, pressFreedomScore: p.pressFreedomScore })
  }
  for (const p of compare?.series ?? []) {
    const row = years.get(p.year) ?? { year: p.year }
    row.compareDemocracy = p.democracyScore
    row.comparePress = p.pressFreedomScore
    years.set(p.year, row)
  }
  return [...years.values()].sort((a, b) => a.year - b.year)
}

/** "2013–2021: -9.0 · 2022–2023: +1.2" — press freedom changes either side of 2022. */
export function pressPeriodsText(periods = []) {
  if (!periods.length) return '—'
  return periods.map(p => `${p.fromYear}–${p.toYear}: ${fmtChange(p.change)}`).join(' · ')
}

// ---------------------------------------------------------------- country search

// lower-case with accents removed, so "cote" finds "Côte d'Ivoire"
const fold = text => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Countries whose name contains the query (case- and accent-insensitive). */
export function filterCountries(countries, query) {
  const q = fold(query.trim())
  return q ? countries.filter(c => fold(c).includes(q)) : countries
}

// ---------------------------------------------------------------- correlation

// deterministic pseudo-random number in [0, 1) from a seed, so the same
// country always gets the same offset and dots don't jump between renders
function seededRand(n) {
  const x = Math.sin(n * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

function jitter(name, axis) {
  const seed = name.split('').reduce((a, c) => a + c.charCodeAt(0), axis === 'x' ? 7 : 99)
  return seededRand(seed) - 0.5
}

// small enough that dots stay near their true position, large enough to
// separate countries with identical scores
const JITTER_X = 0.08
const JITTER_Y = 0.8

/**
 * Scatter points with a small, stable offset so identical scores don't hide each
 * other. The true scores stay on each point for the tooltip and the data table.
 */
export function jitteredPoints(points = []) {
  const clamp = (v, max) => +Math.max(0, Math.min(max, v)).toFixed(3)
  return points.map(p => ({
    ...p,
    x: clamp(p.democracyScore + jitter(p.country, 'x') * JITTER_X, 10),
    y: clamp(p.pressFreedomScore + jitter(p.country, 'y') * JITTER_Y, 100)
  }))
}

/** Round tick values inside [lo, hi], about `target` of them (e.g. 4, 4.5, 5 …). */
export function niceTicks(lo, hi, target) {
  const raw = (hi - lo) / target
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw)
  const ticks = []
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + 1e-9; v += step) ticks.push(+v.toFixed(6))
  return ticks
}

/** Tick label: rounded, with trailing zeros dropped. */
export const fmtTick = v => String(+v.toFixed(2))

// ---------------------------------------------------------------- summary

/** Histogram bins as labelled bars: "2.1–2.9". */
export function histogramData(bins = []) {
  return bins.map(b => ({ label: `${b.binStart}–${b.binEnd}`, count: b.count }))
}
