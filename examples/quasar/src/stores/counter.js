import { defineStore } from 'pinia'

/** Counter shared by stories to prove the project store is installed. */
export const useCounterStore = defineStore('counter', {
  state: () => ({ count: 0 }),
})
