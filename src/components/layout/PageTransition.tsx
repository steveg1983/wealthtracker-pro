import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useNavigationLoading } from '../../hooks/useNavigationLoading';

interface PageTransitionProps {
  children: ReactNode;
  mode?: 'fade' | 'slide' | 'scale';
}

const transitions = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.2 }
  },
  slide: {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 30,
      duration: 0.2
    }
  },
  scale: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 1.05, opacity: 0 },
    transition: { duration: 0.2 }
  }
};

export function PageTransition({ children, mode = 'fade' }: PageTransitionProps) {
  const location = useLocation();
  const transition = transitions[mode];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={transition.initial}
        animate={transition.animate}
        exit={transition.exit}
        transition={transition.transition}
        className="h-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Navigation progress bar
export function NavigationProgress() {
  const isNavigating = useNavigationLoading();

  if (!isNavigating) return null;

  return (
    <motion.div
      initial={{ scaleX: 0 }}
      animate={{ scaleX: 1 }}
      transition={{ duration: 0.3 }}
      className="fixed top-0 left-0 right-0 h-1 bg-primary z-50 origin-left"
    />
  );
}
