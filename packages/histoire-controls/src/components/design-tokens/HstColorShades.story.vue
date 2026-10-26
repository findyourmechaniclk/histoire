<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import { defaultColors as colors } from '../../../../histoire/src/node/colors'
import HstColorShades from './HstColorShades.vue'
</script>

<template>
  <Story
    title="HstColorShades"
    group="design-system"
    responsive-disabled
  >
    <Variant title="default">
      <HstColorShades
        v-for="(shades, key) of colors"
        :key="key"
        :shades="shades"
        :get-name="shade => `${key}-${shade}`"
      />
    </Variant>

    <Variant title="background">
      <HstColorShades
        v-for="(shades, key) of colors"
        :key="key"
        :shades="shades"
        :get-name="shade => `${key}-${shade}`"
      >
        <template #default="{ color }">
          <div
            class="htw:rounded htw:h-[100px]"
            :style="{
              backgroundColor: color,
            } as CSSProperties"
          />
        </template>
      </HstColorShades>
    </Variant>

    <Variant title="text">
      <HstColorShades
        v-for="(shades, key) of colors"
        :key="key"
        :shades="shades"
        :get-name="shade => `${key}-${shade}`"
      >
        <template #default="{ color }">
          <div
            class="htw:rounded htw:h-[100px] htw:text-5xl htw:flex htw:items-end"
            :style="{
              color,
            } as CSSProperties"
          >
            Aa
          </div>
        </template>
      </HstColorShades>
    </Variant>

    <Variant title="border">
      <HstColorShades
        v-for="(shades, key) of colors"
        :key="key"
        :shades="shades"
        :get-name="shade => `${key}-${shade}`"
      >
        <template #default="{ color }">
          <div
            class="htw:rounded htw:h-[100px] htw:border-solid htw:border-2"
            :style="{
              borderColor: color,
            } as CSSProperties"
          />
        </template>
      </HstColorShades>
    </Variant>

    <Variant
      title="with search"
      :init-state="() => ({
        search: '',
      })"
    >
      <template #default="{ state }">
        <HstColorShades
          v-for="(shades, key) of colors"
          :key="key"
          :shades="shades"
          :get-name="shade => `${key}-${shade}`"
          :search="state.search"
        />
      </template>

      <template #controls="{ state }">
        <HstText
          v-model="state.search"
          title="Filter colors..."
        />
      </template>
    </Variant>

    <Variant title="long names">
      <HstColorShades
        v-for="(shades, key) of colors"
        :key="key"
        :shades="shades"
        :get-name="shade => `${'\'very-'.repeat(5)}long-${key}-${shade}`"
      />
    </Variant>
  </Story>
</template>
