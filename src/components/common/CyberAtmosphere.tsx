import React, { useEffect, useRef } from 'react';
import { useTheme } from '../../theme/ThemeContext.js';

interface TrailPoint {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  spark: boolean;
  phase: number;
  trail: TrailPoint[];
}

interface CyberAtmosphereProps {
  force?: boolean;
  topology?: boolean;
  rich?: boolean;
  className?: string;
}

const CYBER_COLORS = ['#22D3EE', '#7C3AED', '#F0ABFC', '#60A5FA'];
const GOLD_COLORS = ['#F6C76A', '#FFD98A', '#FFE7B0'];

/**
 * Ambient Cyber-theme layer. A fixed canvas of drifting nodes and links sits
 * behind the application so it shows through the translucent surfaces.
 *
 * `force` keeps the field on outside the Cyber palette; `rich` is the login
 * variant: more particles, curved nearest-neighbour topology, flowing trails
 * and gold sparks. It is deliberately capped and only runs while visible.
 */
export const CyberAtmosphere: React.FC<CyberAtmosphereProps> = ({
  force = false,
  topology = false,
  rich = false,
  className = '',
}) => {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (theme !== 'cyber' && !force) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!context) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = window.innerWidth;
    let height = window.innerHeight;
    let animationFrame = 0;
    let particles: Particle[] = [];

    const pick = (values: string[]) => values[Math.floor(Math.random() * values.length)];

    const createParticles = () => {
      const area = width * height;
      const baseTarget = Math.min(96, Math.max(40, Math.round(area / 24000)));
      const richTarget = Math.min(140, Math.max(70, Math.round(area / 11000)));
      const target = reducedMotion ? (rich ? 44 : 28) : rich ? richTarget : baseTarget;

      particles = Array.from({ length: target }, () => {
        const spark = rich && Math.random() < 0.16;
        const angle = Math.random() * Math.PI * 2;
        const speed = reducedMotion ? 0 : (rich ? 0.12 + Math.random() * 0.3 : 0.06 + Math.random() * 0.12);
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: spark ? 1.5 + Math.random() * 1.3 : 0.7 + Math.random() * 1.6,
          color: spark ? pick(GOLD_COLORS) : pick(CYBER_COLORS),
          spark,
          phase: Math.random() * Math.PI * 2,
          trail: [],
        };
      });
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

    const drawStraightLink = (
      a: Particle,
      b: Particle,
      distance: number,
      linkDistance: number,
    ) => {
      context.beginPath();
      context.moveTo(a.x, a.y);
      context.lineTo(b.x, b.y);
      context.strokeStyle = a.color;
      context.globalAlpha = (1 - distance / linkDistance) * (topology ? 0.3 : 0.16);
      context.lineWidth = topology ? 0.8 : 0.7;
      context.stroke();
    };

    const drawCurvedLink = (
      a: Particle,
      b: Particle,
      distance: number,
      maxDistance: number,
      now: number,
      seed: number,
    ) => {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const safeDistance = Math.max(distance, 1);
      const midX = (a.x + b.x) / 2;
      const midY = (a.y + b.y) / 2;
      const normalX = -dy / safeDistance;
      const normalY = dx / safeDistance;
      const curve = Math.sin(now * 0.00022 + a.phase + b.phase) * 16 * (1 - distance / maxDistance);
      const controlX = midX + normalX * curve;
      const controlY = midY + normalY * curve;

      context.beginPath();
      context.moveTo(a.x, a.y);
      context.quadraticCurveTo(controlX, controlY, b.x, b.y);
      context.strokeStyle = seed % 13 === 0 ? GOLD_COLORS[seed % GOLD_COLORS.length] : a.color;
      context.globalAlpha = 0.08 + (1 - distance / maxDistance) * 0.28;
      context.lineWidth = 0.8;
      context.stroke();

      // A small pulse travelling along some connections.
      if (seed % 7 === 0) {
        const progress = (now * 0.00023 + a.phase * 0.17 + b.phase * 0.11) % 1;
        const oneMinus = 1 - progress;
        const pulseX = oneMinus * oneMinus * a.x + 2 * oneMinus * progress * controlX + progress * progress * b.x;
        const pulseY = oneMinus * oneMinus * a.y + 2 * oneMinus * progress * controlY + progress * progress * b.y;
        context.beginPath();
        context.arc(pulseX, pulseY, 1.5, 0, Math.PI * 2);
        context.fillStyle = '#FFE7B0';
        context.globalAlpha = 0.95;
        context.shadowBlur = 8;
        context.shadowColor = '#F6C76A';
        context.fill();
        context.shadowBlur = 0;
      }
    };

    const drawSimpleLinks = () => {
      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        for (let otherIndex = index + 1; otherIndex < particles.length; otherIndex += 1) {
          const other = particles[otherIndex];
          const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
          const linkDistance = topology ? 240 : 135;
          if (distance > linkDistance) continue;
          drawStraightLink(particle, other, distance, linkDistance);
        }
      }
    };

    const drawRichLinks = (now: number) => {
      const maxDistance = 280;
      const seen = new Set<string>();

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];
        let firstIndex = -1;
        let secondIndex = -1;
        let firstDistance = Infinity;
        let secondDistance = Infinity;

        for (let otherIndex = 0; otherIndex < particles.length; otherIndex += 1) {
          if (otherIndex === index) continue;
          const other = particles[otherIndex];
          const distance = Math.hypot(particle.x - other.x, particle.y - other.y);
          if (distance > maxDistance) continue;
          if (distance < firstDistance) {
            secondIndex = firstIndex;
            secondDistance = firstDistance;
            firstIndex = otherIndex;
            firstDistance = distance;
          } else if (distance < secondDistance) {
            secondIndex = otherIndex;
            secondDistance = distance;
          }
        }

        const nearest = [
          { index: firstIndex, distance: firstDistance },
          { index: secondIndex, distance: secondDistance },
        ];

        nearest.forEach((neighbour, rank) => {
          if (neighbour.index < 0 || !Number.isFinite(neighbour.distance)) return;
          const key = index < neighbour.index
            ? `${index}:${neighbour.index}`
            : `${neighbour.index}:${index}`;
          if (seen.has(key)) return;
          seen.add(key);
          drawCurvedLink(
            particle,
            particles[neighbour.index],
            neighbour.distance,
            maxDistance,
            now,
            index * 17 + neighbour.index * 7 + rank,
          );
        });
      }
    };

    const draw = () => {
      const now = performance.now();
      context.clearRect(0, 0, width, height);

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];

        if (!reducedMotion) {
          if (rich) {
            // Gentle flow-field breeze: particles curve instead of moving in a straight line.
            particle.vx += Math.sin(particle.y * 0.004 + now * 0.00018) * 0.004;
            particle.vy += Math.cos(particle.x * 0.004 + now * 0.00015) * 0.004;
            const speed = Math.hypot(particle.vx, particle.vy);
            const maxSpeed = 0.5;
            if (speed > maxSpeed) {
              particle.vx = (particle.vx / speed) * maxSpeed;
              particle.vy = (particle.vy / speed) * maxSpeed;
            }
          }

          particle.x += particle.vx;
          particle.y += particle.vy;
          let wrapped = false;
          if (particle.x < -20) {
            particle.x = width + 20;
            wrapped = true;
          } else if (particle.x > width + 20) {
            particle.x = -20;
            wrapped = true;
          }
          if (particle.y < -20) {
            particle.y = height + 20;
            wrapped = true;
          } else if (particle.y > height + 20) {
            particle.y = -20;
            wrapped = true;
          }

          if (rich) {
            // Do not draw a trail from the old edge to the new one after a wrap.
            if (wrapped) particle.trail = [];
            particle.trail.push({ x: particle.x, y: particle.y });
            if (particle.trail.length > 4) particle.trail.shift();
          }
        }
      }

      if (rich) {
        drawRichLinks(now);
      } else {
        drawSimpleLinks();
      }

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index];

        if (rich && particle.trail.length > 1) {
          context.beginPath();
          context.moveTo(particle.trail[0].x, particle.trail[0].y);
          for (let pointIndex = 1; pointIndex < particle.trail.length; pointIndex += 1) {
            context.lineTo(particle.trail[pointIndex].x, particle.trail[pointIndex].y);
          }
          context.strokeStyle = particle.color;
          context.globalAlpha = 0.1;
          context.lineWidth = Math.max(0.6, particle.radius * 0.65);
          context.stroke();
        }

        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fillStyle = particle.color;
        context.globalAlpha = particle.spark ? 0.95 : 0.58;
        if (particle.spark) {
          context.shadowBlur = 9;
          context.shadowColor = particle.color;
        }
        context.fill();
        context.shadowBlur = 0;
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
  }, [theme, force, topology, rich]);

  if (theme !== 'cyber' && !force) return null;

  return <canvas ref={canvasRef} className={`cyber-atmosphere ${className}`.trim()} aria-hidden="true" />;
};
