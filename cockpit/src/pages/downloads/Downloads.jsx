import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import { isSelfHost } from '../../lib/platform'

const MISC = { key: 'misc', label: 'Разное' }
const DEFAULT_FOLDERS = [
  { key: 'prices', label: 'Прайсы' },
  { key: 'cards', label: 'Карточки' },
  { key: 'reports', label: 'Отчёты' },
]

const IMG = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'bmp', 'svg'])
const isImg = (name) => IMG.has((name.split('.').pop() || '').toLowerCase())
const extOf = (name) => (name.split('.').pop() || '').toLowerCase()
const fmtSize = (b) =>
  b >= 1048576 ? (b / 1048576).toFixed(1) + ' МБ' : b >= 1024 ? Math.round(b / 1024) + ' КБ' : b + ' Б'
const fmtDate = (s) => {
  const d = new Date(s); if (isNaN(d)) return ''
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
const cleanSub = (s) => s.trim().replace(/[/\\]+/g, '-').replace(/\s+/g, ' ')

export default function Downloads() {
  const [folders, setFolders] = useState(DEFAULT_FOLDERS)
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [target, setTarget] = useState('cards')
  const [sub, setSub] = useState('')
  const [lightbox, setLightbox] = useState(null)
  const [moving, setMoving] = useState(null)       // item being moved
  const [moveFolder, setMoveFolder] = useState('') // dest folder in move dialog
  const [moveSub, setMoveSub] = useState('')       // dest sub in move dialog
  const inputRef = useRef(null)

  // top-level prefixes actually present in the files (self-healing: a folder
  // that has files always shows, even if it dropped out of the registry)
  const filePrefixes = useMemo(() => {
    const s = new Set()
    for (const it of items || []) {
      const i = it.pathname.indexOf('/')
      if (i > 0) s.add(it.pathname.slice(0, i))
    }
    return s
  }, [items])

  const allFolders = useMemo(() => {
    const regKeys = new Set(folders.map((f) => f.key))
    const extra = [...filePrefixes]
      .filter((p) => p !== 'misc' && !regKeys.has(p))
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((p) => ({ key: p, label: p.charAt(0).toUpperCase() + p.slice(1) }))
    return [...folders, ...extra, MISC]
  }, [folders, filePrefixes])

  const keySet = useMemo(() => new Set(allFolders.map((f) => f.key)), [allFolders])
  const labelOf = useCallback((key) => allFolders.find((f) => f.key === key)?.label || key, [allFolders])

  const parsePath = useCallback((pathname) => {
    const seg = pathname.split('/')
    if (seg.length === 1) return { folder: 'misc', sub: '', name: pathname }
    if (!keySet.has(seg[0])) return { folder: 'misc', sub: '', name: pathname }
    if (seg.length >= 3) return { folder: seg[0], sub: seg[1], name: seg.slice(2).join('/') }
    return { folder: seg[0], sub: '', name: seg[1] }
  }, [keySet])

  const loadFolders = useCallback(async () => {
    try {
      const r = await fetch('/api/downloads/folders'); const j = await r.json()
      if (r.ok && Array.isArray(j.folders)) setFolders(j.folders)
    } catch { /* keep defaults */ }
  }, [])

  const loadFiles = useCallback(async () => {
    setError('')
    try {
      const r = await fetch('/api/downloads/list')
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.message || 'Не удалось получить список'); setItems([]); return }
      setItems(j.items || [])
    } catch (e) { setError('Сеть недоступна: ' + (e.message || e)); setItems([]) }
  }, [])

  useEffect(() => { loadFolders(); loadFiles() }, [loadFolders, loadFiles])
  useEffect(() => {
    if (!allFolders.some((f) => f.key === target)) setTarget(allFolders[0]?.key || 'misc')
  }, [allFolders, target])
  useEffect(() => {
    if (!lightbox && !moving) return
    const onKey = (e) => { if (e.key === 'Escape') { setLightbox(null); setMoving(null) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, moving])

  const doUpload = useCallback(async (files) => {
    const arr = Array.from(files || []); const s = cleanSub(sub)
    for (const file of arr) {
      setBusy(file.name)
      const path = s ? `${target}/${s}/${file.name}` : `${target}/${file.name}`
      try {
        if (isSelfHost()) {
          // self-host: multipart straight to our server (no Vercel client-upload)
          const fd = new FormData(); fd.append('pathname', path); fd.append('file', file)
          const r = await fetch('/api/downloads/upload', { method: 'POST', body: fd })
          if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.message || r.status) }
        } else {
          await upload(path, file, { access: 'public', handleUploadUrl: '/api/downloads/upload' })
        }
      } catch (e) { setError(`Не удалось загрузить «${file.name}»: ${e.message || e}`) }
    }
    setBusy(''); await loadFiles()
  }, [target, sub, loadFiles])

  const onDrop = (e) => { e.preventDefault(); setDragOver(false); doUpload(e.dataTransfer.files) }

  const remove = useCallback(async (url, name) => {
    if (!window.confirm(`Удалить «${name}»? Файл исчезнет у всех.`)) return
    try {
      const r = await fetch('/api/downloads/delete', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); setError(j.message || 'Не удалось удалить'); return }
      await loadFiles()
    } catch (e) { setError('Сеть недоступна: ' + (e.message || e)) }
  }, [loadFiles])

  // copy→delete on the server
  const moveBlob = useCallback(async (fromUrl, fromPathname, toPathname) => {
    if (fromPathname === toPathname) return true
    try {
      const r = await fetch('/api/downloads/move', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUrl, fromPathname, toPathname }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) { setError(j.message || 'Не удалось переместить'); return false }
      await loadFiles(); return true
    } catch (e) { setError('Сеть недоступна: ' + (e.message || e)); return false }
  }, [loadFiles])

  const renameFile = useCallback(async (it) => {
    const { folder, sub } = parsePath(it.pathname)
    const m = it.name.match(/\.([^.\/]+)$/)
    const origExt = m ? m[1] : ''
    const input = window.prompt('Новое имя файла:', it.name)
    if (!input || !input.trim()) return
    let next = input.trim()
    // keep the original extension if the user dropped it — otherwise the file
    // stops being recognised as an image and the preview disappears
    if (origExt && !/\.[^.\/]+$/.test(next)) next = `${next}.${origExt}`
    if (next === it.name) return
    const toPathname = `${folder}${sub ? '/' + sub : ''}/${next}`
    await moveBlob(it.url, it.pathname, toPathname)
  }, [parsePath, moveBlob])

  const openMove = useCallback((it) => {
    const { folder, sub } = parsePath(it.pathname)
    setMoving(it); setMoveFolder(folder); setMoveSub(sub)
  }, [parsePath])

  const confirmMove = useCallback(async () => {
    if (!moving) return
    const s = cleanSub(moveSub)
    const toPathname = `${moveFolder}${s ? '/' + s : ''}/${moving.name}`
    const ok = await moveBlob(moving.url, moving.pathname, toPathname)
    if (ok) setMoving(null)
  }, [moving, moveFolder, moveSub, moveBlob])

  // ── folders ──
  const folderAction = useCallback(async (payload) => {
    const r = await fetch('/api/downloads/folders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) { setError(j.message || 'Ошибка операции с папкой'); return null }
    if (Array.isArray(j.folders)) setFolders(j.folders)
    return j
  }, [])
  const createFolder = useCallback(async () => {
    const label = window.prompt('Название новой папки:'); if (!label || !label.trim()) return
    const j = await folderAction({ action: 'create', label: label.trim() }); if (j?.created) setTarget(j.created.key)
  }, [folderAction])
  const renameFolder = useCallback(async (key) => {
    const cur = allFolders.find((f) => f.key === key)
    const label = window.prompt('Новое название папки:', cur?.label || ''); if (!label || !label.trim()) return
    await folderAction({ action: 'rename', key, label: label.trim() })
  }, [folderAction, allFolders])
  const deleteFolder = useCallback(async (key) => {
    if (!window.confirm('Удалить папку? Удалить можно только пустую.')) return
    const j = await folderAction({ action: 'delete', key }); if (j) setTarget((j.folders?.[0]?.key) || 'misc')
  }, [folderAction])

  const groups = useMemo(() => {
    const by = {}
    for (const it of items || []) {
      const { folder, sub, name } = parsePath(it.pathname)
      by[folder] = by[folder] || { subs: {}, count: 0 }
      const sk = sub || ''
      ;(by[folder].subs[sk] = by[folder].subs[sk] || []).push({ ...it, name })
      by[folder].count++
    }
    return by
  }, [items, parsePath])

  const counts = useMemo(() => {
    const c = {}; for (const f of allFolders) c[f.key] = groups[f.key]?.count || 0; return c
  }, [groups, allFolders])

  const subSuggestions = useMemo(() => {
    const s = new Set(Object.keys(groups[target]?.subs || {}).filter(Boolean))
    return [...s].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [groups, target])

  const moveSubSuggestions = useMemo(() => {
    const s = new Set(Object.keys(groups[moveFolder]?.subs || {}).filter(Boolean))
    return [...s].sort((a, b) => a.localeCompare(b, 'ru'))
  }, [groups, moveFolder])

  const renderRows = (list) =>
    list.map((it) => {
      const ext = extOf(it.name); const image = isImg(it.name)
      return (
        <div className="dl-row" key={it.pathname}>
          {image ? (
            <button className="dl-thumb-btn" type="button" title="Посмотреть" onClick={() => setLightbox(it)}>
              <img className="dl-thumb" src={it.url} alt={it.name} loading="lazy" />
            </button>
          ) : (
            <span className={'dl-ext dl-' + (ext || 'file')}>{ext || 'file'}</span>
          )}
          <div className="dl-info">
            <div className="dl-name">{it.name}</div>
            <div className="dl-meta">{fmtSize(it.size)} · {fmtDate(it.uploadedAt)}</div>
          </div>
          {image && <button className="btn ghost dl-btn" type="button" onClick={() => setLightbox(it)}>👁</button>}
          <a className="btn ghost dl-btn" href={it.url} download={it.name} target="_blank" rel="noreferrer">↓</a>
          <button className="dl-act" type="button" title="Переименовать" onClick={() => renameFile(it)}>✎</button>
          <button className="dl-act" type="button" title="Переместить" onClick={() => openMove(it)}>⇄</button>
          <button className="dl-del" type="button" title="Удалить" onClick={() => remove(it.url, it.name)}>×</button>
        </div>
      )
    })

  return (
    <>
      <h1 className="page-title">Загрузки</h1>
      <p className="page-sub">
        Общее облако. Папки создавайте и переименовывайте; файлы можно переименовать (✎) и переместить (⇄) между папками.
      </p>

      <div className="dl-folders">
        <span className="dl-folders-label">Папка:</span>
        {allFolders.map((f) => (
          <button key={f.key} type="button" className={'dl-fchip' + (target === f.key ? ' on' : '')}
            onClick={() => { setTarget(f.key); setSub('') }}>
            {f.label}{counts[f.key] ? <span className="dl-fchip-c">{counts[f.key]}</span> : null}
          </button>
        ))}
        <button type="button" className="dl-fchip dl-fchip-add" onClick={createFolder}>＋ Папка</button>
      </div>

      {target !== 'misc' && (
        <div className="dl-manage">
          Папка «<b>{labelOf(target)}</b>»:
          <button type="button" className="dl-link" onClick={() => renameFolder(target)}>✎ переименовать</button>
          <button type="button" className="dl-link dl-link-del" onClick={() => deleteFolder(target)}>× удалить</button>
        </div>
      )}

      <div className="dl-subrow">
        <span className="dl-sublabel">Подпапка:</span>
        <input className="dl-subinput" list="dl-sub-suggest" value={sub}
          placeholder="напр. Туалет — необязательно" onChange={(e) => setSub(e.target.value)} />
        <datalist id="dl-sub-suggest">{subSuggestions.map((s) => <option key={s} value={s} />)}</datalist>
        {subSuggestions.length > 0 && (
          <span className="dl-subchips">
            {subSuggestions.map((s) => (
              <button key={s} type="button" className={'dl-subchip' + (cleanSub(sub) === s ? ' on' : '')} onClick={() => setSub(s)}>{s}</button>
            ))}
          </span>
        )}
      </div>

      <div
        className={'drop ' + (dragOver ? 'over' : '') + (busy ? ' busy' : '')}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => !busy && inputRef.current?.click()}
        role="button" tabIndex={0}
      >
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => doUpload(e.target.files)} />
        {busy ? (
          <><div className="drop-title">Загружаю «{busy}»…</div><div className="drop-sub">не закрывайте вкладку</div></>
        ) : (
          <>
            <div className="drop-icon">⬆</div>
            <div className="drop-title">Перетащите файлы → «{labelOf(target)}{cleanSub(sub) ? ` / ${cleanSub(sub)}` : ''}»</div>
            <div className="drop-sub">или нажмите, чтобы выбрать (можно несколько, до 50 МБ)</div>
          </>
        )}
      </div>

      {error && <div className="card oz-err" style={{ marginTop: 16 }}><p style={{ margin: 0 }}>{error}</p></div>}

      {items === null && <div className="card" style={{ marginTop: 20 }}><p style={{ margin: 0, color: 'var(--muted)' }}>Загружаю список…</p></div>}
      {items && items.length === 0 && !error && (
        <div className="card" style={{ marginTop: 20 }}><p style={{ margin: 0, color: 'var(--muted)' }}>Пока пусто — загрузите первый файл выше.</p></div>
      )}

      {allFolders.map((f) => {
        const g = groups[f.key]; if (!g || !g.count) return null
        const subKeys = Object.keys(g.subs).sort((a, b) => (a ? 1 : 0) - (b ? 1 : 0) || a.localeCompare(b, 'ru'))
        return (
          <section key={f.key} className="dl-section">
            <h2 className="dl-cat">📁 {f.label} <span className="dl-cat-c">{g.count}</span></h2>
            {subKeys.map((sk) => (
              <div key={sk || '_root'} className="dl-sub">
                {sk && <div className="dl-subhead">↳ {sk} <span className="dl-cat-c">{g.subs[sk].length}</span></div>}
                <div className="dl-list">{renderRows(g.subs[sk])}</div>
              </div>
            ))}
          </section>
        )
      })}

      {lightbox && (
        <div className="dl-lb" onClick={() => setLightbox(null)}>
          <div className="dl-lb-box" onClick={(e) => e.stopPropagation()}>
            <img className="dl-lb-img" src={lightbox.url} alt={lightbox.name} />
            <div className="dl-lb-bar">
              <span className="dl-lb-name">{lightbox.name}</span>
              <a className="btn ghost dl-btn" href={lightbox.url} download={lightbox.name} target="_blank" rel="noreferrer">↓ Скачать</a>
            </div>
          </div>
          <button className="dl-lb-close" type="button" onClick={() => setLightbox(null)} title="Закрыть (Esc)">×</button>
        </div>
      )}

      {moving && (
        <div className="dl-lb" onClick={() => setMoving(null)}>
          <div className="dl-modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="dl-modal-h">Переместить «{moving.name}»</h3>
            <div className="dl-modal-row">
              <span className="dl-sublabel">Папка:</span>
              <span className="dl-subchips">
                {allFolders.map((f) => (
                  <button key={f.key} type="button" className={'dl-subchip' + (moveFolder === f.key ? ' on' : '')}
                    onClick={() => { setMoveFolder(f.key); setMoveSub('') }}>{f.label}</button>
                ))}
              </span>
            </div>
            <div className="dl-modal-row">
              <span className="dl-sublabel">Подпапка:</span>
              <input className="dl-subinput" list="dl-move-sub" value={moveSub}
                placeholder="необязательно" onChange={(e) => setMoveSub(e.target.value)} />
              <datalist id="dl-move-sub">{moveSubSuggestions.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="dl-modal-foot">
              <span className="dl-modal-path">→ {labelOf(moveFolder)}{cleanSub(moveSub) ? ` / ${cleanSub(moveSub)}` : ''} / {moving.name}</span>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn ghost" type="button" onClick={() => setMoving(null)}>Отмена</button>
                <button className="btn" type="button" onClick={confirmMove}>Переместить</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
