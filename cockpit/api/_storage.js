// Storage abstraction. In the cloud it delegates to Vercel Blob (unchanged
// behaviour); when self-hosted it stores files on local disk under STORAGE_DIR
// and serves them at PUBLIC_BASE + "/_storage/<pathname>".
//
// Self-host mode is active when STORAGE_DIR is set and there is no Vercel Blob
// token. Handlers should import { list, put, del, copy, getBytes, storageReady }
// from here instead of from '@vercel/blob'.
import { promises as fs } from 'node:fs'
import path from 'node:path'

const DIR = process.env.STORAGE_DIR || ''
const HAS_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN
const SELF = !!DIR && !HAS_BLOB
const PUBLIC_BASE = (process.env.PUBLIC_BASE || '').replace(/\/+$/, '')
export const STORAGE_PREFIX = '/_storage/'

export const storageReady = () => SELF || HAS_BLOB
export const isSelfHost = () => SELF

const rnd = () => Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6)

const withSuffix = (pathname, addRandomSuffix) => {
  if (!addRandomSuffix) return pathname
  const ext = path.extname(pathname)
  return pathname.slice(0, pathname.length - ext.length) + '-' + rnd() + ext
}

const safe = (pathname) => {
  const clean = String(pathname || '').replace(/^\/+/, '')
  if (clean.includes('..')) throw new Error('bad path')
  return clean
}

const urlFor = (pathname) => `${PUBLIC_BASE}${STORAGE_PREFIX}${pathname}`

// Derive a storage pathname from either a full self-host URL or a bare pathname.
export function urlToPathname(urlOrPath) {
  let s = String(urlOrPath || '')
  const i = s.indexOf(STORAGE_PREFIX)
  if (i >= 0) s = s.slice(i + STORAGE_PREFIX.length)
  try { s = decodeURIComponent(s) } catch { /* keep */ }
  return s.replace(/^\/+/, '')
}

async function blob() { return await import('@vercel/blob') } // cloud only

// Is this URL one of ours (safe to mutate)? Cloud → the Vercel Blob host;
// self-host → any URL pointing at our /_storage/ path.
export function isOwnUrl(url) {
  const s = String(url || '')
  if (SELF) return s.includes(STORAGE_PREFIX)
  return /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\//.test(s)
}

// ── list ──
export async function list(opts = {}) {
  if (!SELF) return (await blob()).list(opts)
  const prefix = opts.prefix || ''
  const blobs = []
  async function walk(rel) {
    const abs = path.join(DIR, rel)
    let entries
    try { entries = await fs.readdir(abs, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const childRel = rel ? `${rel}/${e.name}` : e.name
      if (e.isDirectory()) { await walk(childRel); continue }
      if (prefix && !childRel.startsWith(prefix)) continue
      const st = await fs.stat(path.join(DIR, childRel))
      blobs.push({ url: urlFor(childRel), pathname: childRel, size: st.size, uploadedAt: st.mtime.toISOString() })
    }
  }
  await walk('')
  return { blobs }
}

// ── put ──
export async function put(pathname, data, opts = {}) {
  if (!SELF) return (await blob()).put(pathname, data, opts)
  const rel = withSuffix(safe(pathname), opts.addRandomSuffix)
  const abs = path.join(DIR, rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  const buf = typeof data === 'string' ? Buffer.from(data) : Buffer.from(data)
  await fs.writeFile(abs, buf)
  return { url: urlFor(rel), pathname: rel, contentType: opts.contentType || 'application/octet-stream', size: buf.length }
}

// ── del ──
export async function del(urlOrPath) {
  if (!SELF) return (await blob()).del(urlOrPath)
  const list2 = Array.isArray(urlOrPath) ? urlOrPath : [urlOrPath]
  for (const u of list2) {
    const rel = urlToPathname(u)
    if (!rel || rel.includes('..')) continue
    try { await fs.unlink(path.join(DIR, rel)) } catch { /* already gone */ }
  }
}

// ── copy ──
export async function copy(fromUrl, toPathname, opts = {}) {
  if (!SELF) return (await blob()).copy(fromUrl, toPathname, opts)
  const fromRel = urlToPathname(fromUrl)
  const rel = withSuffix(safe(toPathname), opts.addRandomSuffix)
  const abs = path.join(DIR, rel)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.copyFile(path.join(DIR, fromRel), abs)
  const st = await fs.stat(abs)
  return { url: urlFor(rel), pathname: rel, size: st.size }
}

// ── read a stored object's bytes (used instead of fetch(url) on self-host) ──
export async function getBytes(urlOrPath) {
  if (!SELF) {
    const r = await fetch(urlOrPath, { cache: 'no-store' })
    if (!r.ok) throw new Error('fetch ' + r.status)
    return Buffer.from(await r.arrayBuffer())
  }
  return await fs.readFile(path.join(DIR, urlToPathname(urlOrPath)))
}

export async function getJson(urlOrPath) {
  try { return JSON.parse((await getBytes(urlOrPath)).toString('utf8')) } catch { return null }
}
