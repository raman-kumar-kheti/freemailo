"use client";

import React from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  Variants,
} from "framer-motion";

interface StepTransitionProps {
  stepKey: number | string;
  direction: number;
  children: React.ReactNode;
  onAnimationComplete?: () => void;
  className?: string;
}

const EASING: [number, number, number, number] = [0.4, 0, 0.2, 1];

export const fieldVariants: Variants = {
  hidden: (reduced: boolean) => ({
    opacity: 0,
    y: reduced ? 0 : 12,
  }),
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: EASING,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
};

export function StepTransition({
  stepKey,
  direction,
  children,
  onAnimationComplete,
  className = "",
}: StepTransitionProps) {
  const prefersReducedMotion = useReducedMotion();

  const containerVariants: Variants = {
    enter: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? 36 : -36,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: {
          duration: 0.3,
          ease: EASING,
        },
        opacity: {
          duration: 0.28,
          ease: EASING,
        },
        staggerChildren: prefersReducedMotion ? 0 : 0.05,
        delayChildren: 0.05,
      },
    },
    exit: (dir: number) => ({
      x: prefersReducedMotion ? 0 : dir > 0 ? -36 : 36,
      opacity: 0,
      transition: {
        x: {
          duration: 0.25,
          ease: EASING,
        },
        opacity: {
          duration: 0.2,
          ease: EASING,
        },
      },
    }),
  };

  return (
    <AnimatePresence mode="wait" custom={direction} initial={false}>
      <motion.div
        key={stepKey}
        custom={direction}
        variants={containerVariants}
        initial="enter"
        animate="center"
        exit="exit"
        onAnimationComplete={() => {
          onAnimationComplete?.();
        }}
        className={`w-full ${className}`}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

export function StaggerField({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      variants={fieldVariants}
      custom={!!prefersReducedMotion}
      className={className}
    >
      {children}
    </motion.div>
  );
}
