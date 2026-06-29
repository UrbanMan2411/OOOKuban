import React from 'react'
import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { SlideShell, SlideHead } from '../components/SlideShell'
import { MARKETING_SUPPORT } from '../data'

export default function S11_Marketing({ num, total }) {
  return (
    <SlideShell num={num} total={total} eyebrow="10 · Маркетинговая поддержка" decoration="light">
      <SlideHead
        eyebrow="Маркетинг"
        title={<>Поддержка партнёра <span className="text-green-700">после контракта</span></>}
        subtitle="Готовый контент, совместные промо, аналитика и B2B-брендбук — всё, что помогает дистрибьютору и оптовому клиенту разогнать вторичные продажи."
      />

      <div className="mt-6 grid grid-cols-3 auto-rows-fr gap-3">
        {MARKETING_SUPPORT.map((m, i) => {
          const Icon = Icons[m.icon] || Icons.Megaphone
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.1 + i * 0.06 }}
              className="rounded-2xl bg-white/65 border border-line p-4 flex flex-col gap-2"
            >
              <div className="w-9 h-9 rounded-lg bg-green-700 text-paper flex items-center justify-center">
                <Icon size={18} strokeWidth={2.1} />
              </div>
              <div className="font-bold text-ink-900 text-[14px] leading-tight">{m.title}</div>
              <div className="text-[12px] text-ink-700/85 leading-snug">{m.text}</div>
            </motion.div>
          )
        })}
      </div>
    </SlideShell>
  )
}
