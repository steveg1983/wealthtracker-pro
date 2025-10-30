import React, { type ReactNode } from 'react';
import { motion, AnimatePresence, type Transition } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import { useNavigationLoading } from './useNavigationLoading';

interface PageTransitionProps {
  children: ReactNode;
  mode?: PageTransitionMode;
}

type PageTransitionMode = 'fade' | 'slide' | 'scale';

interface TransitionDefinition {
  initial: Record<string, number>;
  animate: Record<string, number>;
  exit: Record<string, number>;
  transition: Transition;
}

const transitions: Record<PageTransitionMode, TransitionDefinition> = {
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
      type: 'spring',
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

export function PageTransition({ children, mode = 'fade' }: PageTransitionProps): React.JSX.Element {
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
export function NavigationProgress(): React.JSX.Element | null {
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
