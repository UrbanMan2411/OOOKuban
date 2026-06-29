// Shared auth gate for all API endpoints. A single shared password (env
// COCKPIT_PASSWORD) protects the dashboard. The cookie holds sha256(password),
// never the password itself. Files starting with "_" are not routed by Vercel.
import { createHash, timingSafeEqual } from 'node:crypto'

const tokenFor = (pw) => createHash('sha256').update('cockpit::' + pw).digest('hex')

export function authToken() {
  const pw = process.env.COCKPIT_PASSWORD || ''
  return pw ? tokenFor(pw) : ''
}

export function verifyPassword(pw) {
  if (!pw || !process.env.COCKPIT_PASSWORD) return false
  return tokenFor(pw) === authToken()
}

export function authRequired() {
  return !!process.env.COCKPIT_PASSWORD
}

export function isAuthed(req) {
  const pw = process.env.COCKPIT_PASSWORD
  if (!pw) return true // not configured → open (avoids lockout before env is set)
  const want = tokenFor(pw)
  const cookie = req.headers.cookie || ''
  const m = cookie.match(/(?:^|;\s*)cockpit_auth=([a-f0-9]{64})/)
  if (!m) return false
  try {
    const a = Buffer.from(m[1], 'utf8'), b = Buffer.from(want, 'utf8')
    return a.length === b.length && timingSafeEqual(a, b)
  } catch { return false }
}

// Use at the top of a handler: `if (guard(req, res)) return`
export function guard(req, res) {
  if (isAuthed(req)) return false
  res.status(401).json({ error: 'unauthorized', message: 'Требуется вход.' })
  return true
}
