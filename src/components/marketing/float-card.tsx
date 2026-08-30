"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function FloatCard({ children, className, delay = 0, rotate = 0, floatDelay = 0 }: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  rotate?: number;
  floatDelay?: number;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.article
      className={className}
      initial={reducedMotion ? { opacity: 0, rotate } : { opacity: 0, y: 30, rotate, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, rotate, scale: 1 }}
      transition={{ duration: 0.75, delay, ease: easeOut }}
      whileHover={reducedMotion ? undefined : { y: -6, scale: 1.03 }}
    >
      <motion.div
        animate={reducedMotion ? undefined : { y: [0, -7, 0] }}
        transition={{ duration: 5.5, delay: floatDelay, repeat: Infinity, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </motion.article>
  );
}
