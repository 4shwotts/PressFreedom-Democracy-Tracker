import { describe, expect, it } from 'vitest'
import {
  byIso, filterCountries, fmtChange, fmtTick, histogramData, jitteredPoints, mapColourScale,
  mapLegend, metricInfo, niceTicks, pressPeriodsText, rankText, trendChartData
} from './chartData'
import { trend } from '../test/fixtures'

describe('formatting', () => {
  it.each([[1.2, '+1.2'], [-0.4, '-0.4'], [0, '0'], [null, '—'], [undefined, '—']])(
    'fmtChange(%s) is %s', (value, expected) => expect(fmtChange(value)).toBe(expected))

  it('rankText', () => expect(rankText(29, 148)).toBe('29 of 148'))

  it('fmtTick drops trailing zeros and rounds', () => {
    expect(fmtTick(4)).toBe('4')
    expect(fmtTick(4.5)).toBe('4.5')
    expect(fmtTick(0.1 + 0.2)).toBe('0.3')
  })

  it('metricInfo falls back to democracy for an unknown metric', () => {
    expect(metricInfo('PressFreedomScore').max).toBe(100)
    expect(metricInfo('nope').value).toBe('DemocracyScore')
  })
})

describe('map colours', () => {
  it('runs dark red at the bottom of the range to dark navy at the top', () => {
    const scale = mapColourScale('DemocracyScore')
    expect(scale(0)).toBe('rgb(225, 29, 72)')
    expect(scale(10)).toBe('rgb(30, 58, 95)')
  })

  it('uses the same colour at the same share of the range for both metrics', () => {
    expect(mapColourScale('DemocracyScore')(4)).toBe(mapColourScale('PressFreedomScore')(40))
  })

  it('legend labels the value at each colour stop', () => {
    expect(mapLegend('DemocracyScore').map(s => s.value)).toEqual([0, 4, 7, 10])
    expect(mapLegend('PressFreedomScore').map(s => s.value)).toEqual([0, 40, 70, 100])
    // each label is positioned at its share of the bar
    expect(mapLegend('PressFreedomScore').map(s => s.fraction)).toEqual([0, 0.4, 0.7, 1])
  })

  it('byIso keys rows by ISO code', () => {
    expect(byIso([{ iso: 'NOR', v: 1 }, { iso: 'TCD', v: 2 }])).toEqual({ NOR: { iso: 'NOR', v: 1 }, TCD: { iso: 'TCD', v: 2 } })
    expect(byIso(undefined)).toEqual({})
  })
})

describe('trend chart data', () => {
  it('uses the primary country alone when there is no comparison', () => {
    expect(trendChartData(trend('Norway'), null)).toEqual([
      { year: 2021, democracyScore: 9.75, pressFreedomScore: 93.28 },
      { year: 2022, democracyScore: 9.81, pressFreedomScore: 92.65 },
      { year: 2023, democracyScore: 9.81, pressFreedomScore: 95.18 }
    ])
  })

  it('merges a comparison country by year, keeping years only one country has', () => {
    const other = trend('Chad', { series: [
      { year: 2020, democracyScore: 1.5, pressFreedomScore: 40 },
      { year: 2023, democracyScore: 1.67, pressFreedomScore: 49.3 }
    ] })
    const rows = trendChartData(trend('Norway'), other)
    expect(rows.map(r => r.year)).toEqual([2020, 2021, 2022, 2023])
    expect(rows[0]).toEqual({ year: 2020, compareDemocracy: 1.5, comparePress: 40 })
    expect(rows[3]).toMatchObject({ democracyScore: 9.81, compareDemocracy: 1.67, comparePress: 49.3 })
  })

  it('is empty with no data', () => expect(trendChartData(null, null)).toEqual([]))

  it('describes press freedom changes either side of 2022', () => {
    expect(pressPeriodsText([
      { fromYear: 2013, toYear: 2021, change: -9 },
      { fromYear: 2022, toYear: 2023, change: 1.2 }
    ])).toBe('2013–2021: -9 · 2022–2023: +1.2')
    expect(pressPeriodsText([])).toBe('—')
  })
})

describe('country search filter', () => {
  const countries = ['Côte d’Ivoire', "Cote d'Ivoire", 'Norway', 'North Korea', 'Turkey']

  it('matches part of a name, ignoring case', () => {
    expect(filterCountries(countries, 'NOR')).toEqual(['Norway', 'North Korea'])
  })

  it('ignores accents', () => {
    expect(filterCountries(countries, 'cote')).toEqual(['Côte d’Ivoire', "Cote d'Ivoire"])
  })

  it('returns every country for an empty or blank query', () => {
    expect(filterCountries(countries, '')).toEqual(countries)
    expect(filterCountries(countries, '   ')).toEqual(countries)
  })

  it('returns nothing when no country matches', () => {
    expect(filterCountries(countries, 'Atlantis')).toEqual([])
  })
})

describe('correlation helpers', () => {
  const points = [
    { country: 'Norway', year: 2023, democracyScore: 9.98, pressFreedomScore: 99.9 },
    { country: 'Chad', year: 2023, democracyScore: 0.01, pressFreedomScore: 0.1 }
  ]

  it('jitter is small, stable between calls and keeps the true scores', () => {
    const a = jitteredPoints(points)
    expect(jitteredPoints(points)).toEqual(a)
    for (const [i, p] of a.entries()) {
      expect(Math.abs(p.x - points[i].democracyScore)).toBeLessThanOrEqual(0.04)
      expect(Math.abs(p.y - points[i].pressFreedomScore)).toBeLessThanOrEqual(0.4)
      expect(p.democracyScore).toBe(points[i].democracyScore)
    }
  })

  it('jitter never pushes a point outside the axes', () => {
    for (const p of jitteredPoints(points)) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(10)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(100)
    }
  })

  it.each([
    [0, 10, 5, [0, 2, 4, 6, 8, 10]],
    [0, 100, 5, [0, 20, 40, 60, 80, 100]],
    [2.78, 7.22, 5, [3, 4, 5, 6, 7]],
    [4, 6, 5, [4, 4.5, 5, 5.5, 6]]
  ])('niceTicks(%s, %s) gives round values', (lo, hi, target, expected) => {
    expect(niceTicks(lo, hi, target)).toEqual(expected)
  })
})

describe('histogram data', () => {
  it('labels each bin with its range', () => {
    expect(histogramData([{ binStart: 2.1, binEnd: 2.9, count: 21 }])).toEqual([{ label: '2.1–2.9', count: 21 }])
    expect(histogramData(undefined)).toEqual([])
  })
})
