"use client";

import * as React from "react";
import { InView, type InViewTag } from "@/components/ui/in-view";

const easeOut = [0.23, 1, 0.32, 1] as const;

export function Reveal({ children, delay = 0, y = 24, blur = false, amount = 0.3, as, className, ...rest }: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
  blur?: boolean;
  amount?: number;
  as?: InViewTag;
  className?: string;
} & Record<string, unknown>) {
  return (
    <InView
      as={as}
      className={className}
      {...rest}
      variants={{
        hidden: { opacity: 0, y, ...(blur ? { filter: "blur(7px)" } : {}) },
        visible: { opacity: 1, y: 0, ...(blur ? { filter: "blur(0px)" } : {}) },
      }}
      transition={{ duration: 0.7, delay, ease: easeOut }}
      viewOptions={{ amount, margin: "0px 0px -70px 0px" }}
    >
      {children}
    </InView>
  );
}
