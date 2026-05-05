"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Crown, Sparkles } from "lucide-react";

interface StageClearModalProps {
  show: boolean;
  stageNumber: number;
  stageName: string;
  isGold: boolean;
  onComplete?: () => void;
}

const STAGE_COLORS = {
  1: { primary: "#10b981", secondary: "#059669", glow: "#34d399" }, // Village - Green
  2: { primary: "#22c55e", secondary: "#16a34a", glow: "#4ade80" }, // Forest - Green
  3: { primary: "#a855f7", secondary: "#9333ea", glow: "#c084fc" }, // Arena - Purple
  4: { primary: "#f59e0b", secondary: "#d97706", glow: "#fbbf24" }, // Artisan - Amber
  5: { primary: "#71717a", secondary: "#52525b", glow: "#a1a1aa" }, // Mine - Gray
  6: { primary: "#3b82f6", secondary: "#2563eb", glow: "#60a5fa" }, // Harbour - Blue
  7: { primary: "#8b5cf6", secondary: "#7c3aed", glow: "#a78bfa" }, // Crossroads - Violet
  8: { primary: "#eab308", secondary: "#ca8a04", glow: "#facc15" }, // Capital - Yellow
};

export function StageClearModal({
  show,
  stageNumber,
  stageName,
  isGold,
  onComplete,
}: StageClearModalProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number }>>([]);

  const colors = STAGE_COLORS[stageNumber as keyof typeof STAGE_COLORS] || STAGE_COLORS[1];

  useEffect(() => {
    if (show) {
      // Generate random particles
      const newParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 0.5,
      }));
      setParticles(newParticles);

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        onComplete?.();
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  return (
    <AnimatePresence>
      {show && (
        <div className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center">
          {/* Backdrop with radial gradient */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            style={{
              background: `radial-gradient(circle at center, ${colors.primary}22 0%, transparent 70%)`,
            }}
          />

          {/* Particles */}
          {particles.map((particle) => (
            <motion.div
              key={particle.id}
              initial={{ y: -100, opacity: 0, scale: 0 }}
              animate={{
                y: window.innerHeight + 100,
                opacity: [0, 1, 1, 0],
                scale: [0, 1, 1, 0],
              }}
              transition={{
                duration: 2,
                delay: particle.delay,
                ease: "easeOut",
              }}
              className="absolute"
              style={{
                left: `${particle.x}%`,
                top: 0,
              }}
            >
              {isGold ? (
                <Crown className="h-4 w-4 text-yellow-400" />
              ) : (
                <Sparkles className="h-3 w-3" style={{ color: colors.glow }} />
              )}
            </motion.div>
          ))}

          {/* Main banner - drops from top */}
          <motion.div
            initial={{ y: -500, rotateX: -90 }}
            animate={{ y: 0, rotateX: 0 }}
            exit={{ y: -500, rotateX: -90 }}
            transition={{
              type: "spring",
              damping: 20,
              stiffness: 200,
            }}
            className="relative"
            style={{ transformStyle: "preserve-3d" }}
          >
            {/* Banner card */}
            <div
              className="relative overflow-hidden rounded-2xl border-4 px-16 py-12 shadow-2xl"
              style={{
                borderColor: isGold ? "#facc15" : colors.primary,
                background: isGold
                  ? "linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)"
                  : `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
                boxShadow: isGold
                  ? "0 0 80px #fbbf2488, 0 20px 60px rgba(0,0,0,0.5)"
                  : `0 0 60px ${colors.primary}66, 0 20px 60px rgba(0,0,0,0.5)`,
              }}
            >
              {/* Animated border glow */}
              <motion.div
                animate={{
                  opacity: [0.5, 1, 0.5],
                  scale: [1, 1.05, 1],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: isGold
                    ? "radial-gradient(circle at center, #fbbf2444, transparent)"
                    : `radial-gradient(circle at center, ${colors.glow}44, transparent)`,
                }}
              />

              {/* Content */}
              <div className="relative z-10 text-center">
                {/* Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    delay: 0.3,
                    type: "spring",
                    damping: 15,
                  }}
                  className="mb-6 flex justify-center"
                >
                  {isGold ? (
                    <div className="rounded-full bg-white/20 p-6 backdrop-blur-sm">
                      <Crown className="h-16 w-16 text-white drop-shadow-lg" />
                    </div>
                  ) : (
                    <div className="rounded-full bg-white/20 p-6 backdrop-blur-sm">
                      <Trophy className="h-16 w-16 text-white drop-shadow-lg" />
                    </div>
                  )}
                </motion.div>

                {/* Text */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                >
                  <h1
                    className="mb-2 font-black uppercase tracking-wider drop-shadow-lg"
                    style={{
                      fontSize: "3.5rem",
                      color: "white",
                      textShadow: "0 4px 20px rgba(0,0,0,0.5)",
                      fontFamily: "system-ui, -apple-system, sans-serif",
                    }}
                  >
                    {isGold ? "GOLD STAGE" : "STAGE CLEAR"}
                  </h1>

                  <div
                    className="mb-4 font-bold uppercase tracking-wide text-white/90 drop-shadow-md"
                    style={{
                      fontSize: "1.5rem",
                    }}
                  >
                    Stage {stageNumber}: {stageName}
                  </div>

                  {isGold && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.6 }}
                      className="mt-4 rounded-full bg-white/30 px-6 py-2 text-sm font-bold uppercase tracking-wider text-white backdrop-blur-sm"
                    >
                      ✨ Perfect Completion
                    </motion.div>
                  )}
                </motion.div>
              </div>

              {/* Shine effect */}
              <motion.div
                initial={{ x: "-100%", opacity: 0 }}
                animate={{ x: "200%", opacity: [0, 1, 0] }}
                transition={{
                  duration: 1.5,
                  delay: 0.2,
                  ease: "easeInOut",
                }}
                className="absolute inset-y-0 w-32"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)",
                  transform: "skewX(-20deg)",
                }}
              />
            </div>

            {/* Bottom ribbons */}
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="flex justify-center gap-8"
              style={{ originY: 0 }}
            >
              <div
                className="h-24 w-8 rounded-b-lg"
                style={{
                  background: isGold
                    ? "linear-gradient(to bottom, #fbbf24, #d97706)"
                    : `linear-gradient(to bottom, ${colors.primary}, ${colors.secondary})`,
                }}
              />
              <div
                className="h-24 w-8 rounded-b-lg"
                style={{
                  background: isGold
                    ? "linear-gradient(to bottom, #fbbf24, #d97706)"
                    : `linear-gradient(to bottom, ${colors.primary}, ${colors.secondary})`,
                }}
              />
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
