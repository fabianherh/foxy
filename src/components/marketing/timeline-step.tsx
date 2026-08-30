"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function TimelineStep({ index, title, artifact, showArrow = false, children }: {
  index: number;
  title: string;
  artifact?: React.ReactNode;
  showArrow?: boolean;
  children: React.ReactNode;
}) {
  const reducedMotion = useReducedMotion();
  return (
    <motion.article
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.4 }}
      transition={{ duration: 0.6, delay: index * 0.14, ease: easeOut }}
    >
      <span>{String(index + 1).padStart(2, "0")}</span>
      <motion.i
        className="step-draw"
        aria-hidden="true"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: reducedMotion ? 0 : 0.9, delay: index * 0.14 + 0.25, ease: easeOut }}
      />
      <h3>{title}</h3>
      <p>{children}</p>
      {artifact && <div className="step-artifact">{artifact}</div>}
      {showArrow && (
        <svg className="step-arrow" aria-hidden="true" width="22" height="14" viewBox="0 0 22 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 7h18M14 1.5L20 7l-6 5.5" />
        </svg>
      )}
    </motion.article>
  );
}
