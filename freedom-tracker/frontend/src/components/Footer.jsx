import { DISCLAIMER, PRIVACY, SOURCES } from '../lib/sources'
import { ABOUT_PATH, onInternalLink } from '../lib/usePath'

// Credits for the scores' owners and the Kaggle uploads, the disclaimer, and a
// link to the about-the-data page — shown on every page.
export default function Footer({ navigate }) {
  const { democracy, press } = SOURCES
  return (
    <footer className="site-footer">
      <p className="footer-credits">
        Data:{' '}
        <a href={democracy.url} target="_blank" rel="noopener noreferrer">{democracy.credit}</a>
        {' · '}
        <a href={press.url} target="_blank" rel="noopener noreferrer">{press.credit}</a>
        {'. Via Kaggle uploads by '}
        <a href={democracy.upload.url} target="_blank" rel="noopener noreferrer">{democracy.upload.by}</a>
        {' (CC0) and '}
        <a href={press.upload.url} target="_blank" rel="noopener noreferrer">{press.upload.by}</a>
        {' (no licence stated). '}
        <a href={ABOUT_PATH} onClick={onInternalLink(navigate, ABOUT_PATH)}>About the data</a>
      </p>
      <p className="footer-disclaimer">{DISCLAIMER} {PRIVACY}</p>
    </footer>
  )
}
