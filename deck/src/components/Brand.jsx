import React from 'react'

/**
 * Brand wordmark — the supplied "Green Panda" logo image, rendered as a
 * soft black wordmark (brightness(0) → black, reduced opacity → subtle).
 */
export function BrandMark({ tone = 'dark', size = 28 }) {
  return (
    <div className="inline-flex items-center select-none">
      <img
        src="/logo.png"
        alt="Green Panda"
        aria-label="Green Panda"
        style={{
          height: size + 14,
          width: 'auto',
          display: 'block',
          // black wordmark, softened
          filter: 'brightness(0)',
          opacity: 0.55,
        }}
      />
    </div>
  )
}
