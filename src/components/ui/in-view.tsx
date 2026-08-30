"use client";

import * as React from "react";
import { motion, useInView, useReducedMotion, type Transition, type UseInViewOptions, type Variants } from "motion/react";

const motionComponents = {
  div: motion.div,
  span: motion.span,
  p: motion.p,
  h1: motion.h1,
  h2: motion.h2,
  h3: motion.h3,
  small: motion.small,
  article: motion.article,
  section: motion.section,
  li: motion.li,
} as const;

export type InViewTag = keyof typeof motionComponents;

export type InViewProps = {
  children: React.ReactNode;
  variants?: Variants;
  transition?: Transition;
  viewOptions?: UseInViewOptions;
  as?: InViewTag;
  once?: boolean;
  className?: string;
} & Record<string, unknown>;

const defaultVariants: Variants = { hidden: { opacity: 0 }, visible: { opacity: 1 } };

export function InView({ children, variants = defaultVariants, transition, viewOptions, as = "div", once = true, className, ...rest }: InViewProps) {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once, ...viewOptions });
  const reducedMotion = useReducedMotion();
  const MotionComponent = motionComponents[as];
  const activeVariants = reducedMotion ? { hidden: { opacity: 0 }, visible: { opacity: 1 } } : variants;
  return (
    <MotionComponent ref={ref} className={className} initial="hidden" animate={isInView ? "visible" : "hidden"} variants={activeVariants} transition={transition} {...rest}>
      {children}
    </MotionComponent>
  );
}

export default InView;
