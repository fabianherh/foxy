"use client";

import { motion, useReducedMotion } from "motion/react";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function SkillBar({ width, delay = 0 }: { width: number; delay?: number }) {
  const reducedMotion = useReducedMotion();
  return (
    <i>
      <motion.b
        initial={{ width: reducedMotion ? `${width}%` : "0%" }}
        whileInView={{ width: `${width}%` }}
        viewport={{ once: true, amount: 0.6 }}
        transition={{ duration: 1.1, delay, ease: easeOut }}
      />
    </i>
  );
}
