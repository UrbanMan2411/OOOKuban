// Tiny runtime flag: are we talking to a self-hosted server (filesystem
// storage) or Vercel (Blob client-upload)? Set once from /api/auth on load.
let selfHost = false
export const setSelfHost = (v) => { selfHost = !!v }
export const isSelfHost = () => selfHost
