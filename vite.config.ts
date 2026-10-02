import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `npm run build:claude` gera um único arquivo HTML para publicar o app no claude.ai.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'claude' ? [react(), viteSingleFile()] : [react()],
  build: mode === 'claude' ? { outDir: 'dist-claude' } : undefined,
}))
