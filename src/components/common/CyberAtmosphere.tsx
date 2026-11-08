import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../theme/ThemeContext.js';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
}

const PARTICLE_COLORS = ['#22D3EE', '#7C3AED', '#F0ABFC', '#60A5FA'];

/**
 * Ambient Cyber-theme layer. A fixed canvas of slow-drifting nodes and links
 * sits behind the application, so it shows through the translucent surfaces.
 * It is never rendered for the other palettes.
 */
export const CyberAtmosphere: React.FC = () => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme !== 'cyber') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationFrame = 0;
    let particles: Particle[] = [];

    const createParticles = () => {
      const target = reducedMotion ? 28 : Math.min(96, Math.max(40, Math.round((width * height) / 24000)));
      particles = Array.from({ length: target }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * (reducedMotion ? 0 : 0.18),
        vy: (Math.random() - 0.5) * (reducedMotion ? 0 : 0.18),
        radius: Math.random() * 1.6 + 0.6,
        color: PARTICLE_COLORS[Math.floor(Math.random() * PARTICLE_COLORS.length)],
      }));
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      createParticles();
      if (reducedMotion) draw();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        if (!reducedMotion) {
          particle.x += particle.vx;
          particle.y += particle.vy;
          if (particle.x < -20) particle.x = width + 20;
          if (particle.x > width + 20) particle.x = -20;
          if (particle.y < -20) particle.y = height + 20;
          if (particle.y > height + 20) particle.y = -20;
        }

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = particle.color;
        context.globalAlpha = 0.55;
        context.fill();

        for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
          const other = particles[otherIndex];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 135) continue;
          context.beginPath();
          context.moveTo(particle.x, particle.y);
          context.lineTo(other.x, other.y);
          context.strokeStyle = particle.color;
          context.globalAlpha = (1 - distance / 135) * 0.16;
          context.lineWidth = 0.7;
          context.stroke();
        }
      }

      context.globalAlpha = 1;
      if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    };

    resize();
    if (!reducedMotion) animationFrame = window.requestAnimationFrame(draw);
    window.addEventListener('resize', resize);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', resize);
    };
  }, [theme]);

  if (theme !== 'cyber') return null;

  return <canvas ref={canvasRef} className="cyber-atmosphere" aria-hidden="true" />;
};
