/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // relative Pfade -> funktioniert auf GitHub Pages unter /<repo>/ ohne Anpassung
  base: './',
  // Build direkt nach docs/ (GitHub Pages "Deploy from branch -> /docs")
  build: { outDir: 'docs' },
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'supabase/functions/_shared/**/*.test.ts'],
  },
})
