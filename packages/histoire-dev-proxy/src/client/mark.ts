/** Back sheet geometry from repository logo.svg. */
const back = '<rect width="314.30923" height="406.60901" x="-26.565063" y="134.75079" transform="rotate(-23.821262)" rx="8"/>'
/** Front sheet geometry from repository logo.svg. */
const front = '<rect width="314.30923" height="406.60901" x="77.571838" y="72.808708" transform="rotate(-4.5744534)" rx="8"/>'
/** Zap as one outline: the logo's two triangles share their diagonal edge, so their union is this hexagon. */
const zap = '<path d="M152.59788 156.05591 191.25804 335.47786 273.64124 273.06608 359.38947 355.95134 320.72935 176.52942 238.34613 238.94118Z"/>'

/** Wireframe logo drawn by the startup screen; strokes and motion come from startup styles. */
export const blueprintMark = `<svg class="mark" viewBox="0 0 512 512" aria-hidden="true" focusable="false"><g opacity=".5">${back}</g>${front}${zap}</svg>`
