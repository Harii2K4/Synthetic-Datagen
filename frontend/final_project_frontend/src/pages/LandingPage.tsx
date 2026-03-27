import { Suspense, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { motion } from "framer-motion";
import type { Object3D } from "three";

type LandingPageProps = {
  onEnterHome: () => void
}

type GalaxyStar = {
  id: number
  x: number
  y: number
  size: number
  depth: number
  opacity: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

const MERCURY_MODEL_URL = new URL(
  "../assets/models/mercury_enhanced_color.glb",
  import.meta.url,
).href

function MercuryPlanet() {
  const gltf = useGLTF(MERCURY_MODEL_URL)
  const planetRef = useRef<Object3D | null>(null)

  useFrame((_state, delta) => {
    if (!planetRef.current) {
      return
    }
    planetRef.current.rotation.y += delta * 0.07
  })

  return (
    <primitive
      ref={planetRef}
      object={gltf.scene}
      position={[-2, -3, 0]}
      scale={1.75}
      rotation={[0.08, 0.56, 0]}
    />
  )
}

useGLTF.preload(MERCURY_MODEL_URL)

const LandingPage: React.FC<LandingPageProps> = ({ onEnterHome }) => {
  const [pointerX, setPointerX] = useState(0)
  const [pointerY, setPointerY] = useState(0)

  const stars = useMemo<GalaxyStar[]>(() => {
    return Array.from({ length: 120 }, (_, id) => {
      const depth = 0.35 + Math.random() * 1.25
      return {
        id,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: 0.8 + Math.random() * 2.6,
        depth,
        opacity: 0.24 + Math.random() * 0.68,
      }
    })
  }, [])

  const handlePointerMove: React.MouseEventHandler<HTMLDivElement> = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    const normalizedX = (event.clientX - bounds.left) / bounds.width
    const normalizedY = (event.clientY - bounds.top) / bounds.height
    setPointerX(clamp((normalizedX - 0.5) * 2, -1, 1))
    setPointerY(clamp((normalizedY - 0.5) * 2, -1, 1))
  }

  const resetPointer = () => {
    setPointerX(0)
    setPointerY(0)
  }

  return (
    <div
      onMouseMove={handlePointerMove}
      onMouseLeave={resetPointer}
      className="min-h-screen bg-[#0a0a0a] text-[#ffffff] selection:bg-[#fff] selection:text-[#0a0a0a]"
      style={{ fontFamily: '"Bodoni Moda", serif' }}
    >
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.6 }}
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 15% 20%, rgba(84, 112, 255, 0.22), transparent 40%), radial-gradient(circle at 78% 15%, rgba(81, 204, 255, 0.16), transparent 36%), radial-gradient(circle at 75% 75%, rgba(129, 109, 245, 0.22), transparent 42%), linear-gradient(180deg, #07090f 0%, #080a12 55%, #07080f 100%)",
            transform: `translate3d(${pointerX * -8}px, ${pointerY * -8}px, 0)`,
            transition: "transform 180ms ease-out",
          }}
        />

        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 120, ease: "linear", repeat: Infinity }}
          className="absolute left-1/2 top-1/2 h-[120vmax] w-[120vmax] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{
            background:
              "conic-gradient(from 90deg, rgba(255,255,255,0) 0deg, rgba(160,178,255,0.06) 50deg, rgba(255,255,255,0) 140deg, rgba(123,206,255,0.07) 220deg, rgba(255,255,255,0) 310deg)",
            filter: "blur(34px)",
            opacity: 0.8,
          }}
        />

        <div className="absolute inset-0">
        {stars.map((star) => (
          <motion.span
            key={star.id}
            className="absolute rounded-full"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{
              scale: [0.9, 1.2, 0.95],
              opacity: [star.opacity * 0.7, star.opacity, star.opacity * 0.82],
            }}
            transition={{
              duration: 2.6 + star.depth * 2.8,
              delay: (star.id % 12) * 0.08,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              background: "rgba(229, 238, 255, 0.95)",
              boxShadow: `0 0 ${4 + star.depth * 7}px rgba(184, 205, 255, 0.7)`,
              transform: `translate3d(${pointerX * star.depth * -14}px, ${pointerY * star.depth * -14}px, 0)`,
              transition: "transform 200ms ease-out",
            }}
          />
        ))}

        {/* Aurora Borealis Overlay */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-10"
          initial={{ opacity: 0.3 }}
          animate={{
            opacity: [0.3, 0.4, 0.35],
          }}
          transition={{ duration: 8, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
          style={{
            background: `radial-gradient(
              80% 40% at 50% 50%,
              rgba(84, 214, 183, 0.26),
              transparent 60%
            ),
            radial-gradient(
              60% 40% at 40% 30%,
              rgba(130, 109, 236, 0.22),
              transparent 55%
            ),
            radial-gradient(
              70% 40% at 70% 40%,
              rgba(183, 255, 169, 0.12),
              transparent 70%
            )
            `,
            transform: `translate3d(${pointerX * 6}px, ${pointerY * 4}px, 0)`,
            transition: "transform 300ms ease-out",
          }}
        >
          {/* Aurora "river" wiggle */}
          <motion.div
            className="absolute h-32 w-full blur-[120px] opacity-40 mix-blend-screen"
            initial={{ y: "-100%" }}
            animate={{
              y: ["-100%", "-90%", "-100%"],
            }}
            transition={{
              duration: 12,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            style={{
              background:
                "linear-gradient(90deg, rgba(100, 230, 200, 0.4) 0%, rgba(180, 120, 255, 0.35) 33%, rgba(100, 230, 200, 0.4) 66%, rgba(180, 120, 255, 0.35) 100%)",
            }}
          />
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-20">
        <Canvas
          camera={{ position: [0, 0, 4.6], fov: 38 }}
          dpr={[1, 1.75]}
          gl={{ antialias: true, alpha: true }}
        >
          <ambientLight intensity={0.65} color="#cfd9ff" />
          <directionalLight position={[2.6, 1.8, 3.2]} intensity={1.25} color="#f7f4ff" />
          <directionalLight position={[-2.4, -1.4, -1.6]} intensity={0.42} color="#6f91d4" />
          <Suspense fallback={null}>
            <MercuryPlanet />
          </Suspense>
        </Canvas>
      </div>

        <motion.div
          animate={{ opacity: [0.14, 0.22, 0.15] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(2px 2px at 20% 30%, rgba(255,255,255,0.12), transparent 70%), radial-gradient(2px 2px at 77% 60%, rgba(255,255,255,0.12), transparent 70%), radial-gradient(1px 1px at 52% 78%, rgba(255,255,255,0.15), transparent 70%)",
            backgroundSize: "280px 280px",
            transform: `translate3d(${pointerX * -5}px, ${pointerY * -5}px, 0)`,
            transition: "transform 180ms ease-out",
          }}
        />
      </div>

      {/* Absolute Minimal Navigation */}
      <nav className="fixed w-full z-50 mix-blend-difference px-12 py-10 flex justify-between items-start pointer-events-none">
        <div className="pointer-events-auto text-sm tracking-[0.3em] uppercase opacity-70 hover:opacity-100 transition-opacity font-sans">
          Dataset
          <br />
          Generation
        </div>
        <div className="pointer-events-auto flex gap-12 text-xs tracking-[0.4em] uppercase opacity-50 font-sans">
          <span
            className="hover:opacity-100 transition-opacity cursor-pointer"
            onClick={onEnterHome}
          >
            Workspace
          </span>
        </div>
      </nav>

      <main className="relative min-h-screen flex items-center px-12 lg:px-32 pt-20">
        <div className="w-full max-w-[1400px] mx-auto grid lg:grid-cols-2 gap-32 items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="relative z-10"
          >
            <div className="overflow-hidden mb-8">
              <motion.p
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                transition={{
                  duration: 1.5,
                  delay: 0.5,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="text-xs uppercase tracking-[0.5em] text-white/40 font-sans"
              >
                Data Synthesis Platform
              </motion.p>
            </div>

            <h1 className="text-[clamp(4rem,8vw,10rem)] leading-[0.85] tracking-tighter mb-16 font-medium">
              <div className="overflow-hidden pb-4">
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 1.5,
                    delay: 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  Generate
                </motion.div>
              </div>
              <div className="overflow-hidden pb-4 ml-12 lg:ml-24">
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  transition={{
                    duration: 1.5,
                    delay: 0.4,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="text-white/40 italic"
                >
                  Reality.
                </motion.div>
              </div>
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1.5,
                delay: 0.8,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="text-lg leading-relaxed text-white/60 max-w-lg mb-16 font-sans font-light"
            >
              A comprehensive platform for creating mock data across domains.
              From general knowledge to complex mathematical reasoning and tool
              use, generate high-fidelity datasets powered by OpenRouter models
              and custom teacher templates.
            </motion.p>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 2, delay: 1 }}
              className="flex items-center gap-12 font-sans"
            >
              <button
                onClick={onEnterHome}
                className="group flex items-center gap-6 text-xs uppercase tracking-[0.3em] hover:text-white/60 transition-colors cursor-pointer"
              >
                <div className="w-12 h-[1px] bg-white group-hover:w-20 transition-all duration-500 ease-out" />
                <span>Enter Workspace</span>
              </button>
            </motion.div>
          </motion.div>

          <div className="relative h-[80vh] flex items-center justify-center lg:justify-end hidden lg:flex">
            {/* Monolithic Data Pillar */}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: "100%" }}
              transition={{ duration: 2, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="w-px bg-white/20 absolute left-1/2 -translate-x-1/2"
            />

            <div className="relative w-full max-w-sm">
              {[
                { label: "Architecture", value: "FastAPI + React" },
                { label: "Synthesis", value: "OpenRouter" },
                { label: "Domains", value: "Math, Tool, Reason" },
              ].map((stat, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 1.5,
                    delay: 1 + i * 0.2,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="border-b border-white/10 py-8 group hover:border-white/40 transition-colors"
                >
                  <div className="flex justify-between items-end">
                    <span className="text-xs uppercase tracking-[0.2em] text-white/30 font-sans group-hover:text-white/60 transition-colors">
                      {stat.label}
                    </span>
                    <span className="text-xl italic">{stat.value}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>

    </div>
  );
};

export { LandingPage };
