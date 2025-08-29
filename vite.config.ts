import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/cli/index.ts'),
      name: 'WriteFlow',
      fileName: (format) => `writeflow.${format}.js`,
      formats: ['es', 'cjs']
    },
    target: 'node22',
    outDir: 'dist',
    rollupOptions: {
      external: [
        'node:fs',
        'node:path',
        'node:process',
        'node:readline',
        'node:crypto',
        'node:child_process',
        'fs/promises',
        '@anthropic-ai/sdk',
        'undici',
        'yaml',
        'react',
        'chalk',
        'ora',
        'enquirer',
        'ink'
      ],
      output: {
        globals: {
          'chalk': 'chalk',
          'ora': 'ora',
          'yaml': 'yaml'
        }
      }
    },
    minify: false,
    sourcemap: true
  },
  esbuild: {
    target: 'node22',
    format: 'esm',
    platform: 'node'
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/core': resolve(__dirname, 'src/core'),
      '@/cli': resolve(__dirname, 'src/cli'),
      '@/tools': resolve(__dirname, 'src/tools'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/utils': resolve(__dirname, 'src/utils')
    }
  },
  optimizeDeps: {
    exclude: ['@anthropic-ai/sdk']
  }
})