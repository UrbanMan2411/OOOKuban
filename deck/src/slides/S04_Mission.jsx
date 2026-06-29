import React from 'react'
import { motion } from 'framer-motion'
import * as Icons from 'lucide-react'
import { SlideShell } from '../components/SlideShell'
import { VALUES, MISSION } from '../data'

export default function S04_Mission({ num, total }) {
  return (
    <SlideShell num={num} total={total} eyebrow="03 · Миссия и ценности" tone="dark" decoration="bamboo">
      <div className="grid grid-cols-12 gap-8 h-full">
        <div className="col-span-5 flex flex-col justify-center">
          <div className="eyebrow text-sage mb-4">Миссия</div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="display font-extrabold text-[clamp(28px,2.8vw,44px)] text-paper leading-tight"
          >
            Чистый дом и чистая природа — <span className="text-green-300">не альтернатива.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="mt-6 text-[clamp(13px,1vw,17px)] text-paper/75 leading-relaxed max-w-md"
          >
            {MISSION}
          </motion.p>
        </div>

        <div className="col-span-7 grid grid-cols-3 gap-3 self-center">
          {VALUES.map((v, i) => {
            const Icon = Icons[v.icon] || Icons.Sparkles
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.15 + i * 0.06 }}
                className="rounded-2xl p-5 glass-dark"
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/15 text-green-300 flex items-center justify-center mb-4">
                  <Icon size={20} strokeWidth={2} />
                </div>
                <div className="text-paper font-bold text-[15px]">{v.title}</div>
                <div className="mt-2 text-[12.5px] text-paper/70 leading-relaxed">{v.text}</div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </SlideShell>
  )
}
