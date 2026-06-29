// Remove the white/near-white background from a product image so every photo
// blends consistently with the cream PDF background — regardless of whether the
// source was a transparent PNG or a white-baked JPEG.
//
// Method: flood-fill from the image borders, clearing only near-white pixels that
// are CONNECTED to the edge. Interior whites (a white bottle, a white label) are
// preserved because they are walled off by the product's coloured outline.
// Already-transparent images pass through unchanged (idempotent).

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = reject
    im.src = src
  })
}

/**
 * @param {string} dataUrl  data:image/... source
 * @param {object} opts
 *   threshold  – min R,G,B (0-255) to count as "white" background (default 236)
 *   feather    – soften the cut edge to avoid a hard white fringe (default true)
 * @returns {Promise<string>} a PNG data URL with the background removed
 */
export async function removeWhiteBackground(dataUrl, opts = {}) {
  const threshold = opts.threshold ?? 236
  const feather = opts.feather ?? true
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl

  let img
  try {
    img = await loadImage(dataUrl)
  } catch {
    return dataUrl
  }
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  if (!w || !h) return dataUrl

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)

  let id
  try {
    id = ctx.getImageData(0, 0, w, h)
  } catch {
    return dataUrl // tainted canvas — leave as is
  }
  const d = id.data
  const N = w * h

  const isWhite = (i) => d[i] >= threshold && d[i + 1] >= threshold && d[i + 2] >= threshold
  const isBg = (p) => {
    const i = p * 4
    return d[i + 3] === 0 || isWhite(i) // transparent or near-white
  }

  // BFS flood-fill from every border pixel.
  const visited = new Uint8Array(N)
  const queue = new Int32Array(N)
  let qh = 0, qt = 0
  const seed = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const p = y * w + x
    if (visited[p]) return
    visited[p] = 1
    if (isBg(p)) queue[qt++] = p
  }
  for (let x = 0; x < w; x++) { seed(x, 0); seed(x, h - 1) }
  for (let y = 0; y < h; y++) { seed(0, y); seed(w - 1, y) }

  let cleared = 0
  while (qh < qt) {
    const p = queue[qh++]
    d[p * 4 + 3] = 0 // make background transparent
    cleared++
    const x = p % w
    const y = (p - x) / w
    seed(x + 1, y); seed(x - 1, y); seed(x, y + 1); seed(x, y - 1)
  }

  // Safety: if almost everything got cleared the photo was effectively blank /
  // white-on-white — keep the original rather than returning an empty image.
  if (cleared > N * 0.985) return dataUrl
  // If nothing was cleared (no white border at all) skip re-encoding overhead.
  if (cleared === 0) return dataUrl

  // Soften the boundary: fade alpha on opaque near-white pixels that touch a
  // transparent neighbour — kills the thin white halo left by anti-aliasing.
  if (feather) {
    const a = (p) => d[p * 4 + 3]
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = y * w + x
        const i = p * 4
        if (d[i + 3] === 0) continue
        const lum = (d[i] + d[i + 1] + d[i + 2]) / 3
        if (lum < threshold - 24) continue // clearly part of the product
        const edge =
          (x + 1 < w && a(p + 1) === 0) || (x - 1 >= 0 && a(p - 1) === 0) ||
          (y + 1 < h && a(p + w) === 0) || (y - 1 >= 0 && a(p - w) === 0)
        if (edge) {
          // the whiter it is, the more we fade it
          const k = Math.max(0, Math.min(1, (255 - lum) / 24))
          d[i + 3] = Math.round(d[i + 3] * k)
        }
      }
    }
  }

  ctx.putImageData(id, 0, 0)
  return canvas.toDataURL('image/png')
}
