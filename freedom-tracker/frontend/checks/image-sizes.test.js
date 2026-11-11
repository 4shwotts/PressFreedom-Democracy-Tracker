// Every image and icon the site ships must be under 200 kB. Runs as its own
// suite (npm run test:images) so it's counted separately from the app tests.
// Covers the source folders and, if it has been built, the production bundle.
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const LIMIT = 200 * 1024
const IMAGE = /\.(svg|png|jpe?g|gif|webp|avif|ico)$/i
const ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

function images(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return images(path)
    return IMAGE.test(entry.name) ? [path] : []
  })
}

const files = ['public', 'src', 'dist'].flatMap(d => images(join(ROOT, d)))

describe('image and icon sizes', () => {
  it('finds the site’s images (so the checks below are really running)', () => {
    expect(files.map(f => relative(ROOT, f).replaceAll('\\', '/'))).toContain('public/favicon.svg')
  })

  it.each(files.map(f => [relative(ROOT, f).replaceAll('\\', '/'), f]))('%s is under 200 kB', (_, file) => {
    expect(statSync(file).size).toBeLessThan(LIMIT)
  })
})
