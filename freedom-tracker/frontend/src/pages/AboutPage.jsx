import { ASSETS, DISCLAIMER, PRIVACY, SOURCES } from '../lib/sources'
import { onInternalLink } from '../lib/usePath'

const ext = { target: '_blank', rel: 'noopener noreferrer' }

// the 19 countries with no 2023 democracy score in the source upload
const NO_2023 = [
  'Afghanistan', 'Belarus', 'Central African Republic', 'Chad', 'Democratic Republic of Congo', 'Equatorial Guinea',
  'Eritrea', 'Iran', 'Laos', 'Libya', 'Myanmar', 'North Korea', 'Saudi Arabia', 'Sudan', 'Syria', 'Tajikistan',
  'Turkmenistan', 'Uzbekistan', 'Yemen'
]

// places in the press freedom index that have no EIU democracy score
const PRESS_ONLY = [
  'Andorra', 'Belize', 'Brunei', 'Kosovo', 'Liechtenstein', 'Maldives', 'Northern Cyprus',
  'Organisation of Eastern Caribbean States', 'Samoa', 'Seychelles', 'Somalia', 'South Sudan', 'Tonga'
]

// in the dataset, but too small to be drawn on the world map at its resolution
const NOT_ON_MAP = ['Bahrain', 'Cape Verde', 'Comoros', 'Hong Kong', 'Malta', 'Mauritius', 'Singapore']

export default function AboutPage({ navigate }) {
  const { democracy, press } = SOURCES
  return (
    <article className="about" aria-labelledby="about-title">
      <p className="about-back">
        <a href="/" onClick={onInternalLink(navigate, '/')}>← Back to the dashboard</a>
      </p>
      <h2 id="about-title" className="about-title">About the data</h2>
      <p className="about-lead">
        This dashboard shows two published indices side by side for 167 countries from 2013 to 2023: the
        EIU Democracy Index and the RSF World Press Freedom Index. It describes the published scores; it doesn’t
        add its own judgements about countries.
      </p>

      <section aria-labelledby="about-sources">
        <h3 id="about-sources">Sources</h3>
        <dl className="about-sources">
          <dt>Democracy scores</dt>
          <dd>
            <a href={democracy.url} {...ext}>{democracy.credit}</a>. The overall Democracy Index score, from 0 to
            10 (higher is a higher score on the index). The EIU’s five category scores aren’t included in the data
            used here. Downloaded from the Kaggle upload{' '}
            <a href={democracy.upload.url} {...ext}>“{democracy.upload.title}” by {democracy.upload.by}</a>, published
            under <a href={democracy.upload.licenceUrl} {...ext}>{democracy.upload.licence}</a>.{' '}
            {democracy.upload.note}
          </dd>
          <dt>Press freedom scores</dt>
          <dd>
            <a href={press.url} {...ext}>{press.credit}</a>. The overall score, from 0 to 100 (higher is a higher
            score on the index). Downloaded from the Kaggle upload{' '}
            <a href={press.upload.url} {...ext}>“{press.upload.title}” by {press.upload.by}</a>. {press.upload.licence}.{' '}
            {press.upload.note}
          </dd>
        </dl>
        <p>
          The scores belong to the Economist Intelligence Unit and Reporters Without Borders respectively. For
          their methodology, and for current figures, please see the organisations’ own pages linked above.
        </p>
      </section>

      <section aria-labelledby="about-years">
        <h3 id="about-years">Years covered</h3>
        <p>
          <strong>2013 to 2023.</strong> The democracy upload starts in 2006 and the press freedom upload in 2013, so
          the dashboard covers the years both share. That gives 1,818 country-year observations for 167 countries.
        </p>
      </section>

      <section aria-labelledby="about-merge">
        <h3 id="about-merge">How the two datasets were merged</h3>
        <ol>
          <li>Regional and world totals in the democracy file (such as “Africa” or “World”) are removed, as they aren’t countries.</li>
          <li>Blank separator rows in the press freedom file are removed.</li>
          <li>Rows with a missing score, country code or year are removed. No score is ever changed.</li>
          <li>
            The two files are joined on the three-letter ISO country code and the year — not on the country name.
            The press freedom file renames some countries between years (for example “Russian Federation” became
            “Russia”) and two names in it have damaged characters, so joining on names would lose rows. Country
            names shown in the dashboard come from the democracy file.
          </li>
          <li>Only country-years present in both files are kept.</li>
        </ol>
        <p>
          The merge is a script in the project’s repository (<code>backend/data.py</code>), and an automated test
          checks that the merged file always matches a fresh rebuild from the two downloaded files.
        </p>
      </section>

      <section aria-labelledby="about-calc">
        <h3 id="about-calc">How rankings and calculated values are worked out</h3>
        <dl className="about-defs">
          <dt>Ranks</dt>
          <dd>
            Countries are ranked among the countries in this dashboard that have both scores in the same year,
            higher scores first. Tied countries share the better rank and the next rank is skipped (1, 2, 2, 4);
            tied countries are listed alphabetically. Countries without a score that year aren’t ranked. Ranks use
            unrounded scores. <strong>These are not the official EIU or RSF ranks</strong>, which cover different sets of
            countries.
          </dd>
          <dt>Combined score (Data summary)</dt>
          <dd>The average of the democracy score and the press freedom score divided by 10, so both count equally on a 0–10 scale.</dd>
          <dt>Averages</dt>
          <dd>Plain averages of the countries or years that have data; missing values are left out, not counted as zero.</dd>
          <dt>Changes</dt>
          <dd>
            A change is the later score minus the earlier one. Democracy changes run from a country’s first year with
            data to its last. Press freedom changes are worked out separately for 2013–2021 and 2022–2023 (see below).
            The “largest one-year fall” compares consecutive years with data, ignoring 2021 to 2022 for press freedom.
            On the map, ties for the largest increase or decrease go to the country first in alphabetical order.
          </dd>
          <dt>Correlation</dt>
          <dd>
            Pearson’s r between the two scores, R² (r squared) and a least-squares straight line. With “All years”,
            each country appears once per year, so the observations aren’t independent; a single year gives a cleaner
            comparison. A correlation doesn’t show that one score causes the other.
          </dd>
          <dt>Histograms</dt>
          <dd>Ten equal-width bins between the lowest and highest score in the latest year.</dd>
        </dl>
      </section>

      <section aria-labelledby="about-rsf">
        <h3 id="about-rsf">Reporters Without Borders’ 2022 methodology change</h3>
        <p>
          RSF <a href={press.methodologyUrl} {...ext}>changed how it compiles the World Press Freedom Index in 2022</a>,
          so scores from 2021 and earlier aren’t directly comparable with scores from 2022 onwards. The dashboard
          keeps the published values but never calculates a press freedom change across that break, and notes it
          on every chart that compares press freedom across years.
        </p>
        <p>
          Before 2022, RSF published scores where lower meant more press freedom. In the Kaggle upload those years
          appear to have been converted to the current direction (higher means more press freedom) — for example,
          the United States’ 2013 value is 81.78, which is 100 minus the 18.22 RSF published that year.
        </p>
      </section>

      <section aria-labelledby="about-gaps">
        <h3 id="about-gaps">Known gaps in the data</h3>
        <ul>
          <li>
            <strong>No 2023 democracy score for 19 countries</strong> in the Kaggle upload, although the EIU’s 2023
            edition covers them: {NO_2023.join(', ')}. They’re shown in grey on the 2023 map, and the 2023 rankings
            and averages cover the other 148 countries.
          </li>
          <li>
            <strong>13 places in the press freedom index have no EIU score</strong> and so aren’t in the dashboard:{' '}
            {PRESS_ONLY.join(', ')}. (Kosovo and the Organisation of Eastern Caribbean States each appear under two
            different codes in the source file.)
          </li>
          <li>
            <strong>7 countries are too small to be drawn</strong> on the world map at its resolution, but appear on
            every other view: {NOT_ON_MAP.join(', ')}.
          </li>
          <li>Only the overall democracy score is available, not the EIU’s five category scores.</li>
          <li>
            The press freedom file’s own rank column isn’t used; for a few dozen rows it doesn’t match the order of
            the scores, and the dashboard calculates its own ranks anyway.
          </li>
        </ul>
      </section>

      <section aria-labelledby="about-disclaimer">
        <h3 id="about-disclaimer">Disclaimer</h3>
        <p>{DISCLAIMER}</p>
      </section>

      <section aria-labelledby="about-privacy">
        <h3 id="about-privacy">Privacy</h3>
        <p>{PRIVACY}</p>
      </section>

      <section aria-labelledby="about-credits">
        <h3 id="about-credits">Fonts, map and icons</h3>
        <p>Everything is served from this site; no fonts, scripts or analytics are loaded from third parties.</p>
        <ul>
          {ASSETS.map(a => (
            <li key={a.name}><a href={a.url} {...ext}>{a.name}</a> by {a.by} — {a.licence}</li>
          ))}
        </ul>
      </section>
    </article>
  )
}
