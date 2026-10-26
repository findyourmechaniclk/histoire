import type { HistoireSettings } from '@histoire/protocol'
import type { SerializedStoryData } from '../../build-serialize.js'
import type { NodeArtifact } from '../../deploy/artifact-reader.js'
import type { CatalogSnapshot, CatalogStory } from './types.js'
import { lstat, readFile, realpath } from 'node:fs/promises'
import { join } from 'node:path'
import { normalizeHistoireMatrixHint } from '@histoire/protocol'
import { readNodeArtifact } from '../../deploy/artifact-reader.js'
import { normalizeNodeBase } from '../../deploy/base.js'
import { getBuiltCaptureIdentity, validateBuiltCapture } from './build-metadata.js'
import { immutableMap } from './immutable.js'
import { lookupStory, lookupTarget, validStory } from './lookup.js'
import { projectCatalog } from './projection.js'

/** Private validated inventory stays outside portable snapshots and public DTOs. */
const nodeArtifacts = new WeakMap<object, NodeArtifact>()

/** Bounded immutable public metadata read, without source collection/config evaluation. */
async function readStaticData(publicRoot: string): Promise<SerializedStoryData> {
  const path = join(publicRoot, 'histoire.json')
  const file = await lstat(path)
  if (!file.isFile() || file.size > 32 * 1024 * 1024) throw new Error('Built catalog is not a bounded regular file')
  let data: SerializedStoryData
  try {
    data = JSON.parse(await readFile(path, 'utf8'))
  }
  catch { throw new Error('Built catalog is malformed') }
  if (!data || !Array.isArray(data.stories) || data.stories.length > 100000) throw new Error('Built catalog is malformed')
  return data
}

/** Determines artifact layout only; invalid Node manifests never fall back to static mode. */
async function isNodeOutput(root: string): Promise<boolean> {
  try {
    await lstat(join(root, 'private', 'manifest.json'))
    return true
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    return false
  }
}

/** Reads exact immutable capture targets/settings from copied static or Node output. */
export async function readBuiltPreviewSnapshot(directory: string) {
  const outputRoot = await realpath(directory)
  const node = await isNodeOutput(outputRoot) ? await readNodeArtifact(outputRoot) : undefined
  const publicRoot = node?.publicDir ?? outputRoot
  const data = node ? undefined : await readStaticData(publicRoot)
  if (data && data.capture == null) throw new Error('Built output lacks capture metadata; rebuild it with this Histoire version')
  const captureMetadata = data ? validateBuiltCapture(data.capture) : undefined
  if (data && captureMetadata) {
    const { capture, ...catalog } = data
    const { buildId, ...settings } = captureMetadata
    if (await getBuiltCaptureIdentity(publicRoot, catalog, settings) !== buildId) throw new Error('Built capture identity differs from runtime assets/catalog')
  }
  const stories: CatalogStory[] = node
    ? node.manifest.stories.map(record => ({ ...record.story, fileOrigin: record.story.fileOrigin ?? 'project' }))
    : data.stories.map(story => ({
        id: story.id,
        title: story.title,
        treePath: story.treePath ?? [story.title],
        filePath: story.relativePath,
        fileOrigin: story.fileOrigin ?? 'project',
        supportPluginId: story.supportPluginId,
        docsOnly: story.docsOnly === true,
        matrix: normalizeHistoireMatrixHint(story.matrix),
        ...(story.group == null ? {} : { group: story.group }),
        variants: story.variants.map(variant => ({ id: variant.id, title: variant.title })),
        docsAvailable: !!story.markdownFile || story.docsText != null,
        sourceAvailable: !story.docsOnly,
        sourceKind: story.virtual ? 'virtual' : 'file',
      }))
  if (stories.some(story => !validStory(story))) throw new Error('Built catalog contains invalid target metadata')
  for (const story of stories) {
    for (const variant of story.variants) Object.freeze(variant)
    Object.freeze(story.variants)
    Object.freeze(story.treePath)
    Object.freeze(story)
  }
  // Node manifests and static capture metadata share the same identity/settings fields.
  const recorded = node?.manifest ?? captureMetadata!
  const { buildId, base } = recorded
  const catalog = projectCatalog(stories, node?.manifest.diagnostics ?? [])
  const defaults: Pick<HistoireSettings, 'colorScheme' | 'backgroundColor' | 'textDirection' | 'globals'> = Object.freeze({ colorScheme: recorded.defaultColorScheme, backgroundColor: recorded.backgroundColor, textDirection: recorded.textDirection, globals: Object.freeze({ ...recorded.globals }) })
  const snapshot: CatalogSnapshot = Object.freeze({ projectId: buildId, epoch: buildId, revision: buildId, stories: Object.freeze(stories), catalog, diagnostics: Object.freeze(node?.manifest.diagnostics ?? []), diagnosticsTruncated: node?.manifest.diagnosticsTruncated ?? false, failed: false, outcome: 'success', contents: immutableMap(new Map()), fingerprint: buildId })
  const built = Object.freeze({
    outputRoot,
    publicRoot,
    mode: node ? 'node' as const : 'static' as const,
    base: normalizeNodeBase(base),
    buildId,
    defaults,
    catalog,
    /** Exact immutable story authority independent of live project files. */
    getStory(storyId: string) { return lookupStory(snapshot, storyId) },
    /** Exact scoped variant lookup never silently chooses duplicates. */
    getTarget(storyId: string, variantId: string) { return lookupTarget(snapshot, storyId, variantId) },
  })
  if (node) nodeArtifacts.set(built, node)
  return built
}

/** Validated immutable output target authority consumed by owned preview host. */
export type BuiltPreviewSnapshot = Awaited<ReturnType<typeof readBuiltPreviewSnapshot>>

/** First-party HTTP adapter reuses exact captured artifact without rereading private metadata. */
export function getBuiltNodeArtifact(snapshot: BuiltPreviewSnapshot): NodeArtifact | undefined {
  return nodeArtifacts.get(snapshot)
}
