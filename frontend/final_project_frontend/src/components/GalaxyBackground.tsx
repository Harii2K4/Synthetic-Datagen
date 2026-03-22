import { useMemo } from 'react'
import { motion } from 'framer-motion'

type GalaxyBackgroundProps = {
  starCount?: number
}

type Star = {
  id: number
  x: number
  y: number
  size: number
  opacity: number
  duration: number
  delay: number
}

function GalaxyBackground({ starCount = 95 }: GalaxyBackgroundProps) {
  const stars = useMemo<Star[]>(() => {
    return Array.from({ length: starCount }, (_, id) => ({
      id,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 0.8 + Math.random() * 2.6,
      opacity: 0.2 + Math.random() * 0.72,
      duration: 2.2 + Math.random() * 3.6,
      delay: Math.random() * 2.8,
    }))
  }, [starCount])

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        style={{
          background:
            'radial-gradient(circle at 16% 18%, rgba(73, 112, 255, 0.22), transparent 38%), radial-gradient(circle at 82% 14%, rgba(88, 224, 255, 0.18), transparent 34%), radial-gradient(circle at 70% 76%, rgba(131, 98, 226, 0.2), transparent 40%), linear-gradient(180deg, #080a13 0%, #0a0d17 52%, #090b12 100%)',
        }}
      />

      <motion.div
        className="absolute left-1/2 top-1/2 h-[115vmax] w-[115vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
        animate={{ rotate: 360 }}
        transition={{ duration: 145, ease: 'linear', repeat: Infinity }}
        style={{
          background:
            'conic-gradient(from 80deg, rgba(255,255,255,0) 0deg, rgba(148,172,255,0.07) 44deg, rgba(255,255,255,0) 136deg, rgba(114,206,255,0.08) 226deg, rgba(255,255,255,0) 312deg)',
          filter: 'blur(34px)',
          opacity: 0.8,
        }}
      />

      <div className="absolute inset-0">
        {stars.map((star) => (
          <motion.span
            key={star.id}
            className="absolute rounded-full"
            animate={{
              scale: [0.88, 1.2, 0.94],
              opacity: [star.opacity * 0.7, star.opacity, star.opacity * 0.78],
            }}
            transition={{
              duration: star.duration,
              delay: star.delay,
              repeat: Infinity,
              repeatType: 'reverse',
              ease: 'easeInOut',
            }}
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              background: 'rgba(234, 243, 255, 0.95)',
              boxShadow: '0 0 8px rgba(179, 203, 255, 0.62)',
            }}
          />
        ))}
      </div>

      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.1, 0.18, 0.12] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          backgroundImage:
            'radial-gradient(2px 2px at 24% 32%, rgba(255,255,255,0.13), transparent 70%), radial-gradient(2px 2px at 79% 58%, rgba(255,255,255,0.13), transparent 70%), radial-gradient(1px 1px at 48% 76%, rgba(255,255,255,0.16), transparent 70%)',
          backgroundSize: '280px 280px',
        }}
      />
    </div>
  )
}

export { GalaxyBackground }
