import React from 'react'
import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Download, Image as ImageIcon } from 'lucide-react'

export function NavArrows({ onPrev, onNext, atStart, atEnd }) {
  return (
    <>
      <button
        onClick={onPrev}
        disabled={atStart}
        aria-label="Предыдущий слайд"
        className="deck-nav absolute left-4 top-1/2 -translate-y-1/2 z-50
                   w-12 h-12 rounded-full bg-white/85 backdrop-blur-md text-green-900
                   shadow-lg border border-white/70
                   flex items-center justify-center transition
                   hover:bg-white hover:scale-105 disabled:opacity-30 disabled:pointer-events-none"
      >
        <ChevronLeft size={22} strokeWidth={2.2} />
      </button>
      <button
        onClick={onNext}
        disabled={atEnd}
        aria-label="Следующий слайд"
        className="deck-nav absolute right-4 top-1/2 -translate-y-1/2 z-50
                   w-12 h-12 rounded-full bg-green-900/95 backdrop-blur-md text-paper
                   shadow-lg border border-white/15
                   flex items-center justify-center transition
                   hover:bg-green-800 hover:scale-105 disabled:opacity-30 disabled:pointer-events-none"
      >
        <ChevronRight size={22} strokeWidth={2.2} />
      </button>
    </>
  )
}

export function Progress({ slides, active, onJump }) {
  return (
    <div className="deck-progress absolute bottom-3 left-1/2 -translate-x-1/2 z-50
                    flex items-center gap-1 rounded-full px-2 py-1
                    bg-white/80 backdrop-blur-md border border-white/70 shadow-lg">
      {slides.map((_, i) => (
        <button
          key={i}
          onClick={() => onJump(i)}
          aria-label={`Перейти на слайд ${i + 1}`}
          className={`relative h-1 rounded-full transition-all duration-300
                      ${i === active ? 'w-4 bg-green-700' : 'w-1 bg-green-700/25 hover:bg-green-700/55'}`}
        />
      ))}
      <div className="ml-1.5 pl-1.5 border-l border-green-900/15 text-[9px] font-mono tabular-nums text-green-900">
        <span className="font-bold">{String(active + 1).padStart(2, '0')}</span>
        <span className="opacity-50"> / {String(slides.length).padStart(2, '0')}</span>
      </div>
    </div>
  )
}

export function ExportControls({ onExportPdf, onExportSlide, busy }) {
  return (
    <div className="deck-export absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1.5">
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onExportSlide}
        disabled={busy}
        title="Скачать текущий слайд как PNG"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1
                   bg-white/85 backdrop-blur-md text-green-900 text-[11px] font-semibold
                   border border-white/70 shadow-md hover:bg-white transition
                   disabled:opacity-60 disabled:pointer-events-none"
      >
        <ImageIcon size={12} strokeWidth={2.2} /> PNG
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={onExportPdf}
        disabled={busy}
        title="Скачать всю презентацию в PDF"
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1
                   bg-green-900 text-paper text-[11px] font-semibold
                   border border-white/15 shadow-md hover:bg-green-800 transition
                   disabled:opacity-60 disabled:pointer-events-none"
      >
        <Download size={12} strokeWidth={2.2} /> PDF
      </motion.button>
    </div>
  )
}
