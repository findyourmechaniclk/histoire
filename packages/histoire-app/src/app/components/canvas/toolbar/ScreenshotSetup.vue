<script setup lang="ts">
import type { ScreenshotBrowserSource, ScreenshotSetupAttempt, ScreenshotSetupReason, ScreenshotSetupStage } from '@histoire/shared'
import type { ScreenshotSetupController } from './use-screenshot-setup.js'
import { HstButton } from '@histoire/controls/vue'
import { serializeScreenshotSetupCommand } from '@histoire/shared'
import { computed, ref } from 'vue'
import PopoverDivider from '../../base/popover/PopoverDivider.vue'
import PopoverTitle from '../../base/popover/PopoverTitle.vue'
import WorkbenchEmptyState from '../../shell/WorkbenchEmptyState.vue'
import WorkbenchLoadingState from '../../shell/WorkbenchLoadingState.vue'

const props = defineProps<{
  /** Toolbar-owned setup controller survives popover relocation. */
  controller: ScreenshotSetupController
}>()
const setup = props.controller
/** Human-readable labels for the finite browser source enum. */
const sourceLabels: Record<ScreenshotBrowserSource, string> = {
  'headless-shell': 'Chromium headless shell',
  'chromium': 'Chromium',
  'chrome': 'Google Chrome',
  'msedge': 'Microsoft Edge',
  'executable': 'Configured browser',
}
/** Fixed next-step details for the finite public setup reason enum. */
const reasonDetails: Record<ScreenshotSetupReason, string> = {
  'driver-missing': 'No screenshot browser driver was found.',
  'driver-invalid': 'The screenshot browser driver could not be used.',
  'browser-missing': 'No supported screenshot browser was found.',
  'driver-version': 'The Playwright version is incompatible with the selected browser source.',
  'system-dependencies': 'The browser needs system libraries. Installing them may require administrator privileges.',
  'permission': 'Browser permissions prevented setup from completing.',
  'unsupported-platform': 'Screenshot browser setup is unavailable on this platform.',
  'startup-failed': 'Browser setup did not pass its checks.',
}
/** First server-ordered repair is the single action shown to the user. */
const firstRepair = computed(() => setup.snapshot.value?.repairs[0])
/** Omit placeholder check labels when no concrete repair command exists. */
const showRepairLabel = computed(() => firstRepair.value && !(firstRepair.value.id === 'check-setup' && !firstRepair.value.command))
/** Keep failed attempts in server order; DTO validation caps this list at four. */
const attempts = computed(() => setup.snapshot.value?.attempts.slice(0, 4) ?? [])
/** Use the first attempt's selected driver once for the complete diagnostic list. */
const selectedDriver = computed(() => {
  const driver = attempts.value[0]?.driver
  if (!driver) return null
  const name = driver.packageName === 'playwright-core' ? 'Playwright Core' : 'Playwright'
  return `${name} ${driver.version}`
})
/** Short diagnosis shown beneath the setup state. */
const detail = computed(() => {
  if (setup.error.value && !setup.error.value.setup) return setup.error.value.message
  const snapshot = setup.snapshot.value
  const reason = snapshot?.reason
  const terminalAttempt = snapshot?.attempts.at(-1)
  if (terminalAttempt?.stage === 'probe') return 'The browser opened, but its neutral screenshot check did not pass.'
  if (reason === 'startup-failed' && !terminalAttempt?.diagnostic) return 'Playwright provided no recognized cause.'
  return reason ? reasonDetails[reason] : 'Check setup to verify a screenshot browser.'
})
/** Loading state for an explicit check or initial metadata read. */
const loading = computed(() => setup.checking.value || setup.reading.value)
/** Name the operation represented by the loading placeholder. */
const loadingTitle = computed(() => setup.checking.value ? 'Checking screenshot setup' : 'Loading screenshot setup')
/** Clipboard success remains visible until another setup action starts. */
const copied = ref(false)
/** Clipboard error is shown without changing setup state. */
const copyError = ref(false)

/** Describe only the bounded operation stage, never infer startup failure from a probe error. */
function stageLabel(stage?: ScreenshotSetupStage): string {
  if (stage === 'discovery') return 'Discovery failed'
  if (stage === 'launch') return 'Launch failed'
  if (stage === 'probe') return 'Neutral check failed after browser opened'
  return 'Stage not reported'
}

/** Render fixed diagnostics without exposing raw errors, paths, or environment values. */
function diagnosticText(attempt: ScreenshotSetupAttempt): string {
  const diagnostic = attempt.diagnostic
  if (!diagnostic) return attempt.reason === 'startup-failed' ? 'Playwright provided no recognized cause.' : reasonDetails[attempt.reason]
  switch (diagnostic.code) {
    case 'process-exited':
      if (diagnostic.signal && diagnostic.exitCode !== undefined) return `Process exited with code ${diagnostic.exitCode} and signal ${diagnostic.signal}.`
      if (diagnostic.signal) return `Process exited with signal ${diagnostic.signal}.`
      if (diagnostic.exitCode !== undefined) return `Process exited with code ${diagnostic.exitCode}.`
      return 'Playwright provided no recognized cause.'
    case 'missing-library':
      return `Missing system library: ${diagnostic.library}.`
    case 'executable-format':
      return 'The browser executable has an unsupported format.'
    case 'sandbox-denied':
      return 'The operating system denied the browser sandbox.'
    case 'invalid-probe-image':
      return 'The neutral screenshot check returned an invalid PNG or unexpected dimensions.'
    case 'protocol-error':
      return 'The browser connection protocol failed.'
    case 'unknown':
      return 'Playwright provided no recognized cause.'
  }
}

/** Render the backend's structured fixed command without splitting or editing tokens. */
function commandText(): string | null {
  const command = firstRepair.value?.command
  if (!command) return null
  return serializeScreenshotSetupCommand(command)
}

/** Copy only the current allowlisted repair command and report clipboard failure. */
async function copyCommand(): Promise<void> {
  copied.value = false
  copyError.value = false
  try {
    const command = commandText()
    if (!command) return
    await navigator.clipboard.writeText(command)
    copied.value = true
    copyError.value = false
  }
  catch {
    copyError.value = true
  }
}

/** Start an explicit check using current discovery metadata. */
function check(): void {
  copied.value = false
  copyError.value = false
  setup.checkSetup()
}

/** Re-discover after external changes, then explicitly check that inventory. */
function checkAgain(): void {
  copied.value = false
  copyError.value = false
  setup.checkAgain()
}
</script>

<template>
  <section class="screenshot-setup htw:pb-2" aria-label="Screenshot setup">
    <PopoverDivider />
    <PopoverTitle compact>
      Screenshot setup
    </PopoverTitle>
    <WorkbenchLoadingState v-if="loading" :title="loadingTitle" />
    <WorkbenchEmptyState v-else-if="!setup.snapshot.value || setup.snapshot.value.state !== 'ready'" icon="camera" :title="setup.snapshot.value?.state === 'unverified' ? 'Setup not checked' : setup.snapshot.value?.state === 'checking' ? 'Setup status needs refresh' : 'Screenshot setup needed'">
      {{ detail }}
      <template #actions>
        <HstButton color="flat" tone="accent" type="button" @click="setup.checked.value ? checkAgain() : check()">
          {{ setup.checked.value ? 'Check again' : 'Check setup' }}
        </HstButton>
        <HstButton v-if="firstRepair?.command" color="flat" tone="accent" type="button" @click="copyCommand">
          Copy command
        </HstButton>
      </template>
    </WorkbenchEmptyState>
    <div v-if="attempts.length && !loading && setup.snapshot.value?.state !== 'ready'" class="htw:m-2 htw:text-muted htw:text-[11px]">
      <p v-if="selectedDriver" class="htw:m-[0_0_6px]">
        Selected driver: <strong class="htw:text-text htw:font-semibold">{{ selectedDriver }}</strong>
      </p>
      <ol class="htw:grid htw:gap-1.5 htw:m-0 htw:[padding-inline-start:18px]" aria-label="Failed browser attempts">
        <li v-for="(attempt, index) in attempts" :key="`${attempt.source}-${index}`">
          <p class="htw:m-0 htw:flex htw:flex-wrap htw:gap-x-2 htw:gap-y-1 htw:text-text">
            <strong>{{ sourceLabels[attempt.source] }}</strong><span class="htw:text-muted">{{ stageLabel(attempt.stage) }}</span>
          </p>
          <p class="htw:m-0">
            {{ diagnosticText(attempt) }}
          </p>
        </li>
      </ol>
    </div>
    <div v-if="!loading && setup.snapshot.value?.state === 'ready'" class="htw:flex htw:items-center htw:justify-between htw:gap-2 htw:p-2 htw:rounded-[7px] htw:bg-chip htw:text-text htw:text-[12px]" role="status">
      <span class="htw:flex htw:items-center htw:gap-2 htw:min-w-0"><strong class="htw:font-bold">Ready</strong><span class="htw:overflow-hidden htw:text-muted htw:text-ellipsis htw:whitespace-nowrap">{{ setup.snapshot.value.source ? sourceLabels[setup.snapshot.value.source] : 'Browser' }}</span></span>
      <HstButton color="flat" type="button" @click="checkAgain">
        Check again
      </HstButton>
    </div>
    <p v-if="setup.error.value && !setup.error.value.setup && setup.snapshot.value?.state === 'ready'" class="htw:my-1 htw:mx-2 htw:text-muted htw:text-[11px] htw:[&[role=alert]]:text-danger" role="alert">
      {{ setup.error.value.message }}
    </p>
    <p v-if="showRepairLabel && !loading" class="htw:my-1 htw:mx-2 htw:text-muted htw:text-[11px]">
      {{ firstRepair.label }}
    </p>
    <p v-if="copied" class="htw:my-1 htw:mx-2 htw:text-muted htw:text-[11px] htw:[&[role=alert]]:text-danger" role="status">
      Command copied
    </p>
    <p v-if="copyError" class="htw:my-1 htw:mx-2 htw:text-muted htw:text-[11px] htw:[&[role=alert]]:text-danger" role="alert">
      Copy unavailable
    </p>
  </section>
</template>
