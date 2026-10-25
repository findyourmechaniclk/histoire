import type { FrameSnapshotCapture } from './capture.js'

/** Content size measured for the captured frame, at the width it rendered with. */
export interface FrameSnapshotSize {
  /** Measured content size. */
  size?: { width: number, height: number }
  /** Frame width the content was measured at. */
  width?: number
}

/** Stored snapshot; its CSS lives in a separate record shared by snapshots. */
interface SnapshotRecord extends Omit<FrameSnapshotCapture, 'css'>, FrameSnapshotSize {
  key: string
  /** Hash of the CSS record. */
  style: string
  /** Last write, for pruning. */
  at: number
}

/** A stored snapshot with its CSS text. */
export type StoredFrameSnapshot = Omit<SnapshotRecord, 'style'> & { css: string }

/** 53-bit FNV-1a style hash: identifies identical stylesheets across cells. */
function hashText(text: string): string {
  let h1 = 0x811C9DC5
  let h2 = 0x01000193
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index)
    h1 = Math.imul(h1 ^ code, 0x01000193)
    h2 = Math.imul(h2 ^ code, 0x5BD1E995)
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}-${text.length.toString(36)}`
}

/** Resolves an IndexedDB request. */
function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Resolves once a transaction committed. */
function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

/**
 * Snapshot storage in this browser's IndexedDB. Unaffected by the HTTP cache
 * settings, and kept across reloads and server restarts.
 * @param options Store options
 * @param options.name Database name
 * @param options.limit Snapshots kept; the least recently written go first
 */
export function createFrameSnapshotStore(options: { name?: string, limit?: number } = {}) {
  const { name = 'histoire-frame-snapshots', limit = 500 } = options
  let database: Promise<IDBDatabase> | undefined

  /** Opens (and creates) the database once. */
  function open(): Promise<IDBDatabase> {
    return database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 1)
      request.onupgradeneeded = () => {
        const snapshots = request.result.createObjectStore('snapshots', { keyPath: 'key' })
        snapshots.createIndex('at', 'at')
        request.result.createObjectStore('styles', { keyPath: 'hash' })
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /** Drops the oldest snapshots past the limit, then styles no snapshot uses. */
  async function prune(db: IDBDatabase): Promise<void> {
    const transaction = db.transaction(['snapshots', 'styles'], 'readwrite')
    const snapshots = transaction.objectStore('snapshots')
    const styles = transaction.objectStore('styles')
    const records = await done(snapshots.index('at').getAll()) as SnapshotRecord[]
    const kept = records.slice(Math.max(0, records.length - limit))
    for (const record of records.slice(0, records.length - kept.length)) snapshots.delete(record.key)
    const used = new Set(kept.map(record => record.style))
    for (const hash of await done(styles.getAllKeys())) {
      if (!used.has(hash as string)) styles.delete(hash)
    }
    await committed(transaction)
  }

  return {
    /** Latest snapshot stored for `key`. */
    async get(key: string): Promise<StoredFrameSnapshot | undefined> {
      const db = await open()
      const transaction = db.transaction(['snapshots', 'styles'], 'readonly')
      const record = await done(transaction.objectStore('snapshots').get(key)) as SnapshotRecord | undefined
      if (!record) return undefined
      const style = await done(transaction.objectStore('styles').get(record.style)) as { css: string } | undefined
      if (!style) return undefined
      const { style: _style, ...snapshot } = record
      return { ...snapshot, css: style.css }
    },
    /** Stores a capture under `key`, replacing the previous one. */
    async put(key: string, capture: FrameSnapshotCapture, size: FrameSnapshotSize = {}): Promise<void> {
      const db = await open()
      const { css, ...markup } = capture
      const hash = hashText(css)
      const transaction = db.transaction(['snapshots', 'styles'], 'readwrite')
      const styles = transaction.objectStore('styles')
      // Cells of a project mostly share one stylesheet text: store it once.
      if (!await done(styles.getKey(hash))) styles.put({ hash, css })
      transaction.objectStore('snapshots').put({ ...markup, ...size, key, style: hash, at: Date.now() } satisfies SnapshotRecord)
      await committed(transaction)
      await prune(db)
    },
    /** Record counts, for diagnostics. */
    async stats(): Promise<{ snapshots: number, styles: number }> {
      const db = await open()
      const transaction = db.transaction(['snapshots', 'styles'], 'readonly')
      return {
        snapshots: await done(transaction.objectStore('snapshots').count()),
        styles: await done(transaction.objectStore('styles').count()),
      }
    },
  }
}
