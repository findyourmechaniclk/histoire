/** `@nuxtjs/color-mode` options needed by the helper (`#build/color-mode-options.mjs`). */
export interface ColorModeOptions {
  /** Window property the color-mode plugin reads the helper from. */
  globalName: string
  classPrefix: string
  classSuffix: string
  /** Sets `data-<dataValue>` on `<html>` when not empty. */
  dataValue: string
}

/** App color mode state provided by the color-mode plugin (`useColorMode()`). */
export interface ColorModeState {
  preference: string
  value: string
  forced?: boolean
}

/** Helper the color-mode inline head script installs in a real Nuxt page. */
interface ColorModeHelper {
  preference: string
  value: string
  getColorScheme: () => string
  addColorScheme: (value: string) => void
  removeColorScheme: (value: string) => void
}

/**
 * Installs the `@nuxtjs/color-mode` helper in a story document and returns a
 * function syncing it with Histoire's dark mode.
 *
 * In a real page, an inline head script installs the helper before the app
 * boots; the color-mode plugin reads it once, when its module loads. Here the
 * helper always prefers `system`, which resolves to Histoire's dark mode, and
 * applies classes like the real script does.
 * @param win Story document window.
 * @param options Resolved color-mode module options.
 */
export function createColorModeSync(win: Window, options: ColorModeOptions) {
  const root = win.document.documentElement
  // Story apps of one document share the helper: the plugin module reads it once.
  let helper = (win as any)[options.globalName] as ColorModeHelper | undefined
  if (!helper) {
    helper = {
      preference: 'system',
      // Current Histoire scheme, which `system` resolves to.
      value: 'light',
      getColorScheme: () => helper.value,
      addColorScheme(value) {
        root.classList.add(`${options.classPrefix}${value}${options.classSuffix}`)
        if (options.dataValue) root.setAttribute(`data-${options.dataValue}`, value)
      },
      removeColorScheme(value) {
        root.classList.remove(`${options.classPrefix}${value}${options.classSuffix}`)
        if (options.dataValue) root.removeAttribute(`data-${options.dataValue}`)
      },
    }
    ;(win as any)[options.globalName] = helper
    helper.addColorScheme(helper.value)
  }

  /**
   * Applies Histoire's dark mode. Once the color-mode plugin provided `state`,
   * its own watchers swap the classes; a story that picked an explicit color
   * mode keeps it.
   */
  return (dark: boolean, state?: ColorModeState) => {
    const previous = helper.value
    helper.value = dark ? 'dark' : 'light'
    if (state) {
      if (state.preference === 'system' && !state.forced) state.value = helper.value
      return
    }
    helper.removeColorScheme(previous)
    helper.addColorScheme(helper.value)
  }
}
