// Sample API responses for component tests, shaped exactly like the Flask API's.

export const meta = {
  countriesAnalysed: 167,
  avgDemocracyScore: 5.7,
  avgDemocracyYear: 2023,
  avgDemocracyCountryCount: 148,
  topCountry: 'Norway', topScore: 9.8,
  bottomCountry: 'Afghanistan', bottomScore: 0.3,
  yearMin: 2013, yearMax: 2023, yearsAvailable: 11
}

export function mapData(year = 2023, metric = 'DemocracyScore', overrides = {}) {
  return {
    year,
    metric,
    rows: [
      { country: 'Norway', iso: 'NOR', democracyScore: 9.81, pressFreedomScore: 95.18, value: 9.81, change: 0.06 },
      { country: 'Chad', iso: 'TCD', democracyScore: 1.67, pressFreedomScore: 49.3, value: 1.67, change: -0.1 }
    ],
    globalAverage: year === 2023 ? 5.74 : 5.55,
    mostImproved: { country: 'Norway', delta: 0.06 },
    mostDeclined: { country: 'Chad', delta: -0.1 },
    countryCount: 2,
    noDataThisYear: [],
    yearOnYearComparable: true,
    ...overrides
  }
}

export function trend(country = 'Norway', overrides = {}) {
  return {
    country,
    series: [
      { year: 2021, democracyScore: 9.75, pressFreedomScore: 93.28 },
      { year: 2022, democracyScore: 9.81, pressFreedomScore: 92.65 },
      { year: 2023, democracyScore: 9.81, pressFreedomScore: 95.18 }
    ],
    latestDemocracy: 9.81,
    latestPress: 95.18,
    democracyChangeVsPrevYear: 0,
    pressChangeVsPrevYear: 2.53,
    tenYearChangeDemocracy: 0.06,
    pressChangePeriods: [{ fromYear: 2022, toYear: 2023, change: 2.53 }],
    avgDemocracy: 9.79,
    avgPress: 93.7,
    sharpestDrop: null,
    ranking: { democracyRank: 1, pressRank: 1, totalCountries: 148, rankingYear: 2023 },
    yearsAvailable: 3,
    ...overrides
  }
}

export const summary = {
  year: 2023,
  totalCountries: 167,
  totalYears: 11,
  totalRecords: 1818,
  rankedCountries: 148,
  democracyHistogram: [
    { binStart: 0.3, binEnd: 5.0, count: 70 },
    { binStart: 5.0, binEnd: 9.8, count: 78 }
  ],
  pressHistogram: [
    { binStart: 21.7, binEnd: 58.5, count: 74 },
    { binStart: 58.5, binEnd: 95.2, count: 74 }
  ],
  top10: [
    { rank: 1, country: 'Norway', democracyScore: 9.8, pressFreedomScore: 95.2, combinedScore: 9.7 },
    { rank: 2, country: 'Denmark', democracyScore: 9.3, pressFreedomScore: 89.5, combinedScore: 9.1 },
    { rank: 2, country: 'Sweden', democracyScore: 9.4, pressFreedomScore: 88.2, combinedScore: 9.1 }
  ],
  bottom10: [
    { rank: 148, country: 'China', democracyScore: 2.1, pressFreedomScore: 23.0, combinedScore: 2.2 },
    { rank: 147, country: 'Vietnam', democracyScore: 2.6, pressFreedomScore: 24.6, combinedScore: 2.5 }
  ],
  biggestGapCountry: { country: 'Niger', democracyScore: 2.4, pressFreedomScore: 66.8 },
  scoreGapTopVsBottom: 6.2
}

export function correlation(year = 'all') {
  return {
    year,
    points: [
      { country: 'Norway', year: 2023, democracyScore: 9.81, pressFreedomScore: 95.18 },
      { country: 'Chad', year: 2023, democracyScore: 1.67, pressFreedomScore: 49.3 }
    ],
    pearsonR: 0.765,
    rSquared: 0.585,
    sampleSize: year === 'all' ? 1818 : 148,
    trendline: { slope: 6.1, intercept: 33.2 }
  }
}
