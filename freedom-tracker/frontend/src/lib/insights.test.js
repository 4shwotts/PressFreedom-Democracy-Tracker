import { describe, expect, it } from 'vitest'
import { correlationInsights, mapInsights, summaryInsights, trendInsights } from './insights'
import * as fx from '../test/fixtures'

const titles = insights => insights.map(i => i.title)
const text = insights => insights.map(i => i.body).join(' ')

// words that judge countries rather than describe the data
const LOADED = /\b(stark|enjoy|stronger democrac|worth investigating|unexpected|a sign of)\b/i

describe('map insights', () => {
  it('shows the average and the largest increase and decrease', () => {
    const ins = mapInsights(fx.mapData(2023), 2013, 2023)
    expect(titles(ins)).toEqual(['Global average', 'Largest increase', 'Largest decrease', 'Other years', 'Reading the map'])
    expect(ins[1].body).toContain('Norway')
    expect(ins[1].body).toContain('+0.06')
  })

  it('explains why there is no year-on-year change for press freedom in 2022', () => {
    const ins = mapInsights(fx.mapData(2022, 'PressFreedomScore', {
      yearOnYearComparable: false, mostImproved: null, mostDeclined: null
    }), 2013, 2023)
    expect(titles(ins)).toContain('Year-on-year change not shown')
    expect(titles(ins)).not.toContain('Largest increase')
    expect(text(ins)).toMatch(/changed its methodology in 2022/)
  })

  it('takes the year range from the data', () => {
    expect(text(mapInsights(fx.mapData(), 2010, 2030))).toContain('<strong>2010</strong> to <strong>2030</strong>')
  })

  it('is empty before data arrives', () => expect(mapInsights(null)).toEqual([]))
})

describe('country trend insights', () => {
  it('reports press freedom changes per period, never across 2022', () => {
    const t = fx.trend('Norway', { pressChangePeriods: [
      { fromYear: 2013, toYear: 2021, change: -9 }, { fromYear: 2022, toYear: 2023, change: 1.2 }
    ] })
    const body = trendInsights(t).find(i => i.title === 'Press freedom score').body
    expect(body).toContain('2013–2021: -9 · 2022–2023: +1.2')
  })

  it('says when there is not enough data either side of the change', () => {
    const body = trendInsights(fx.trend('X', { pressChangePeriods: [] })).find(i => i.title === 'Press freedom score').body
    expect(body).toMatch(/Not enough years/)
  })

  it('describes the largest comparable fall, or says there was none', () => {
    const withDrop = trendInsights(fx.trend('X', { sharpestDrop: { fromYear: 2017, toYear: 2018, delta: -4.1 } }))
    expect(titles(withDrop)).toContain('Largest one-year fall in press freedom')
    expect(text(withDrop)).toContain('-4.1')
    expect(titles(trendInsights(fx.trend('X')))).toContain('No one-year fall in press freedom')
  })

  it('labels the rank as a dashboard rank with the year and the number of countries', () => {
    const body = trendInsights(fx.trend()).find(i => i.title === 'Rank in this dashboard').body
    expect(body).toContain('1 of 148')
    expect(body).toContain('among the 148 countries in this dashboard with 2023 data')
    expect(body).toContain('not the official EIU or RSF ranks')
  })

  it('uses neutral wording', () => expect(text(trendInsights(fx.trend()))).not.toMatch(LOADED))
})

describe('correlation insights', () => {
  it.each([[0.765, 'strong positive'], [0.5, 'moderate positive'], [0.2, 'weak positive'], [-0.8, 'strong negative']])(
    'r = %s is described as %s', (r, words) => {
      const ins = correlationInsights({ ...fx.correlation(), pearsonR: r, rSquared: +(r * r).toFixed(3) }, false)
      expect(ins[0].body).toContain(words)
    })

  it('notes that a correlation does not show cause', () => {
    expect(text(correlationInsights(fx.correlation(), true))).toMatch(/doesn’t show that one causes the other/)
  })

  it('warns that all-years observations are not independent', () => {
    expect(text(correlationInsights(fx.correlation('all'), true))).toMatch(/aren’t independent/)
    expect(text(correlationInsights(fx.correlation('2023'), false))).not.toMatch(/aren’t independent/)
  })

  it('has nothing to say when r could not be calculated', () => {
    expect(correlationInsights({ ...fx.correlation(), pearsonR: null }, false)).toEqual([])
  })

  it('uses neutral wording', () => expect(text(correlationInsights(fx.correlation(), true))).not.toMatch(LOADED))
})

describe('data summary insights', () => {
  it('explains skew correctly: a long left tail means most countries score high', () => {
    const body = summaryInsights(fx.summary).find(i => i.title === 'Reading the histograms').body
    expect(body).toMatch(/long tail to the left \(left-skewed\) has most countries at the higher end/)
    expect(body).toMatch(/long tail to the right \(right-skewed\) has most at the lower end/)
  })

  it('labels the ranks as dashboard ranks', () => {
    expect(text(summaryInsights(fx.summary))).toContain('among the 148 countries in this dashboard with 2023 data')
  })

  it('uses neutral wording', () => expect(text(summaryInsights(fx.summary))).not.toMatch(LOADED))

  it('skips the top/bottom gap when there is none', () => {
    expect(titles(summaryInsights({ ...fx.summary, scoreGapTopVsBottom: null }))).not.toContain('Top 10 and bottom 10')
  })
})
