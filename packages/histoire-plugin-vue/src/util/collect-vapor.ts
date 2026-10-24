import type { Plugin as VitePlugin } from 'vite'

/** Opening `<script>` tags of an SFC. */
const SCRIPT_TAG_RE = /<script\b[^>]*>/g
/** Bare or empty-valued `vapor` attribute inside one tag. */
const VAPOR_ATTR_RE = /\svapor(?:=(?:""|''))?(?=[\s>])/

/**
 * Compiles `<script setup vapor>` SFCs as VDOM components in Node collection.
 *
 * Collection runs story modules with Vue's CJS build, which has no Vapor
 * runtime (`defineVaporComponent is not a function`), and only needs story
 * metadata. Vapor SFC syntax is a subset of VDOM SFCs, so dropping the opt-in
 * attribute before `@vitejs/plugin-vue` compiles them is enough. The browser
 * still renders them in Vapor mode.
 */
export function collectVaporPlugin(): VitePlugin {
  return {
    name: 'histoire-plugin-vue:collect-vapor',
    enforce: 'pre',
    transform(code, id) {
      if (!(this.meta as any).histoire?.isCollecting || !id.endsWith('.vue')) return
      if (!code.includes('vapor')) return
      return code.replace(SCRIPT_TAG_RE, tag => tag.replace(VAPOR_ATTR_RE, ''))
    },
  }
}
