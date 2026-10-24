<script setup>
import { useQuasar } from 'quasar'
import { useCounterStore } from '../stores/counter'

defineProps({
  name: { type: String, required: true },
})

const $q = useQuasar()
const counter = useCounterStore()

/** Increment the store and show a Quasar notification. */
function onClick() {
  counter.count++
  $q.notify({ message: `Clicked ${counter.count} times` })
}

/** Open a dialog from the Dialog plugin added by the App Extension. */
function onInfo() {
  $q.dialog({ title: 'Info', message: 'Dialog plugin from an App Extension' })
}
</script>

<template>
  <q-card class="q-pa-md">
    <q-card-section>
      <div class="text-h6">
        {{ name }}
      </div>
      <div
        class="greeting"
        data-testid="greeting"
      >
        {{ $greeting }}
      </div>
      <div data-testid="extension-message">
        {{ $extensionMessage }}
      </div>
    </q-card-section>
    <q-card-actions>
      <q-btn
        color="primary"
        icon="add"
        :label="`Count: ${counter.count}`"
        data-testid="count"
        @click="onClick"
      />
      <q-btn
        flat
        label="Info"
        data-testid="info"
        @click="onInfo"
      />
    </q-card-actions>
  </q-card>
</template>
