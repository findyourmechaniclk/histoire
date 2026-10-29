/** Standalone document exception: must render before project CSS or Vue exists. */
export const startupStyles = `
:root {
  color-scheme: light dark;
  --background: #fafafa;
  --text: #18231f;
  --muted: #63716b;
  --glow: #34d39918;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  background: var(--background);
  color: var(--text);
  font-family: Inter, ui-sans-serif, system-ui, sans-serif;
}
main {
  position: relative;
  display: grid;
  place-content: center;
  justify-items: center;
  min-height: 100svh;
  overflow: hidden;
  padding: 32px;
  text-align: center;
}
main::before {
  content: "";
  position: absolute;
  width: min(80vw, 700px);
  height: min(80vw, 700px);
  border-radius: 50%;
  background: radial-gradient(var(--glow), transparent 65%);
  pointer-events: none;
}
canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}
.identity {
  position: relative;
  display: flex;
  align-items: center;
  gap: 14px;
}
.identity svg { width: 52px; height: 52px; }
.identity h1 {
  margin: 0;
  font-size: 38px;
  font-weight: 600;
  letter-spacing: -1.5px;
}
#status {
  position: relative;
  margin: 26px 0 0;
  font-size: 14px;
  color: var(--muted);
  line-height: 1.5;
}
#detail {
  position: relative;
  max-width: 480px;
  margin: 12px 0 0;
  font-size: 13px;
  line-height: 1.6;
  color: var(--muted);
  overflow-wrap: anywhere;
}
@media (prefers-color-scheme: dark) {
  :root {
    --background: #0c100e;
    --text: #eaf4ef;
    --muted: #95a69d;
    --glow: #34d39912;
  }
}
@media (max-width: 480px) {
  .identity h1 { font-size: 32px; }
  .identity svg { width: 44px; height: 44px; }
}
`
