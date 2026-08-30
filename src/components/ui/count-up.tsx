"use client";

import * as React from "react";
import { animate, useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export type CountUpProps = {
  to: number;
  from?: number;
  duration?: number;
  decimals?: number;
  separator?: string;
  direction?: "up" | "down";
  className?: string;
};

export function CountUp({ to, from = 0, duration = 1.6, decimals = 0, separator = "", direction = "up", className }: CountUpProps) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: "0px 0px -12% 0px" });
  const reducedMotion = useReducedMotion();
  const start = direction === "down" ? to : from;
  const end = direction === "down" ? from : to;
  const [value, setValue] = React.useState(start);

  React.useEffect(() => {
    if (!isInView || reducedMotion) return;
    const controls = animate(start, end, { duration, ease: [0.23, 1, 0.32, 1], onUpdate: (latest) => setValue(latest) });
    return () => controls.stop();
  }, [isInView, reducedMotion, start, end, duration]);

  const displayValue = reducedMotion && isInView ? end : value;
  const formatted = React.useMemo(() => {
    const fixed = displayValue.toFixed(decimals);
    return separator ? fixed.replace(/\B(?=(\d{3})+(?!\d))/g, separator) : fixed;
  }, [displayValue, decimals, separator]);

  return <span ref={ref} className={cn("tabular-nums", className)}>{formatted}</span>;
}

export default CountUp;
