import React, { useState, useCallback, useRef } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { parsePriceXlsx } from '../../lib/parseXlsx'

// ── helpers: convert between flat parsed rows and the editor's ordered items ──
// The editor models the price list as an ordered list of items, each either a
// section header or a product row. A product's section = the nearest header
// above it, so drag-reordering keeps sections coherent automatically.
let _idc = 0
const newId = () => 'g' + (++_idc)

function rowsToItems(rows) {
  const items = []
  let sec = null
  for (const r of rows) {
    if (r.section !== sec) {
      sec = r.section
      items.push({ type: 'section', _id: newId(), name: sec || '' })
    }
    items.push({ type: 'row', _id: newId(), name: r.name, volume: r.volume, sku: r.sku, barcode: r.barcode || '', perBox: r.perBox || '', pallet: r.pallet || '', price: r.price, image: r.image })
  }
  return items
}

function itemsToRows(items) {
  const rows = []
  let sec = ''
  for (const it of items) {
    if (it.type === 'section') sec = it.name
    else rows.push({ section: sec, name: it.name, volume: it.volume, sku: it.sku, barcode: it.barcode, perBox: it.perBox, pallet: it.pallet, price: it.price, image: it.image })
  }
  return rows
}

const blankRow = () => ({ type: 'row', _id: newId(), name: '', volume: '', sku: '', barcode: '', perBox: '', pallet: '', price: 0, image: null })

/**
 * Reusable price-list generator UI. Drop xlsx → edit (inline / add / delete /
 * reorder) → PDF. Wired by each brand page with its own buildPdf + assets.
 */
export default function GeneratorPanel({ title, sub, brand, bgSwatch, downloadName, buildPdf }) {
  const isGreen = brand === 'greenpanda'

  const [status, setStatus] = useState('idle') // idle | parsing | ready | building | done | error
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [fileName, setFileName] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef(null)

  const [bgMode, setBgMode] = useState('default')
  const [bgCustom, setBgCustom] = useState(null)
  const [bgOpacity, setBgOpacity] = useState(10)
  const bgInputRef = useRef(null)

  const onBgFile = useCallback((file) => {
    if (!file) return
    if (!/^image\//.test(file.type)) return
    const fr = new FileReader()
    fr.onload = () => { setBgCustom(fr.result); setBgMode('custom') }
    fr.readAsDataURL(file)
  }, [])

  const handleFile = useCallback(async (file) => {
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) {
      setError('Нужен файл .xlsx'); setStatus('error'); return
    }
    setFileName(file.name)
    setStatus('parsing'); setError('')
    try {
      const { rows } = await parsePriceXlsx(file)
      if (!rows.length) throw new Error('Не нашёл товаров. Проверьте формат прайса.')
      setItems(rowsToItems(rows))
      setStatus('ready')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Ошибка чтения файла')
      setStatus('error')
    }
  }, [])

  // ── editing actions ──
  const updateItem = useCallback((id, field, value) => {
    setItems((prev) => prev.map((it) => (it._id === id ? { ...it, [field]: value } : it)))
  }, [])

  const deleteItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it._id !== id))
  }, [])

  // add a position at the end of a section's group (header at secIdx)
  const addRowAfter = useCallback((secIdx) => {
    setItems((prev) => {
      let j = secIdx + 1
      while (j < prev.length && prev[j].type === 'row') j++
      const next = prev.slice()
      next.splice(j, 0, blankRow())
      return next
    })
  }, [])

  const addSection = useCallback(() => {
    setItems((prev) => [...prev, { type: 'section', _id: newId(), name: 'НОВЫЙ РАЗДЕЛ' }, blankRow()])
  }, [])

  const onDragEnd = useCallback((result) => {
    if (!result.destination) return
    const from = result.source.index
    const to = result.destination.index
    if (from === to) return
    setItems((prev) => {
      const next = prev.slice()
      const [m] = next.splice(from, 1)
      next.splice(to, 0, m)
      return next
    })
  }, [])

  const generate = useCallback(async () => {
    setStatus('building'); setError('')
    try {
      const rows = itemsToRows(items)
      if (!rows.length) throw new Error('Нет ни одной позиции для PDF.')
      const bg = bgMode === 'none' ? 'none' : bgMode === 'custom' ? (bgCustom || 'default') : 'default'
      const bytes = await buildPdf(rows, { bg, bgOpacity: bgOpacity / 100 })
      const blob = new Blob([bytes], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = downloadName
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      setStatus('done')
    } catch (e) {
      console.error(e)
      setError(e.message || 'Ошибка генерации PDF')
      setStatus('error')
    }
  }, [items, bgMode, bgCustom, bgOpacity, buildPdf, downloadName])

  const onDrop = (e) => {
    e.preventDefault(); setDragOver(false)
    handleFile(e.dataTransfer.files?.[0])
  }

  const rowItems = items.filter((it) => it.type === 'row')
  const withPhoto = rowItems.filter((r) => r.image).length
  const cls = (base) => base + (isGreen ? ' green' : '')
  const loaded = status === 'ready' || status === 'building' || status === 'done'

  return (
    <>
      <h1 className="page-title" style={isGreen ? { color: 'var(--green-9)' } : undefined}>{title}</h1>
      <p className="page-sub">{sub}</p>

      <div
        className={cls('drop') + ' ' + (dragOver ? 'over' : '') + ' ' + (status === 'error' ? 'err' : '')}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <input ref={inputRef} type="file" accept=".xlsx" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
        {status === 'idle' && (
          <>
            <div className="drop-icon">⬆</div>
            <div className="drop-title">Перетащите .xlsx сюда</div>
            <div className="drop-sub">или нажмите, чтобы выбрать файл</div>
          </>
        )}
        {status === 'parsing' && <div className="drop-title">Читаю файл…</div>}
        {loaded && (
          <>
            <div className="drop-title">✓ {fileName}</div>
            <div className="drop-sub">Позиций: <b>{rowItems.length}</b> · с фото: <b>{withPhoto}</b></div>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="drop-title err-t">Ошибка</div>
            <div className="drop-sub">{error}</div>
            <div className="drop-sub">нажмите, чтобы выбрать другой файл</div>
          </>
        )}
      </div>

      {loaded && (
        <div className={cls('bgblock')}>
          <div className="bgblock-head">Фон PDF</div>
          <div className="bgopts">
            <button className={cls('bgopt') + (bgMode === 'default' ? ' on' : '')} onClick={() => setBgMode('default')} type="button">
              <span className="bgsw" style={{ backgroundImage: `url(${bgSwatch})` }} />
              Стандартный
            </button>
            <button className={cls('bgopt') + (bgMode === 'custom' ? ' on' : '')} onClick={() => (bgCustom ? setBgMode('custom') : bgInputRef.current?.click())} type="button">
              <span className="bgsw" style={bgCustom ? { backgroundImage: `url(${bgCustom})` } : {}}>{!bgCustom && '+'}</span>
              {bgCustom ? 'Свой' : 'Загрузить свой'}
            </button>
            <button className={cls('bgopt') + (bgMode === 'none' ? ' on' : '')} onClick={() => setBgMode('none')} type="button">
              <span className="bgsw none" />
              Без фона
            </button>
            {bgCustom && (
              <button className="bgreplace" type="button" onClick={() => bgInputRef.current?.click()}>заменить</button>
            )}
            <input ref={bgInputRef} type="file" accept="image/*" hidden onChange={(e) => onBgFile(e.target.files?.[0])} />
          </div>
          {bgMode !== 'none' && (
            <label className="bgop">
              Прозрачность фона: <b>{bgOpacity}%</b>
              <input type="range" min="3" max="60" value={bgOpacity} onChange={(e) => setBgOpacity(Number(e.target.value))} />
            </label>
          )}
        </div>
      )}

      {loaded && (
        <div className="actions">
          <button className={'btn' + (isGreen ? ' green' : '')} onClick={generate} disabled={status === 'building'}>
            {status === 'building' ? 'Генерирую PDF…' : 'Скачать PDF-прайс'}
          </button>
          {status === 'done' && <span className="ok">Готово — файл скачан</span>}
          <button className="btn ghost" onClick={() => { setStatus('idle'); setItems([]); setFileName('') }}>
            Загрузить другой
          </button>
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="ed-toolbar">
            <span className="edit-hint">✎ Правьте поля прямо в строке · ⠿ перетащите для порядка · ＋/× добавить и удалить</span>
            <button className="ed-addsec" type="button" onClick={addSection}>＋ раздел</button>
          </div>

          <div className={cls('ed-list')}>
            <div className="ed-cols">
              <span /><span>Фото</span><span>Наименование</span>
              <span className="ed-c">Объём</span><span className="ed-c">Артикул</span>
              <span className="ed-c">Штрих-код</span><span className="ed-c">В коробе</span><span className="ed-c">Паллет</span>
              <span className="ed-r">Цена ₽</span><span />
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="ed-list">
                {(dp) => (
                  <div ref={dp.innerRef} {...dp.droppableProps}>
                    {items.map((it, idx) => (
                      <Draggable key={it._id} draggableId={it._id} index={idx}>
                        {(p, snap) => (
                          <div
                            ref={p.innerRef}
                            {...p.draggableProps}
                            className={(it.type === 'section' ? 'ed-sec' : 'ed-row') + (snap.isDragging ? ' dragging' : '')}
                          >
                            <span className="ed-handle" {...p.dragHandleProps} title="Перетащить">⠿</span>

                            {it.type === 'section' ? (
                              <>
                                <input
                                  className="ed ed-secname"
                                  value={it.name}
                                  placeholder="Название раздела"
                                  onChange={(e) => updateItem(it._id, 'name', e.target.value)}
                                />
                                <button className="ed-add" type="button" onClick={() => addRowAfter(idx)}>＋ позиция</button>
                                <button className="ed-del" type="button" title="Удалить раздел" onClick={() => deleteItem(it._id)}>×</button>
                              </>
                            ) : (
                              <>
                                <span className="ed-thumb">
                                  {it.image ? <img src={it.image} alt="" /> : <span className="nophoto">—</span>}
                                </span>
                                <input className="ed ed-name" value={it.name} placeholder="Наименование"
                                  onChange={(e) => updateItem(it._id, 'name', e.target.value)} />
                                <input className="ed ed-c" value={it.volume} placeholder="—"
                                  onChange={(e) => updateItem(it._id, 'volume', e.target.value)} />
                                <input className="ed ed-c ed-mono" value={it.sku} placeholder="—"
                                  onChange={(e) => updateItem(it._id, 'sku', e.target.value)} />
                                <input className="ed ed-c ed-mono" value={it.barcode} placeholder="—"
                                  onChange={(e) => updateItem(it._id, 'barcode', e.target.value)} />
                                <input className="ed ed-c" value={it.perBox} placeholder="—"
                                  onChange={(e) => updateItem(it._id, 'perBox', e.target.value)} />
                                <input className="ed ed-c" value={it.pallet} placeholder="—"
                                  onChange={(e) => updateItem(it._id, 'pallet', e.target.value)} />
                                <input className="ed ed-r ed-price" type="number" step="1" min="0"
                                  value={Number.isFinite(it.price) ? it.price : 0}
                                  onChange={(e) => updateItem(it._id, 'price', e.target.value === '' ? 0 : Number(e.target.value))} />
                                <button className="ed-del" type="button" title="Удалить позицию" onClick={() => deleteItem(it._id)}>×</button>
                              </>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {dp.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        </>
      )}
    </>
  )
}
