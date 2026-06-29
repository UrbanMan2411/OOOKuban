import React from 'react'
import { motion } from 'framer-motion'
import { BrandMark } from './Brand'

const enter = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0,  transition: { duration: 0.55, ease: [0.2, 0.9, 0.3, 1.02] } },
  exit:    { opacity: 0, y: -16, transition: { duration: 0.35, ease: 'easeIn' } },
}

/**
 * Shared chrome for every slide.
 * bgImage: CSS background-image with cover. Optional scale (transform) to zoom in.
 */
export function SlideShell({
  num, total, eyebrow,
  tone = 'light',
  decoration = 'none',
  bgImage,
  bgImageOpacity = 1,
  bgImageScale = 1,
  bgImagePosition = 'center',
  bgImageOverlay,
  children,
  hideChrome = false,
  hideHeader = false,
  hideFooter = false,
}) {
  const showHeader = !hideChrome && !hideHeader
  const showFooter = !hideChrome && !hideFooter
  const useDefaultBg = !bgImage
  const bg = !useDefaultBg
    ? (tone === 'dark' ? 'text-paper' : 'text-ink-900')
    : tone === 'dark'  ? 'misty-bg-dark text-paper'
    : tone === 'plain' ? 'bg-paper text-ink-900'
    : 'misty-bg text-ink-900'

  return (
    <div
      data-slide-num={num}
      className={`relative w-full h-full overflow-hidden ${bg}`}
    >
      {bgImage && (
        <>
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: `url("${bgImage}")`,
              backgroundSize: 'cover',
              backgroundPosition: bgImagePosition,
              backgroundRepeat: 'no-repeat',
              opacity: bgImageOpacity,
              transform: bgImageScale !== 1 ? `scale(${bgImageScale})` : undefined,
              transformOrigin: 'center',
            }}
          />
          {bgImageOverlay && (
            <div
              aria-hidden="true"
              className="absolute inset-0 pointer-events-none"
              style={{ background: bgImageOverlay }}
            />
          )}
        </>
      )}

      {showHeader && (
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-[3.5%] py-[1.8%]">
          <BrandMark tone={tone === 'dark' ? 'light' : 'dark'} />
          <div className={`flex items-baseline gap-3 ${tone === 'dark' ? 'text-paper/70' : 'text-ink-700/70'}`}>
            {eyebrow && <span className="eyebrow" style={{ color: tone === 'dark' ? '#7BBF95' : '#10743F' }}>{eyebrow}</span>}
            <span className="text-[11px] tracking-widest tabular-nums font-mono">
              <span className="font-bold">{String(num).padStart(2, '0')}</span>
              <span className="opacity-50"> / {String(total).padStart(2, '0')}</span>
            </span>
          </div>
        </div>
      )}

      <motion.div
        className="relative z-[5] w-full h-full pt-[7%] pb-[6%] px-[5.5%]"
        {...enter}
      >
        {children}
      </motion.div>

      {showFooter && (
        <div className="absolute bottom-0 left-[3.5%] right-[3.5%] flex items-center justify-between gap-4 pb-[1.6%] z-10">
          <div className={`flex-1 ${tone === 'dark' ? 'hairline-dark' : 'hairline'}`} />
          <div className={`text-[10px] tracking-[0.24em] uppercase font-semibold ${tone === 'dark' ? 'text-paper/45' : 'text-ink-700/45'}`}>
            GREEN PANDA · Презентация для партнёров · {new Date().getFullYear()}
          </div>
          <div className={`flex-1 ${tone === 'dark' ? 'hairline-dark' : 'hairline'}`} />
        </div>
      )}
    </div>
  )
}

/** Glass card wrapper with hover lift */
export function GlassCard({ tone = 'light', className = '', children, animate = true }) {
  const cls = tone === 'dark' ? 'glass-dark' : 'glass'
  const Tag = animate ? motion.div : 'div'
  const props = animate
    ? { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5, ease: 'easeOut' } }
    : {}
  return (
    <Tag className={`rounded-2xl p-5 ${cls} ${className}`} {...props}>
      {children}
    </Tag>
  )
}

/** Big eyebrow + headline pattern */
export function SlideHead({ eyebrow, title, subtitle, tone = 'light' }) {
  const sub = tone === 'dark' ? 'text-paper/75' : 'text-ink-700/85'
  return (
    <div className="max-w-[68%]">
      {eyebrow && (
        <div className="eyebrow mb-3" style={{ color: tone === 'dark' ? '#7BBF95' : '#10743F' }}>
          {eyebrow}
        </div>
      )}
      <h1 className={`display font-extrabold text-[clamp(28px,3.6vw,56px)] ${tone === 'dark' ? 'text-paper' : 'text-ink-900'}`}>
        {title}
      </h1>
      {subtitle && (
        <p className={`mt-4 text-[clamp(13px,1.05vw,18px)] leading-relaxed max-w-[600px] ${sub}`}>
          {subtitle}
        </p>
      )}
    </div>
  )
}
