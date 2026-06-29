// GET  /api/auth          → { required, authed }
// POST /api/auth { password } → set cookie on success
// POST /api/auth { logout:true } → clear cookie
import { authToken, authRequired, isAuthed, verifyPassword } from './_auth.js'
import { isSelfHost } from './_storage.js'

const COOKIE = (token, maxAge) =>
  `cockpit_auth=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ required: authRequired(), authed: isAuthed(req), selfHost: isSelfHost() })
  }
  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    if (body && body.logout) {
      res.setHeader('Set-Cookie', COOKIE('', 0))
      return res.status(200).json({ ok: true, authed: false })
    }
    if (!authRequired()) return res.status(200).json({ ok: true, authed: true }) // no password set
    if (verifyPassword((body && body.password) || '')) {
      res.setHeader('Set-Cookie', COOKIE(authToken(), 60 * 60 * 24 * 30)) // 30 days
      return res.status(200).json({ ok: true, authed: true })
    }
    return res.status(401).json({ ok: false, message: 'Неверный пароль.' })
  }
  return res.status(405).json({ error: 'method_not_allowed' })
}
