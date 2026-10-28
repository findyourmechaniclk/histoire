import { attachDevframe } from '@histoire/devframe/client'
import { createHistoireSession } from '@histoire/sdk'
import { getDevframeRpcClient } from 'devframe/client'

const status = document.querySelector('#status')
let session
let connection
let attachment

/** Release the example's own attachment, connection and session. */
async function close() {
  try {
    await attachment?.dispose()
  }
  finally {
    connection?.close()
    await session?.dispose()
  }
}

/** Connect the existing mounted counter to the local authenticated bridge. */
async function start() {
  const response = await fetch('/demo/config', { cache: 'no-store' })
  if (!response.ok) throw new Error('Could not get local connection settings')
  const config = await response.json()
  session = createHistoireSession({ url: config.bookUrl })
  await session.connect()
  await session.selection.select({ storyId: 'devframe-example', variantId: 'counter' })
  const mount = session.mount(document.querySelector('#story'), { surface: 'preview' })
  await mount.ready
  connection = await getDevframeRpcClient({
    baseURL: `${location.origin}/devframe/`,
    authToken: config.browserToken,
    webmcp: false,
    simpleAuth: false,
    otpParam: false,
    callTimeout: 3000,
  })
  await connection.ensureTrusted()
  attachment = await attachDevframe({
    session,
    connection,
    grant: config.grant,
    projectId: 'vue3-example',
    scopes: config.scopes,
  })
  status.textContent = 'Connected. Change the counter, then inspect it through MCP.'
}

start().catch((error) => {
  status.textContent = `Connection failed: ${error.message}`
  void close().catch(() => {})
})

window.addEventListener('pagehide', () => void close().catch(() => {}))
