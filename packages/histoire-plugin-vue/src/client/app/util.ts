import { applyState } from '@histoire/shared'
import {
  isRef as _isRef,
  unref as _unref,
  watch as _watch,
} from '@histoire/vendors/vue'
import { isRef, unref, watch } from 'vue'

const isObject = val => val !== null && typeof val === 'object'

/**
 * Using external/user Vue
 */
export function toRawDeep(val, seen = new WeakMap()) {
  const unwrappedValue = isRef(val) ? unref(val) : val

  if (typeof unwrappedValue === 'symbol') {
    return unwrappedValue.toString()
  }

  if (!isObject(unwrappedValue)) {
    return unwrappedValue
  }

  if (seen.has(unwrappedValue)) {
    return seen.get(unwrappedValue)
  }

  if (Array.isArray(unwrappedValue)) {
    const result = []
    seen.set(unwrappedValue, result)
    result.push(...unwrappedValue.map(value => toRawDeep(value, seen)))
    return result
  }
  else {
    const result = {}
    seen.set(unwrappedValue, result)
    toRawObject(unwrappedValue, result, seen)
    return result
  }
}

function toRawObject(obj: Record<any, any>, target: Record<any, any>, seen = new WeakMap()) {
  Object.keys(obj).forEach((key) => {
    target[key] = toRawDeep(obj[key], seen)
  })
}

/**
 * Using bundled Vue
 */
export function _toRawDeep(val, seen = new WeakMap()) {
  const unwrappedValue = _isRef(val) ? _unref(val) : val

  if (typeof unwrappedValue === 'symbol') {
    return unwrappedValue.toString()
  }

  if (!isObject(unwrappedValue)) {
    return unwrappedValue
  }

  if (seen.has(unwrappedValue)) {
    return seen.get(unwrappedValue)
  }

  if (Array.isArray(unwrappedValue)) {
    const result = []
    seen.set(unwrappedValue, result)
    result.push(...unwrappedValue.map(value => _toRawDeep(value, seen)))
    return result
  }
  else {
    const result = {}
    seen.set(unwrappedValue, result)
    _toRawObject(unwrappedValue, result, seen)
    return result
  }
}

function _toRawObject(obj: Record<any, any>, target: Record<any, any>, seen = new WeakMap()) {
  Object.keys(obj).forEach((key) => {
    target[key] = _toRawDeep(obj[key], seen)
  })
}

/** Plain data object (or a reactive proxy of one): safe to merge serialized state into. */
function isPlainObject(value: unknown): value is Record<string, any> {
  if (!isObject(value) || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/**
 * Applies a serialized state snapshot to a story's own `<script setup>` /
 * `data` bindings. Unlike `applyState`, bindings may hold objects the story
 * only references (module singletons, mocked exports, stores): serialization
 * turned their Dates, Maps or class instances into plain copies, so those
 * values are never overwritten. Plain objects are merged recursively, equal
 * values are skipped and read-only properties are left as they are.
 * @param target Bindings to update, e.g. the Vue story's implicit state
 * @param state Serialized snapshot, e.g. from the controls panel
 */
export function applyStateToBindings(target: Record<string, any>, state: Record<string, any>) {
  for (const key in state) {
    const current = target[key]
    const value = state[key]
    if (Object.is(current, value)) continue
    if (isObject(current) && !Array.isArray(current) && !isPlainObject(current)) continue
    if (isPlainObject(current) && isPlainObject(value)) {
      applyStateToBindings(current, value)
      continue
    }
    try {
      target[key] = value
    }
    catch {
      // Getter-only or readonly (e.g. computed) binding
    }
  }
}

/**
 * Synchronize states between the bundled and external/user versions of Vue
 * @param bundledState Reactive state created with the bundled Vue
 * @param externalState Reactive state created with the external/user Vue
 * @param applyExternal Applies bundled snapshots to `externalState`
 */
export function syncStateBundledAndExternal(bundledState, externalState, applyExternal: (target: any, state: any) => void = applyState) {
  let syncing = false

  const _stop = _watch(() => bundledState, (value) => {
    if (value == null) return
    if (!syncing) {
      syncing = true
      applyExternal(externalState, _toRawDeep(value))
    }
    else {
      syncing = false
    }
  }, {
    deep: true,
    immediate: true,
  })

  const stop = watch(() => externalState, (value) => {
    if (value == null) return
    if (!syncing) {
      syncing = true
      applyState(bundledState, toRawDeep(value))
    }
    else {
      syncing = false
    }
  }, {
    deep: true,
    immediate: true,
  })

  return {
    stop() {
      _stop()
      stop()
    },
  }
}
