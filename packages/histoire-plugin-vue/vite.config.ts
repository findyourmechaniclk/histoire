import fs from 'node:fs'
import { globbySync } from 'globby'
import { defineConfig } from 'vite'
import { rolldownWatchOptions } from '../../scripts/vite-watch.mjs'

export default defineConfig({
  plugins: [
    {
      name: 'histoire:preserve:import.dynamic',
      enforce: 'pre',
      transform(code) {
        if (code.includes('import(')) {
          return {
            code: code.replace(/import\(/g, 'import__dyn('),
          }
        }
      },
      closeBundle() {
        try {
          const files = globbySync('./dist/**/*.js')
          for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8')
            if (content.includes('import__dyn')) {
              fs.writeFileSync(file, content.replace(/import__dyn\(/g, 'import(/* @vite-ignore */'), 'utf-8')
            }
          }
        }
        catch (e) {
          console.error(e)
        }
      },
    },
  ],

  build: {
    watch: rolldownWatchOptions('plugin-vue'),
    emptyOutDir: false,
    outDir: 'dist/bundled',
    lib: {
      entry: '',
      formats: ['es'],
    },
    rolldownOptions: {
      external: [
        /\$histoire/,
        /@histoire/,
        'vue',
      ],

      input: {
        'client/client': 'src/client/client.ts',
        'client/server': 'src/client/server.ts',
      },

      output: {
        entryFileNames: '[name].js',
        // Every story sandbox loads the client again: bundled, it is a couple
        // of modules instead of one per source file. Code both entries use
        // lands in one shared chunk, so it still has a single instance.
        chunkFileNames: 'client/chunks/[name]-[hash].js',
        assetFileNames: '[name][extname]',
      },
      treeshake: false,
      preserveEntrySignatures: 'strict',
    },
  },
})
