import React, { useEffect, useRef, useState } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import {
  loadState, saveState, applyImports, createCard, updateCard, deleteCard, moveCard,
  loadCloud, saveCloud, COLUMNS, TAGS,
} from '../../lib/kanban'

const tagClass = (t) => 'kb-card-tag t-' + (t || 'other')
const tagLabel = (t) => (TAGS.find((x) => x.id === t) || TAGS[3]).label

export default function Kanban() {
  const [state, setState] = useState(() => loadState())
  const [editing, setEditing] = useState(null) // { mode: 'create'|'edit', col, card? }
  const cloudReady = useRef(false)

  // Load the shared cloud board; if cloud is empty, migrate this device's board up.
  useEffect(() => {
    let alive = true
    ;(async () => {
      const local = loadState()
      setState(local)
      const cloud = await loadCloud()
      if (!alive) return
      if (cloud) {
        for (const col of COLUMNS) if (!cloud.cards[col.id]) cloud.cards[col.id] = []
        const merged = applyImports(cloud) // apply any new task packs once, to the cloud board too
        setState(merged); saveState(merged); saveCloud(merged)
      } else {
        saveCloud(local) // first run → seed cloud from this board (imports already applied locally)
      }
      cloudReady.current = true
    })()
    return () => { alive = false }
  }, [])

  // Debounced push of any change to the shared cloud.
  useEffect(() => {
    if (!cloudReady.current) return
    const t = setTimeout(() => saveCloud(state), 800)
    return () => clearTimeout(t)
  }, [state])

  const onDragEnd = (result) => {
    const { source, destination } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return
    setState((s) => moveCard(s, source.droppableId, source.index, destination.droppableId, destination.index))
  }

  const openCreate = (colId) => setEditing({ mode: 'create', col: colId, card: { tag: 'other' } })
  const openEdit   = (card)   => setEditing({ mode: 'edit', card })

  const onSave = (fields) => {
    setState((s) =>
      editing.mode === 'create'
        ? createCard(s, editing.col, fields)
        : updateCard(s, editing.card.id, fields)
    )
    setEditing(null)
  }
  const onDelete = () => {
    setState((s) => deleteCard(s, editing.card.id))
    setEditing(null)
  }

  return (
    <>
      <h1 className="page-title">План</h1>
      <p className="page-sub">Канбан задач. Перетаскивайте карточки между колонками. Сохраняется локально в браузере.</p>

      <div className="kb-toolbar">
        <button className="btn" onClick={() => openCreate('backlog')}>+ задача</button>
        <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>
          {Object.values(state.cards).reduce((n, arr) => n + arr.length, 0)} карточек
        </span>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="kb-board">
          {COLUMNS.map((col) => {
            const items = state.cards[col.id] || []
            return (
              <div className="kb-col" key={col.id}>
                <div className="kb-col-head">
                  <div className="kb-col-title">{col.title}</div>
                  <span className="kb-col-count">{items.length}</span>
                </div>
                <Droppable droppableId={col.id}>
                  {(prov, snap) => (
                    <div
                      className={'kb-list ' + (snap.isDraggingOver ? 'dragging-over' : '')}
                      ref={prov.innerRef} {...prov.droppableProps}
                    >
                      {items.map((c, i) => (
                        <Draggable key={c.id} draggableId={c.id} index={i}>
                          {(pp, ss) => (
                            <div
                              ref={pp.innerRef} {...pp.draggableProps} {...pp.dragHandleProps}
                              className={'kb-card ' + (ss.isDragging ? 'dragging' : '')}
                              onClick={() => openEdit(c)}
                            >
                              <span className={tagClass(c.tag)}>{tagLabel(c.tag)}</span>
                              <div className="kb-card-title">{c.title}</div>
                              {c.desc && <div className="kb-card-desc">{c.desc}</div>}
                              {(c.assignee || c.due) && (
                                <div className="kb-card-meta">
                                  {c.assignee && <span>👤 {c.assignee}</span>}
                                  {c.due && <span>📅 {c.due}</span>}
                                </div>
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {prov.placeholder}
                      {items.length === 0 && (
                        <button
                          className="bgreplace"
                          style={{ padding: 6, alignSelf: 'flex-start' }}
                          onClick={() => openCreate(col.id)}
                        >
                          + добавить
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {editing && (
        <CardEditor
          card={editing.card || {}}
          mode={editing.mode}
          onSave={onSave}
          onDelete={editing.mode === 'edit' ? onDelete : null}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  )
}

function CardEditor({ card, mode, onSave, onDelete, onClose }) {
  const [title, setTitle] = useState(card.title || '')
  const [desc, setDesc] = useState(card.desc || '')
  const [tag, setTag] = useState(card.tag || 'other')
  const [assignee, setAssignee] = useState(card.assignee || '')
  const [due, setDue] = useState(card.due || '')

  const save = () => onSave({ title, desc, tag, assignee, due })

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'create' ? 'Новая задача' : 'Редактирование'}</h2>
        <label>Заголовок</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <label>Описание</label>
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} />
        <label>Метка</label>
        <select value={tag} onChange={(e) => setTag(e.target.value)}>
          {TAGS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
        <label>Ответственный</label>
        <input value={assignee} onChange={(e) => setAssignee(e.target.value)} placeholder="—" />
        <label>Дедлайн</label>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        <div className="modal-actions">
          {onDelete && <button className="btn btn-del" onClick={onDelete}>Удалить</button>}
          <button className="btn ghost" onClick={onClose}>Отмена</button>
          <button className="btn" onClick={save}>Сохранить</button>
        </div>
      </div>
    </div>
  )
}
