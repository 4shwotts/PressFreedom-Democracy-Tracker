// Builds the "Key insights" rail for each page from the API data.
// Wording describes the data only — it doesn't judge countries or take a
// political position. <strong> marks figures; everything else is plain text.
import { fmtChange, metricInfo, pressPeriodsText } from './chartData'

const RANK_NOTE = 'These are not the official EIU or RSF ranks.'

// ---------------------------------------------------------------- global map

export function mapInsights(mapData, yearMin, yearMax) {
  if (!mapData) return []
  const { short } = metricInfo(mapData.metric)
  const insights = [{
    tone: 'info',
    title: 'Global average',
    body: `The average ${short} score in <strong>${mapData.year}</strong> is <strong>${mapData.globalAverage}</strong> across ${mapData.countryCount} countries.`
  }]

  if (!mapData.yearOnYearComparable) {
    insights.push({
      tone: 'neutral',
      title: 'Year-on-year change not shown',
      body: `Press freedom scores for ${mapData.year} aren’t compared with ${mapData.year - 1}, because Reporters Without Borders changed its methodology in 2022.`
    })
  } else {
    if (mapData.mostImproved) {
      insights.push({
        tone: 'improve',
        title: 'Largest increase',
        body: `<strong>${mapData.mostImproved.country}</strong>: <strong>${fmtChange(mapData.mostImproved.delta)}</strong> compared with ${mapData.year - 1}.`
      })
    }
    if (mapData.mostDeclined) {
      insights.push({
        tone: 'decline',
        title: 'Largest decrease',
        body: `<strong>${mapData.mostDeclined.country}</strong>: <strong>${fmtChange(mapData.mostDeclined.delta)}</strong> compared with ${mapData.year - 1}.`
      })
    }
  }

  insights.push({
    tone: 'neutral',
    title: 'Other years',
    body: `Use the year slider to see any year from <strong>${yearMin}</strong> to <strong>${yearMax}</strong>.`
  })
  insights.push({
    tone: 'neutral',
    title: 'Reading the map',
    body: 'Colours run from dark red (lowest scores) through orange and light blue to dark navy (highest scores); the legend shows the values. Grey countries have no data for the selected year — hover over or tap one to see which years are available. The same figures are in the table below the map.'
  })
  return insights
}

// ---------------------------------------------------------------- country trends

export function trendInsights(trend) {
  if (!trend) return []
  const first = trend.series[0]
  const last = trend.series[trend.series.length - 1]
  const demChange = trend.tenYearChangeDemocracy
  const insights = [{
    tone: demChange > 0 ? 'improve' : demChange < 0 ? 'decline' : 'neutral',
    title: 'Democracy score',
    body: `Changed by <strong>${fmtChange(demChange)}</strong> between ${first.year} and ${last.year}, from ${first.democracyScore} to ${last.democracyScore} out of 10.`
  }, {
    tone: 'neutral',
    title: 'Press freedom score',
    body: trend.pressChangePeriods.length
      ? `Change by period: <strong>${pressPeriodsText(trend.pressChangePeriods)}</strong>. Shown separately because RSF changed its methodology in 2022.`
      : 'Not enough years either side of RSF’s 2022 methodology change to show a change.'
  }]

  insights.push(trend.sharpestDrop
    ? {
        tone: 'decline',
        title: 'Largest one-year fall in press freedom',
        body: `Between <strong>${trend.sharpestDrop.fromYear}</strong> and <strong>${trend.sharpestDrop.toYear}</strong>: <strong>${trend.sharpestDrop.delta}</strong> points. Falls across the 2021–2022 methodology change aren’t counted.`
      }
    : {
        tone: 'neutral',
        title: 'No one-year fall in press freedom',
        body: 'The press freedom score didn’t fall between any two consecutive comparable years.'
      })

  insights.push({
    tone: 'neutral',
    title: 'Averages',
    body: `Average democracy score <strong>${trend.avgDemocracy}/10</strong> and press freedom score <strong>${trend.avgPress}/100</strong> across the ${trend.yearsAvailable} years with data.`
  })

  const r = trend.ranking
  insights.push({
    tone: 'info',
    title: 'Rank in this dashboard',
    body: `In ${r.rankingYear}: <strong>${r.democracyRank} of ${r.totalCountries}</strong> on democracy and <strong>${r.pressRank} of ${r.totalCountries}</strong> on press freedom, among the ${r.totalCountries} countries in this dashboard with ${r.rankingYear} data. ${RANK_NOTE}`
  })
  return insights
}

// ---------------------------------------------------------------- correlation

export function correlationInsights(corr, isAllYears) {
  if (!corr || corr.pearsonR === null) return []
  const r = corr.pearsonR
  const strength = Math.abs(r) > 0.7 ? 'strong' : Math.abs(r) > 0.4 ? 'moderate' : 'weak'
  const direction = r > 0 ? 'positive' : 'negative'
  const insights = [{
    tone: 'info',
    title: 'Relationship strength',
    body: `Pearson’s r is <strong>${r}</strong>: a ${strength} ${direction} correlation between the two scores.`
  }, {
    tone: 'neutral',
    title: 'What this shows',
    body: r > 0
      ? 'Countries with higher democracy scores tend to have higher press freedom scores in this data. A correlation doesn’t show that one causes the other.'
      : 'Countries with higher democracy scores tend to have lower press freedom scores in this data. A correlation doesn’t show that one causes the other.'
  }, {
    tone: 'neutral',
    title: 'Variance accounted for',
    body: `R² is <strong>${corr.rSquared}</strong>: about <strong>${Math.round(corr.rSquared * 100)}%</strong> of the variation in press freedom scores is accounted for by a straight-line relationship with democracy scores.`
  }, {
    tone: 'neutral',
    title: 'Points far from the line',
    body: 'These countries score higher or lower on one index than the trend line predicts. Hover over or tap a dot to see which country it is.'
  }]

  insights.push({
    tone: 'info',
    title: 'Sample size',
    body: isAllYears
      ? `<strong>${corr.sampleSize.toLocaleString('en-GB')}</strong> country-year observations. Each country appears once per year, so the observations aren’t independent; a single year gives a cleaner comparison.`
      : `<strong>${corr.sampleSize.toLocaleString('en-GB')}</strong> countries with both scores in ${corr.year}.`
  })
  return insights
}

// ---------------------------------------------------------------- data summary

export function summaryInsights(summary) {
  if (!summary) return []
  const insights = [{
    tone: 'info',
    title: 'Dataset at a glance',
    body: `<strong>${summary.totalCountries}</strong> countries across <strong>${summary.totalYears}</strong> years — <strong>${summary.totalRecords.toLocaleString('en-GB')}</strong> country-year observations.`
  }]
  if (summary.scoreGapTopVsBottom !== null) {
    insights.push({
      tone: 'neutral',
      title: 'Top 10 and bottom 10',
      body: `The top 10 average <strong>${summary.scoreGapTopVsBottom}</strong> points higher on the combined score than the bottom 10.`
    })
  }
  if (summary.biggestGapCountry) {
    const g = summary.biggestGapCountry
    insights.push({
      tone: 'neutral',
      title: 'Largest gap between the two indices',
      body: `<strong>${g.country}</strong>: democracy score <strong>${g.democracyScore}/10</strong> and press freedom score <strong>${g.pressFreedomScore}/100</strong> (after rescaling press freedom to 0–10).`
    })
  }
  insights.push({
    tone: 'neutral',
    title: 'How the combined score works',
    body: `The average of the democracy score (0–10) and the press freedom score rescaled to 0–10. Countries are ranked among the ${summary.rankedCountries} countries in this dashboard with ${summary.year} data; tied countries share a rank. ${RANK_NOTE}`
  })
  insights.push({
    tone: 'neutral',
    title: 'Reading the histograms',
    body: 'Each bar counts the countries whose score falls in that range. A distribution with a long tail to the left (left-skewed) has most countries at the higher end; a long tail to the right (right-skewed) has most at the lower end.'
  })
  return insights
}
