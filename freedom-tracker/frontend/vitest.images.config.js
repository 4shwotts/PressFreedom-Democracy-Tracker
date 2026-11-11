// Separate Vitest config for the image size checks, so they're reported and
// counted apart from the component tests. Run with: npm run test:images
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['checks/**/*.test.js']
  }
})
