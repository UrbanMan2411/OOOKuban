import React from 'react'
import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'
import { SlideShell, SlideHead } from '../components/SlideShell'
import { ROADMAP } from '../data'

export default function S12_Roadmap({ num, total }) {
  return (
    <SlideShell num={num} total={total} eyebrow="11 · Планы развития бренда">
      <SlideHead
        eyebrow="Roadmap 2026 — 2027"
        title={<>Стратегия роста — <span className="text-green-700">по плану</span>, не по случаю</>}
        subtitle="Усиление присутствия, расширение портфеля, география продаж — на горизонт полутора-двух лет."
      />

      <div className="mt-12 relative">
        <div className="absolute top-[34px] left-[4%] right-[4%] h-0.5 bg-gradient-to-r from-green-700/0 via-green-700/60 to-green-700/0" />
        <div className="grid grid-cols-3 gap-5">
          {ROADMAP.map((r, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.1 }}
              className="flex flex-col"
            >
              <div className="self-center px-5 py-2 rounded-full bg-green-700 text-paper text-[12px] font-bold tracking-widest uppercase shadow-md shadow-green-900/15 z-10">
                {r.period}
              </div>
              <div className="self-center w-px h-6 bg-green-700/40" />
              <div className="flex-1 rounded-2xl bg-white/70 border border-line p-5 flex flex-col gap-2.5">
                <div className="font-bold text-ink-900 text-[16px]">{r.title}</div>
                <ul className="flex flex-col gap-2">
                  {r.items.map((it, j) => (
                    <li key={j} className="flex gap-2 items-start text-[12.5px] text-ink-700 leading-snug">
                      <Sparkles size={14} strokeWidth={2.4} className="text-green-600 mt-0.5 shrink-0" />
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideShell>
  )
}
