import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Sparkles, MapPin } from 'lucide-react'
import { SlideShell, SlideHead } from '../components/SlideShell'
import { MARKET_KPIS, MARKET_TRENDS } from '../data'

const trendIcons = [Sparkles, MapPin, TrendingUp]

export default function S02_Market({ num, total }) {
  return (
    <SlideShell num={num} total={total} eyebrow="01 · Рынок и тренды">
      <SlideHead
        eyebrow="Рынок и тренды"
        title={<>Эко-бытовая химия — <span className="text-green-700">самая быстрорастущая категория</span> FMCG в РФ</>}
        subtitle="Уход международных игроков и тренд на устойчивое потребление перестроили рынок. У локального производителя с прозрачной формулой — лучшие позиции за десятилетие."
      />

      <div className="mt-5 grid grid-cols-12 gap-3">
        <div className="col-span-12 grid grid-cols-3 gap-3">
          {MARKET_KPIS.map((k, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 + i * 0.07 }}
              className="glass rounded-2xl p-4 flex flex-col"
            >
              <div className="flex items-baseline gap-1">
                <span className="text-[clamp(26px,2.7vw,42px)] font-extrabold text-green-700 tracking-tight leading-none">
                  {k.value}
                </span>
                {k.unit && <span className="text-sm font-bold text-green-700/70">{k.unit}</span>}
              </div>
              <div className="mt-2 text-[12px] text-ink-700 leading-snug">{k.label}</div>
              <div className="mt-2 pt-2 border-t border-ink-700/10 text-[9px] tracking-wider uppercase text-muted">
                {k.source}
              </div>
            </motion.div>
          ))}
        </div>

        <div className="col-span-12 grid grid-cols-3 gap-3">
          {MARKET_TRENDS.map((t, i) => {
            const Icon = trendIcons[i]
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.07 }}
                className="rounded-xl bg-paper2/70 border border-line/60 p-4 flex flex-col gap-2"
              >
                <div className="w-8 h-8 rounded-lg bg-green-50 text-green-700 flex items-center justify-center">
                  <Icon size={16} strokeWidth={2.2} />
                </div>
                <div className="font-bold text-ink-900 text-[14px]">{t.title}</div>
                <div className="text-[12px] text-ink-700/85 leading-snug">{t.text}</div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </SlideShell>
  )
}
