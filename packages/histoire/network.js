import { logEvent } from '@histoire/app'
import { createNetworkMock } from './dist/client/network.js'

// Own entry: only stories that mock the network load msw.
export const { mockNetwork, mockNetworkDefaults } = createNetworkMock(logEvent)
