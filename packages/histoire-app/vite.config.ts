import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import fs from 'fs-extra'
import { globbySync } from 'globby'
import { defineConfig } from 'vite'
import { rolldownWatchOptions } from '../../scripts/vite-watch.mjs'

/** Read package dependencies once, including when Vite uses its ESM config runner. */
const dependencies = Object.keys(fs.readJsonSync(fileURLToPath(new URL('./package.json', import.meta.url))).dependencies)

/** Static entry roots whose modules must have one shared instance per document. */
const runtimeEntries = new Set(['api', 'sandbox'].map(name => fileURLToPath(new URL(`./src/app/${name}.ts`, import.meta.url))))

/** Build all app consumers together so shared state never crosses separate bundles. */
export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'histoire:preserve:import.meta',
      enforce: 'pre',
      transform(code) {
        if (code.includes('import.meta')) {
          return {
            code: code.replace(/import\.meta/g, 'import__meta'),
          }
        }
      },
      closeBundle() {
        try {
          const files = globbySync('./dist/bundled/**/*.js')
          for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8')
            if (content.includes('import__meta')) {
              fs.writeFileSync(file, content.replace(/import__meta/g, 'import.meta'), 'utf-8')
            }
          }
        }
        catch (e) {
          console.error(e)
        }
      },
    },
  ],

  resolve: {
    alias: {
      '@histoire/vue/internal': fileURLToPath(new URL('../histoire-vue/src/internal.ts', import.meta.url)),
      '@histoire/vue': fileURLToPath(new URL('../histoire-vue/src/index.ts', import.meta.url)),
      '@histoire/controls/vue': fileURLToPath(new URL('../histoire-controls/src/index.ts', import.meta.url)),
      'floating-vue': '@histoire/vendors/floating-vue',
      '@iconify/vue': '@histoire/vendors/iconify',
      'pinia': '@histoire/vendors/pinia',
      'scroll-into-view-if-needed': '@histoire/vendors/scroll',
      'vue-router': '@histoire/vendors/vue-router',
      '@vueuse/core': '@histoire/vendors/vue-use',
      'vue': '@histoire/vendors/vue',
    },
  },

  build: {
    watch: rolldownWatchOptions('app'),
    emptyOutDir: false,
    outDir: 'dist/bundled',
    lib: {
      entry: '',
      formats: ['es'],
    },
    rolldownOptions: {
      // Native UI source must pass through existing vendor aliases so this
      // document never mixes a host Vue copy with Histoire's vendor Vue.
      external(id) {
        if (id === '@histoire/vue' || id === '@histoire/vue/internal' || id === '@histoire/controls/vue') return false
        return /\$histoire|@histoire/.test(id) || dependencies.some(name => id === name || id.startsWith(`${name}/`))
      },

      input: {
        api: 'src/app/api.ts',
        index: 'src/app/index.ts',
        sandbox: 'src/app/sandbox.ts',
        // Workbench plugins resolve `@histoire/controls/vue` to this entry, so
        // they share the controls instance compiled into the workbench.
        controls: fileURLToPath(new URL('../histoire-controls/src/index.ts', import.meta.url)),
      },

      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name]-[hash].js',
        codeSplitting: {
          // Static dependencies share one owner; dynamic imports stay lazy.
          // Recursive inclusion is required with strict entry signatures.
          includeDependenciesRecursively: true,
          groups: [{
            // Own chunk, so workbench plugins importing the controls entry don't
            // load the sandbox runtime (and its virtual modules) with it.
            name: 'controls',
            test: /[\\/]histoire-controls[\\/]src[\\/]/,
            priority: 2,
          }, {
            name: 'sandbox-shared',
            /** Capture both roots and their shared static dependencies. */
            test(id) {
              return runtimeEntries.has(id)
            },
            priority: 1,
          }],
        },
        assetFileNames: '[name][extname]',
      },
      treeshake: false,
      preserveEntrySignatures: 'strict',
    },
    cssCodeSplit: false,
    minify: false,
  },
})
