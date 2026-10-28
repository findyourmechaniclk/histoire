import type { MaybeRefOrGetter, Ref } from 'vue'
import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

/** Track keyboard input separately from focus, which pointer handlers can retain programmatically. */
export function useKeyboardInput(ownerDocument: MaybeRefOrGetter<Document | undefined>): Ref<boolean> {
  const keyboardInput = ref(false)
  useEventListener(ownerDocument, 'keydown', () => keyboardInput.value = true, { capture: true })
  useEventListener(ownerDocument, 'pointerdown', () => keyboardInput.value = false, { capture: true })
  return keyboardInput
}
