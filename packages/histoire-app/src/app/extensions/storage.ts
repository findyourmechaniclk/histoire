import type { StorageLike } from '@histoire/plugin-kit'

/**
 * Browser storage for plugin preferences, or `undefined` when access is denied (private
 * browsing, sandboxed documents); the host then keeps preferences in memory. Changes other tabs
 * make to the same storage arrive through `storage` events, so preference subscribers update;
 * the host keeps only its project namespace and removes the listener when disposed.
 * @param window Owning window.
 */
export function createWorkbenchStorage(window: Window): StorageLike | undefined {
  let local: Storage | undefined
  try {
    local = window.localStorage ?? undefined
  }
  catch {
    return undefined
  }
  if (!local) return undefined
  const area = local
  const storage: StorageLike = {
    getItem: key => area.getItem(key),
    setItem: (key, value) => area.setItem(key, value),
    removeItem: key => area.removeItem(key),
  }
  if (typeof window.addEventListener !== 'function') return storage
  return {
    ...storage,
    subscribe(listener) {
      /** `storage` fires in every other same-origin tab, for local and session storage alike. */
      const onStorage = (event: StorageEvent) => {
        if (event.storageArea === area) listener(event.key)
      }
      window.addEventListener('storage', onStorage)
      return () => window.removeEventListener('storage', onStorage)
    },
  }
}

/**
 * Namespace separating plugin preferences of projects served from one origin. Derived from
 * the book base URL without query or hash, so every route of one book shares it.
 * @param previewBase Configured source base URL.
 */
export function getWorkbenchStorageNamespace(previewBase: string): string {
  const url = new URL(previewBase)
  return `_histoire-ui:${url.origin}${url.pathname}`
}
