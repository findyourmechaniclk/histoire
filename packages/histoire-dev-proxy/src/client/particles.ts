import { bookMark } from './mark.js'

/** One GPU draw call animates bounded samples of canonical logo silhouette. */
const vertexShader = `#version 300 es
in vec3 position;
in vec3 tint;
uniform vec2 viewport;
uniform float time;
uniform vec2 pointer;
out vec3 color;
out float opacity;
void main(){
  vec2 point=position.xy;
  float distanceToPointer=length(point-pointer);
  float ripple=sin(distanceToPointer*16.-time*1.8)*exp(-distanceToPointer*2.5)*.018;
  point+=normalize(point-pointer+vec2(.001))*ripple;
  point.y+=sin(point.x*5.+time*.45+position.z*4.)*.016;
  float size=min(viewport.x,viewport.y)*.84;
  vec2 screen=point*size;
  screen+=pointer*vec2(6.,4.);
  gl_Position=vec4(screen/viewport*2.,0.,1.);
  gl_PointSize=clamp(size/185.,1.2,3.8);
  color=tint;
  float clearing=smoothstep(.12,.3,length(point*vec2(1.,2.)));
  opacity=(.2+.35*position.z)*clearing;
}`
/** Soft circular particles keep logo field quiet behind readable wordmark. */
const fragmentShader = `#version 300 es
precision mediump float;
in vec3 color;
in float opacity;
out vec4 outputColor;
void main(){
  float circle=1.-smoothstep(.25,.5,length(gl_PointCoord-.5));
  outputColor=vec4(color,circle*opacity);
}`

/** Sample existing vector geometry once; no animation-time CPU particle simulation. */
async function sampleBook(): Promise<Float32Array> {
  const image = new Image()
  const url = URL.createObjectURL(new Blob([bookMark.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" ')], { type: 'image/svg+xml' }))
  try {
    image.src = url
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 512
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0, 512, 512)
    const { data } = context.getImageData(0, 0, 512, 512)
    const points: number[] = []
    for (let y = 0; y < 512; y += 5) {
      for (let x = 0; x < 512; x += 5) {
        const offset = (y * 512 + x) * 4
        if (data[offset + 3] < 40) continue
        const depth = ((x * 73 + y * 37) % 101) / 100
        points.push(x / 512 - 0.5, 0.5 - y / 512, depth, data[offset] / 255, data[offset + 1] / 255, data[offset + 2] / 255)
      }
    }
    return new Float32Array(points)
  }
  finally {
    URL.revokeObjectURL(url)
  }
}

/** GPU failures always leave static HTML logo/status usable. */
async function mountParticles(canvas: HTMLCanvasElement) {
  const motion = matchMedia('(prefers-reduced-motion: reduce)')
  if (motion.matches) return
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: false, powerPreference: 'low-power', failIfMajorPerformanceCaveat: true })
  if (!gl) return
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  if (info && /swiftshader|llvmpipe|softpipe|software/i.test(gl.getParameter(info.UNMASKED_RENDERER_WEBGL))) return
  const shaders: WebGLShader[] = []
  let program: WebGLProgram | null = null
  let buffer: WebGLBuffer | null = null
  let frame = 0
  let disposed = false
  let elapsed = 0
  let previous = 0
  let width = 1
  let height = 1
  let pointerX = 0
  let pointerY = 0
  /** Release exact GPU/DOM resources after navigation, motion change or context loss. */
  function dispose() {
    if (disposed) return
    disposed = true
    cancelAnimationFrame(frame)
    document.removeEventListener('visibilitychange', visibility)
    window.removeEventListener('resize', resize)
    window.removeEventListener('pointermove', pointer)
    motion.removeEventListener('change', dispose)
    window.removeEventListener('pagehide', dispose)
    canvas.removeEventListener('webglcontextlost', lost)
    if (buffer) gl!.deleteBuffer(buffer)
    if (program) gl!.deleteProgram(program)
    for (const shader of shaders) gl!.deleteShader(shader)
    canvas.hidden = true
  }
  /** Context loss retires scene instead of running a recovery loop during startup. */
  function lost(event: Event) {
    event.preventDefault()
    dispose()
  }
  /** Bound resolution independently of high-DPI monitors. */
  function resize() {
    const ratio = Math.min(devicePixelRatio || 1, 1.5)
    width = canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio))
    height = canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio))
    gl!.viewport(0, 0, width, height)
  }
  /** Store input once; GPU evaluates restrained displacement per point. */
  function pointer(event: PointerEvent) {
    const side = Math.min(innerWidth, innerHeight) * 0.84
    pointerX = (event.clientX - innerWidth / 2) / side
    pointerY = (innerHeight / 2 - event.clientY) / side
  }
  /** Hidden documents never schedule animation frames. */
  function visibility() {
    cancelAnimationFrame(frame)
    previous = 0
    if (!document.hidden && !disposed) frame = requestAnimationFrame(draw)
  }
  let count = 0
  /** Only uniform updates and one draw call occur per frame. */
  function draw(now: number) {
    if (disposed || document.hidden) return
    if (previous) elapsed += Math.min(now - previous, 50) / 1000
    previous = now
    gl!.clear(gl!.COLOR_BUFFER_BIT)
    gl!.uniform2f(gl!.getUniformLocation(program!, 'viewport'), width, height)
    gl!.uniform1f(gl!.getUniformLocation(program!, 'time'), elapsed)
    gl!.uniform2f(gl!.getUniformLocation(program!, 'pointer'), pointerX, pointerY)
    gl!.drawArrays(gl!.POINTS, 0, count)
    frame = requestAnimationFrame(draw)
  }
  canvas.addEventListener('webglcontextlost', lost)
  window.addEventListener('pagehide', dispose, { once: true })
  motion.addEventListener('change', dispose)
  try {
    const points = await sampleBook()
    if (disposed) return
    count = points.length / 6
    program = gl.createProgram()!
    for (const [type, source] of [[gl.VERTEX_SHADER, vertexShader], [gl.FRAGMENT_SHADER, fragmentShader]] as const) {
      const shader = gl.createShader(type)!
      shaders.push(shader)
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Particle shader unavailable')
      gl.attachShader(program, shader)
    }
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Particle program unavailable')
    gl.useProgram(program)
    buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW)
    for (const [attribute, offset] of [['position', 0], ['tint', 12]] as const) {
      const location = gl.getAttribLocation(program, attribute)
      gl.enableVertexAttribArray(location)
      gl.vertexAttribPointer(location, 3, gl.FLOAT, false, 24, offset)
    }
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
    gl.clearColor(0, 0, 0, 0)
    resize()
    document.addEventListener('visibilitychange', visibility)
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', pointer, { passive: true })
    visibility()
  }
  catch {
    dispose()
  }
}
const canvas = document.querySelector<HTMLCanvasElement>('body[data-histoire-loading] canvas')
if (canvas) void mountParticles(canvas)
