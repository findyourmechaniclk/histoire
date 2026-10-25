import { MODULE_LOAD_FAILURE } from '@histoire/shared'

/**
 * Inline script defining `__histoireEntryFailed`, called when a dev document's
 * module entry fails to load. A module script fires `error` when the entry or
 * any of its static imports can't be fetched (a dropped connection, e.g.
 * Chromium `net::ERR_NETWORK_CHANGED`); the document would otherwise stay blank.
 * It reloads at most 3 times a minute per document URL, tracked in
 * `sessionStorage`, and never without it; it returns whether it will reload.
 * It reloads only once the server answers: a reload during the outage would
 * leave the browser's error page, where nothing can recover.
 */
export const ENTRY_RELOAD_SCRIPT = `window.__histoireEntryFailed = function () {
  var key = '__histoire_entry_reload__:' + window.location.pathname + window.location.search
  var now = Date.now()
  var recent
  try {
    recent = JSON.parse(window.sessionStorage.getItem(key) || '[]').filter(function (time) { return now - time < 60000 })
    if (recent.length >= 3) return false
    window.sessionStorage.setItem(key, JSON.stringify(recent.concat(now)))
  }
  catch (error) {
    return false
  }
  // 0.5, 1.5, 4.5 s: a brief network change can outlast the first retries.
  window.setTimeout(function () { reloadWhenReachable(0) }, 500 * Math.pow(3, recent.length))
  return true
}

function reloadWhenReachable(attempt) {
  // Any HTTP response means the server is reachable again; poll for up to 30 s.
  window.fetch(window.location.href, { method: 'HEAD', cache: 'no-store' }).then(function () {
    window.location.reload()
  }, function () {
    if (attempt < 60) window.setTimeout(function () { reloadWhenReachable(attempt + 1) }, 500)
  })
}`

/**
 * Inline script reloading a dev document (workbench, embed) under the same
 * guard when a dynamic import outside its framework's error handling fails
 * to fetch and nothing catches it. Story documents report these through the
 * runtime's own error reporter instead. Requires {@link ENTRY_RELOAD_SCRIPT}.
 */
export const UNHANDLED_MODULE_FAILURE_SCRIPT = `window.addEventListener('unhandledrejection', function (event) {
  var reason = event.reason
  if (${MODULE_LOAD_FAILURE}.test(String(reason && reason.message !== undefined ? reason.message : reason))) window.__histoireEntryFailed()
})`

/**
 * Module entry script of a dev document, reloading it when its graph fails to load.
 * Pair it with {@link ENTRY_RELOAD_SCRIPT} earlier in the document.
 * @param src Entry module URL.
 */
export function renderModuleEntry(src: string): string {
  return `<script type="module" src="${src}" onerror="__histoireEntryFailed()"></script>`
}
