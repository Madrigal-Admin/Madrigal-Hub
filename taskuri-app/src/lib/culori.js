// Variantă mai închisă a unei culori, ca textul să se citească pe fundal deschis.
export function culoareText(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return '#475569'
  const n = parseInt(m[1], 16)
  const f = (v) => Math.round(v * 0.72).toString(16).padStart(2, '0')
  return `#${f((n >> 16) & 255)}${f((n >> 8) & 255)}${f(n & 255)}`
}
