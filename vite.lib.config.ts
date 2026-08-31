import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-lib',
    emptyOutDir: true,
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'calcura-plots.js',
      cssFileName: 'calcura-plots',
    },
    rollupOptions: {
      external: [
        'react',
        'react/jsx-runtime',
        'function-plot',
        'mathjs',
      ],
    },
  },
})
