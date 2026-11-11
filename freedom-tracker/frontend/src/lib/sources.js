// Data sources, credits and the disclaimer — one place, used by the footer and
// the about-the-data page (and mirrored in the README).

export const SOURCES = {
  democracy: {
    owner: 'Economist Intelligence Unit',
    credit: 'Democracy Index © Economist Intelligence Unit',
    index: 'EIU Democracy Index',
    url: 'https://www.eiu.com/n/campaigns/democracy-index-2023/',
    upload: {
      title: 'Global Democracy Index (2006-2023)',
      by: 'shreyasur965',
      url: 'https://www.kaggle.com/datasets/shreyasur965/democracy-index',
      licence: 'CC0 1.0 (public domain dedication)',
      licenceUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
      // the CC0 dedication covers the uploader's compilation, not the EIU's index
      note: 'The CC0 dedication covers the uploader’s compilation only; the index itself belongs to the EIU.'
    }
  },
  press: {
    owner: 'Reporters Without Borders (RSF)',
    credit: 'World Press Freedom Index © Reporters Without Borders (RSF)',
    index: 'RSF World Press Freedom Index',
    url: 'https://rsf.org/en/index',
    methodologyUrl: 'https://rsf.org/en/index-methodologie-2022',
    upload: {
      title: 'World Press Freedom Index',
      by: 'batrosjamali',
      url: 'https://www.kaggle.com/datasets/batrosjamali/world-press-freedom-index',
      licence: 'No licence stated on Kaggle',
      licenceUrl: null,
      note: 'The index itself belongs to RSF.'
    }
  }
}

export const DISCLAIMER =
  'A non-commercial portfolio project for data visualisation, provided as-is. Not affiliated with or endorsed by ' +
  'the Economist Intelligence Unit, Reporters Without Borders or Kaggle. The dashboard describes the published ' +
  'scores and does not take a political position.'

// accurate to the code: no cookies, analytics or browser storage (localStorage,
// sessionStorage, IndexedDB) are used, and a test checks this in a real browser
export const PRIVACY =
  'This site sets no cookies, has no analytics and stores nothing on your device (beyond your browser’s normal page ' +
  'cache). Like any website, the hosting providers (Vercel, Render and Cloudflare) see visitors’ IP addresses when ' +
  'serving pages.'

// fonts, map data and icons used by the site, with their licences
export const ASSETS = [
  { name: 'Inter (font)', by: 'Rasmus Andersson', licence: 'SIL Open Font Licence 1.1', url: 'https://github.com/rsms/inter' },
  { name: 'IBM Plex Mono (font)', by: 'IBM', licence: 'SIL Open Font Licence 1.1', url: 'https://github.com/IBM/plex' },
  { name: 'Country shapes: world-atlas', by: 'Mike Bostock', licence: 'ISC', url: 'https://github.com/topojson/world-atlas' },
  { name: 'Map data behind world-atlas: Natural Earth', by: 'Natural Earth', licence: 'Public domain', url: 'https://www.naturalearthdata.com/about/terms-of-use/' },
  { name: 'Moon and sun icons', by: 'Feather Icons', licence: 'MIT', url: 'https://github.com/feathericons/feather' }
]
