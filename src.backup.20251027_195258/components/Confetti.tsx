import React, { useEffect, useRef } from 'react';

interface ConfettiProps {
  isActive: boolean;
  duration?: number;
  onComplete?: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  angle: number;
  angularVelocity: number;
  size: number;
  lifetime: number;
}

const CONFETTI_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#FFD93D', '#6BCF7F'];

export default function Confetti({ isActive, duration = 3000, onComplete }: ConfettiProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize particles
    particlesRef.current = [];
    startTimeRef.current = Date.now();

    // Create initial burst of confetti
    for (let i = 0; i < 150; i++) {
      particlesRef.current.push({
        x: canvas.width / 2,
        y: canvas.height / 2,
        vx: (Math.random() - 0.5) * 15,
        vy: Math.random() * -15 - 5,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)] || '#3B82F6',
        angle: Math.random() * 360,
        angularVelocity: (Math.random() - 0.5) * 10,
        size: Math.random() * 6 + 4,
        lifetime: 1
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particlesRef.current = particlesRef.current.filter(particle => {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.5; // gravity
        particle.angle += particle.angularVelocity;
        particle.lifetime -= 0.02;

        if (particle.lifetime <= 0) return false;

        ctx.save();
        ctx.translate(particle.x, particle.y);
        ctx.rotate((particle.angle * Math.PI) / 180);
        ctx.globalAlpha = particle.lifetime;
        ctx.fillStyle = particle.color;
        ctx.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size);
        ctx.restore();

        return particle.y < canvas.height && particle.lifetime > 0;
      });

      // Check if animation should continue
      const elapsed = Date.now() - startTimeRef.current!;
      if (elapsed < duration && particlesRef.current.length > 0) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        onComplete?.();
      }
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, duration, onComplete]);

  if (!isActive) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-50"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
