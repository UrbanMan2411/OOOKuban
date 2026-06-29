import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { SLIDES } from './slides'
import { NavArrows, Progress, ExportControls } from './components/Nav'

const SLIDE_TRANSITION = {
  initial: { opacity: 0, scale: 0.98 },
  animate: { opacity: 1, scale: 1,    transition: { duration: 0.45, ease: [0.2, 0.9, 0.3, 1] } },
  exit:    { opacity: 0, scale: 1.02, transition: { duration: 0.35, ease: 'easeIn' } },
}

export default function App() {
  const [active, setActive] = useState(0)
  const [printMode, setPrintMode] = useState(false)
  const [busy, setBusy] = useState(false)
  const slideRef = useRef(null)
  const stackRef = useRef(null)

  const go = useCallback((next) => {
    setActive((cur) => {
      const n = Math.max(0, Math.min(SLIDES.length - 1, next))
      return n
    })
  }, [])
  const prev = useCallback(() => go(active - 1), [active, go])
  const next = useCallback(() => go(active + 1), [active, go])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev() }
      else if (e.key === 'Home') go(0)
      else if (e.key === 'End') go(SLIDES.length - 1)
      else if (/^[0-9]$/.test(e.key)) {
        const i = e.key === '0' ? 9 : Number(e.key) - 1
        if (i < SLIDES.length) go(i)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, go])

  // Wheel — debounced to avoid skipping multiple slides per gesture
  useEffect(() => {
    let lock = false
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < 25 || lock) return
      lock = true
      if (e.deltaY > 0) next(); else prev()
      setTimeout(() => { lock = false }, 650)
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [next, prev])

  // Touch swipe (tablets)
  useEffect(() => {
    let startX = null
    const onStart = (e) => { startX = e.touches[0].clientX }
    const onEnd = (e) => {
      if (startX == null) return
      const dx = e.changedTouches[0].clientX - startX
      if (Math.abs(dx) > 60) { dx < 0 ? next() : prev() }
      startX = null
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchend',   onEnd,   { passive: true })
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchend',   onEnd)
    }
  }, [next, prev])

  // Export current slide as PNG
  const exportSlide = useCallback(async () => {
    if (!slideRef.current) return
    setBusy(true)
    try {
      const canvas = await html2canvas(slideRef.current, {
        backgroundColor: '#FBF6EC',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      const link = document.createElement('a')
      const slide = SLIDES[active]
      link.download = `greenpanda-${String(active + 1).padStart(2, '0')}-${slide.id}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (e) {
      console.error('PNG export failed', e)
      alert('Не удалось экспортировать слайд. Проверьте консоль.')
    } finally {
      setBusy(false)
    }
  }, [active])

  // Export whole deck as a single cohesive PDF (one slide per landscape
  // page) via html2canvas → jsPDF. No browser print dialog, no page splits.
  const exportPdf = useCallback(async () => {
    setBusy(true)
    setPrintMode(true)
    // Mount the hidden stack of all slides, let Framer/images settle
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))
    await new Promise((r) => setTimeout(r, 800))
    try {
      const canvases = stackRef.current?.querySelectorAll('.slide-canvas') || []
      if (!canvases.length) throw new Error('Слайды не отрисованы')
      // 16:9 landscape page in pt (PowerPoint-like 1280×720 → use mm A-ish)
      const PW = 1280, PH = 720
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [PW, PH] })
      for (let i = 0; i < canvases.length; i++) {
        const c = await html2canvas(canvases[i], {
          backgroundColor: '#FBF6EC', scale: 2, useCORS: true, logging: false,
        })
        const img = c.toDataURL('image/jpeg', 0.92)
        if (i > 0) pdf.addPage([PW, PH], 'landscape')
        pdf.addImage(img, 'JPEG', 0, 0, PW, PH)
      }
      pdf.save('greenpanda-presentation.pdf')
    } catch (e) {
      console.error('PDF export failed', e)
      alert('Не удалось собрать PDF. Проверьте консоль.')
    } finally {
      setPrintMode(false)
      setBusy(false)
    }
  }, [])

  const Active = SLIDES[active].component

  return (
    <>
      {/* Single active slide (screen view) */}
      <div className="slide-frame deck-overlay">
        <div ref={slideRef} className="slide-canvas">
          <AnimatePresence mode="wait">
            <motion.div
              key={active}
              className="absolute inset-0"
              variants={SLIDE_TRANSITION}
              initial="initial" animate="animate" exit="exit"
            >
              <Active num={active + 1} total={SLIDES.length} />
            </motion.div>
          </AnimatePresence>
        </div>

        <NavArrows
          onPrev={prev} onNext={next}
          atStart={active === 0} atEnd={active === SLIDES.length - 1}
        />
        <Progress slides={SLIDES} active={active} onJump={go} />
        <ExportControls onExportPdf={exportPdf} onExportSlide={exportSlide} busy={busy} />
      </div>

      {/* Hidden stack of all slides for print/PDF export */}
      {printMode && (
        <div ref={stackRef} className="deck-stack" aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 999, background: '#fff' }}>
          {SLIDES.map((S, i) => {
            const C = S.component
            return (
              <div key={S.id} className="slide-frame">
                <div className="slide-canvas">
                  <C num={i + 1} total={SLIDES.length} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
