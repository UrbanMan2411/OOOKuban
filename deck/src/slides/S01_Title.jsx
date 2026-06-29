import React from 'react'
import { motion } from 'framer-motion'
import { SlideShell } from '../components/SlideShell'
import { BRAND } from '../data'

export default function S01_Title({ num, total }) {
  return (
    <SlideShell
      num={num}
      total={total}
      eyebrow="Презентация для партнёров"
      hideFooter
      bgImage="/panda.png"
      bgImageOpacity={0.95}
      bgImageScale={1.35}
      bgImagePosition="center 38%"
      bgImageOverlay="linear-gradient(90deg, rgba(251,246,236,0.92) 0%, rgba(251,246,236,0.7) 32%, rgba(251,246,236,0.28) 60%, rgba(251,246,236,0) 82%)"
    >
      <div className="relative z-10 h-full w-full flex flex-col justify-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <div className="eyebrow text-green-700">Бренд бытовой химии</div>
          <h1 className="display font-extrabold text-[clamp(56px,7vw,128px)] mt-4 text-green-900 leading-[0.92]">
            GREEN
            <br />
            <span className="text-green-700">PANDA</span>
          </h1>
          <p className="mt-5 text-[clamp(18px,1.5vw,28px)] font-light text-ink-700">
            {BRAND.tagline}
          </p>
        </motion.div>

        <motion.div
          className="mt-10"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.9, delay: 0.4 }}
        >
          <div className="eyebrow text-green-700/70">Производитель</div>
          <div className="text-ink-900 font-bold text-base mt-1">{BRAND.producer}</div>
          <div className="text-ink-700/70 text-sm mt-1">{BRAND.address}</div>
        </motion.div>
      </div>
    </SlideShell>
  )
}
