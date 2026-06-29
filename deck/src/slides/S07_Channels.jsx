import React from 'react'
import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { SlideShell, SlideHead } from '../components/SlideShell'
import { CHANNELS } from '../data'

const SPANS = ['col-span-6', 'col-span-6', 'col-span-4', 'col-span-4', 'col-span-4']

export default function S07_Channels({ num, total }) {
  return (
    <SlideShell num={num} total={total} eyebrow="06 · Каналы продаж">
      <SlideHead
        eyebrow="Каналы продаж"
        title={<>Дистрибьюторы и опт — <span className="text-green-700">основа продаж</span> Green Panda</>}
        subtitle="Фокус на долгосрочные отношения с дистрибьюторами и оптовыми клиентами: эксклюзив по территории, индивидуальные условия и пакет документов для каждого канала."
      />

      <div className="mt-8 grid grid-cols-12 gap-4">
        {CHANNELS.map((c, i) => {
          const Icon = Icons[c.icon] || Icons.Boxes
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 + i * 0.08 }}
              className={`${SPANS[i] || 'col-span-4'} rounded-2xl border border-line bg-white/65 p-5 flex flex-col gap-2`}
            >
              <div className="flex items-center justify-between">
                <div className="w-11 h-11 rounded-xl bg-green-700 text-paper flex items-center justify-center">
                  <Icon size={20} strokeWidth={2.1} />
                </div>
                <div className="text-right">
                  <div className="text-[10px] uppercase tracking-widest font-semibold text-muted">Доля</div>
                  <div className="text-[clamp(20px,2vw,28px)] font-extrabold text-green-700 leading-none mt-1">{c.share}</div>
                </div>
              </div>
              <div className="font-bold text-ink-900 text-[15px] mt-1">{c.name}</div>
              <div className="text-[12px] text-ink-700/85 leading-relaxed">{c.note}</div>
              <ChannelBar share={c.share} />
            </motion.div>
          )
        })}
      </div>
    </SlideShell>
  )
}

function ChannelBar({ share }) {
  const m = share.match(/(\d+)/g)
  const pct = m ? Number(m[m.length - 1]) : 8
  return (
    <div className="mt-auto pt-2 h-1.5 rounded-full bg-green-900/10 overflow-hidden">
      <motion.div
        initial={{ width: 0 }} animate={{ width: `${pct}%` }}
        transition={{ duration: 0.9, delay: 0.4, ease: 'easeOut' }}
        className="h-full rounded-full bg-gradient-to-r from-green-500 to-green-700"
      />
    </div>
  )
}
