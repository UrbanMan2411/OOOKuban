import React from 'react'
import { motion } from 'framer-motion'
import { SlideShell, SlideHead } from '../components/SlideShell'
import { QUALITY } from '../data'

export default function S09_Quality({ num, total }) {
  return (
    <SlideShell num={num} total={total} eyebrow="08 · Контроль качества и безопасность">
      <SlideHead
        eyebrow="Качество и безопасность"
        title={<>Полный пакет документов, подтверждающий <span className="text-green-700">безопасность продуктов</span>, и собственная аттестованная лаборатория</>}
        subtitle="Контроль рецептуры на каждой варке."
      />

      <div className="mt-10 grid grid-cols-2 gap-4">
        {QUALITY.certs.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15 + i * 0.07 }}
            className="rounded-2xl border border-line bg-white/65 p-6 flex gap-5 items-start"
          >
            <div className="w-16 h-16 rounded-xl bg-green-700 text-paper flex items-center justify-center font-extrabold text-[16px] shrink-0 tracking-wider">
              {c.code}
            </div>
            <div>
              <div className="font-bold text-ink-900 text-[15px] leading-tight">{c.title}</div>
              <div className="text-[13px] text-ink-700/85 mt-2 leading-relaxed">{c.body}</div>
            </div>
          </motion.div>
        ))}
      </div>
    </SlideShell>
  )
}
