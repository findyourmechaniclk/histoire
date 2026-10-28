export { mountDevframeHost } from '../host/index.js'
export type { DevframeHost, DevframeHostOptions } from '../host/index.js'
/** Node entry defines optional factories; importing starts no listeners. */
export { createDevframeBridge } from './devframe.js'
export type { DevframeBridgeOptions } from './devframe.js'

export { createMcpEndpoint } from './mcp.js'
export type { Authorization, Exposure, LiveAttachment, LiveIdentity, LivePeer } from './types.js'
