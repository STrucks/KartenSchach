import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: process.env.GITHUB_ACTIONS ? '/KartenSchach/' : '/',
  plugins: [react()],
  test: { environment: 'jsdom', globals: true },
})
