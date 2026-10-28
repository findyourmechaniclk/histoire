/** Sensitive values must never be copied into detached reports. */
export const reportSecret = 'bearer-secret-value'
/** Real-shaped source and runtime owner. */
export const reportOwner = { sourceId: `source-${reportSecret}`, epoch: 'epoch', revision: 'revision', runtimeId: 'runtime', target: { storyId: 'story', variantId: 'one' } }
/** Shared captured result metadata. */
export const reportMetadata = { mode: 'live', owner: reportOwner, observedAt: '2026-01-01T00:00:00.000Z', durationMs: 1, truncated: false }
/** Valid result with sensitive state and malicious markup. */
export const reportVariant = { ...reportMetadata, inspection: 'variant', state: { token: reportSecret, markup: '<script>alert(1)</script>' }, components: [], propsAvailable: false, omittedValues: 0 }
/** Valid result with sensitive DOM content and malicious markup. */
export const reportDom = { ...reportMetadata, inspection: 'dom', matched: true, nodes: [{ index: 0, parentIndex: null, tag: 'button', attributes: { title: reportSecret }, text: `<img src=x onerror=alert(1)>${reportSecret}`, rect: { x: 0, y: 0, width: 20, height: 10 }, styles: {} }] }
