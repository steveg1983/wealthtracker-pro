/**
 * Confetti Component - Celebration confetti effect
 *
 * Features:
 * - Animated confetti particles
 * - Customizable colors and duration
 * - Performance optimized
 * - Accessible (can be disabled)
 */

import React, { useEffect, useRef, useState } from 'react';

interface ConfettiProps {
  trigger: boolean;
  duration?: number; // milliseconds
  particleCount?: number;
  colors?: string[];
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
}

export default function Confetti({
  trigger,
  duration = 3000,
  particleCount = 50,
  colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#F97316'],
  onComplete
}: ConfettiProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!trigger || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const updateCanvasSize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);

    // Create particles
    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -10,
        vx: (Math.random() - 0.5) * 10,
        vy: Math.random() * 5 + 5,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10
      });
    }

    setIsActive(true);
    const startTime = Date.now();

    const animate = () => {
      const currentTime = Date.now();
      const elapsed = currentTime - startTime;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];

        // Update position
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.3; // gravity
        particle.rotation += particle.rotationSpeed;

        // Remove particles that are off screen
        if (particle.y > canvas.height + 20 ||
            particle.x < -20 ||
            particle.x > canvas.width + 20) {
          particles.splice(i, 1);
          continue;
        }

        // Draw particle
        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate((particle.rotation * Math.PI) / 180);
        ctx.fillStyle = particle.color;

        // Draw as a small rectangle (confetti piece)
        ctx.fillRect(-particle.size / 2, -particle.size / 4, particle.size, particle.size / 2);

        ctx.restore();
      }

      // Continue animation if within duration and particles remain
      if (elapsed < duration && particles.length > 0) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        setIsActive(false);
        onComplete?.();

        // Cleanup
        window.removeEventListener('resize', updateCanvasSize);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      }
    };

    // Start animation
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setIsActive(false);
    };
  }, [trigger, duration, particleCount, colors, onComplete]);

  if (!isActive && !trigger) {
    return <></>;
  }

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{
        opacity: isActive ? 1 : 0,
        transition: 'opacity 0.3s ease-in-out'
      }}
      aria-hidden="true"
    />
  );
}

// Hook for easier confetti usage
export function useConfetti() {
  const [trigger, setTrigger] = useState(false);

  const celebrate = () => {
    setTrigger(true);
  };

  const handleComplete = () => {
    setTrigger(false);
  };

  return {
    ConfettiComponent: () => (
      <Confetti
        trigger={trigger}
        onComplete={handleComplete}
      />
    ),
    celebrate
  };
}

// Simple confetti burst function for one-off celebrations
export function showConfetti(options?: {
  duration?: number;
  particleCount?: number;
  colors?: string[];
}): void {
  // Create a temporary container
  const container = document.createElement('div');
  document.body.appendChild(container);

  // Render confetti
  import('react-dom/client').then(({ createRoot }) => {
    const root = createRoot(container);

    const cleanup = () => {
      root.unmount();
      document.body.removeChild(container);
    };

    root.render(
      <Confetti
        trigger={true}
        duration={options?.duration}
        particleCount={options?.particleCount}
        colors={options?.colors}
        onComplete={cleanup}
      />
    );
  }).catch(() => {
    // Fallback cleanup if React DOM fails to load
    document.body.removeChild(container);
  });
}