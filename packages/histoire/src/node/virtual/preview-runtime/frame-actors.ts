/**
 * Emits the frame actor registry: one slot per mounted variant renderer
 * (`PreviewFrameActor`), holding its current actor generation.
 *
 * An actor is one rendered mount as frame plugins see it, identified by a
 * fresh `actorId`. It starts `pending`, attaches once when the app reports real
 * readiness (`markVariantReady`), and detaches on selection change, HMR story
 * change, page hide or renderer unmount. A detached slot that stays mounted
 * gets a new pending actor, so a later attach never reuses a retired id.
 *
 * Exposes `createFrameActorSlot`, `disposeFrameActorSlot`, `attachFrameActors`,
 * `detachFrameActors` and `handleFrameStoryChanged` to later sections.
 */
export function previewFrameActors() {
  return `/** Slots of mounted variant renderers; the legacy grid sandbox never creates one. */
const frameActorSlots = new Set()

/** Unique id of one rendered mount. */
function createFrameActorId() {
  return globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
}

/** New actor generation: pending until attached, then attached, then detached for good. */
function createFrameActor() {
  return { id: createFrameActorId(), status: 'pending', attachments: [] }
}

/**
 * Registers the renderer wrapper of one rendered variant.
 * @param getTarget Returns the wrapper's current \`{ storyId, variantId }\`.
 * @param getElement Returns the rendered variant root element.
 */
function createFrameActorSlot(getTarget, getElement) {
  const slot = { getTarget, getElement, actor: createFrameActor(), scope: null }
  frameActorSlots.add(slot)
  return slot
}

/** Renderer unmount: detach for good, before the framework tears the variant down. */
function disposeFrameActorSlot(slot) {
  frameActorSlots.delete(slot)
  stopFrameActor(slot.actor)
}

/**
 * Attaches the pending actors rendering \`target\`; called once readiness is real.
 * Re-acknowledged readiness of an attached actor is a no-op.
 * @param state Readonly state source \`{ get, watch }\` of the ready variant.
 */
function attachFrameActors(target, state) {
  if (!framePluginsEnabled) return
  for (const slot of frameActorSlots) {
    const slotTarget = slot.getTarget()
    if (slotTarget.storyId !== target.storyId || slotTarget.variantId !== target.variantId) continue
    slot.scope = { target, state }
    void startFrameActor(slot, slot.actor)
  }
}

/** Loads plugins, then attaches each one unless the actor was retired meanwhile. */
async function startFrameActor(slot, actor) {
  if (actor.status !== 'pending') return
  actor.status = 'attaching'
  const plugins = await loadFramePlugins({ actorId: actor.id, target: slot.scope.target })
  if (actor.status !== 'attaching' || slot.actor !== actor) return
  actor.status = 'attached'
  const scope = { ...slot.scope, element: slot.getElement() }
  for (const plugin of plugins) actor.attachments.push(startFramePluginAttachment(plugin, actor, scope))
}

/**
 * Retires an actor: plugins detach in reverse attach order.
 * @returns Whether the actor had started attaching.
 */
function stopFrameActor(actor) {
  const started = actor.status === 'attaching' || actor.status === 'attached'
  actor.status = 'detached'
  for (const attachment of actor.attachments.splice(0).reverse()) stopFramePluginAttachment(attachment)
  return started
}

/**
 * Detaches the actors of every slot whose target matches, replacing each with a
 * new pending actor.
 * @param predicate Receives the slot's current target.
 * @param options.reattach Start the new actor once the update settled, for
 * renderers that stay mounted without a new readiness signal (HMR).
 */
function detachFrameActors(predicate, { reattach = false } = {}) {
  for (const slot of frameActorSlots) {
    if (!predicate(slot.getTarget())) continue
    const started = stopFrameActor(slot.actor)
    const next = createFrameActor()
    slot.actor = next
    if (reattach && started) void reattachFrameActorAfterUpdate(slot, next)
  }
}

/** Waits like readiness does (two ticks and a frame) before re-attaching a still-mounted renderer. */
async function reattachFrameActorAfterUpdate(slot, actor) {
  await nextTick()
  await nextTick()
  await new Promise(resolve => requestAnimationFrame(resolve))
  // A selection change, unmount or newer update replaced this generation meanwhile.
  if (!frameActorSlots.has(slot) || slot.actor !== actor || !slot.scope) return
  const target = slot.getTarget()
  if (target.storyId !== slot.scope.target.storyId || target.variantId !== slot.scope.target.variantId) return
  void startFrameActor(slot, actor)
}

/** HMR \`STORY_CHANGED_EVENT\`: actors of the changed story detach, then re-attach as new actors. */
function handleFrameStoryChanged(storyId) {
  detachFrameActors(target => target.storyId === storyId, { reattach: true })
}`
}
