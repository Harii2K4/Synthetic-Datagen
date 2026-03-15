import { motion } from "framer-motion";

type LandingPageProps = {
  onEnterHome: () => void
}

const LandingPage: React.FC<LandingPageProps> = ({ onEnterHome }) => {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] text-[#ffffff] selection:bg-[#fff] selection:text-[#0a0a0a]"
      style={{ fontFamily: '"Bodoni Moda", serif' }}
    >
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

      {/* Abstract Background Elements */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 4 }}
        className="fixed inset-0 pointer-events-none z-0"
      >
        <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-white/[0.02] rounded-full blur-[100px] transform translate-x-1/3 -translate-y-1/3" />
        <div className="absolute bottom-0 left-0 w-[40vw] h-[40vw] bg-white/[0.015] rounded-full blur-[80px] transform -translate-x-1/3 translate-y-1/3" />
      </motion.div>
    </div>
  );
};

export { LandingPage };
