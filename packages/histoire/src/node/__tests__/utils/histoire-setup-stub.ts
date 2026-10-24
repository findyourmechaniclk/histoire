/**
 * Stands in for the `virtual:$histoire-setup` module (the user setup file)
 * Vite generates at dev/build time, so specs can import the Vue story host.
 * Specs mock it per test. Kept separate from the generated setup stub:
 * `vi.mock` targets the resolved file, so a shared stub would mock both.
 */
export {}
