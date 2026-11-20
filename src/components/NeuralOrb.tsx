import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react';

interface NeuralOrbProps {
  running: boolean;
  /** Network sync, 0-100. Modulates rotation speed and core-glow strength. */
  sync: number;
}

const MAX_PARTICLES = 680;
const MIN_PARTICLES = 220;
const BASE_ROTATION = 0.25; // rad/s
const GOLDEN_ANGLE = Math.PI * (1 + Math.sqrt(5));

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Deterministic per-particle radius factor (no Math.random — stable across renders). */
function particleRadius(i: number): number {
  return 0.35 + ((((i * 37) % 89) + 89) % 89) / 89 * 0.9;
}

export default function NeuralOrb({ running, sync }: NeuralOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);
  const tiltRef = useRef({ x: 0, y: 0 });
  const targetTiltRef = useRef({ x: 0, y: 0 });
  const syncRef = useRef(sync);
  syncRef.current = sync;
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    let count = 0;
    // Precomputed unit-sphere points, flat [x, y, z, r] per particle.
    let points = new Float32Array(0);
    // Reused projected buffer, flat [x, y, z] per particle — no per-frame allocation.
    let projected = new Float32Array(0);

    const buildPoints = (n: number) => {
      points = new Float32Array(n * 4);
      projected = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const phi = Math.acos(1 - (2 * (i + 0.5)) / n);
        const theta = GOLDEN_ANGLE * i;
        const sinPhi = Math.sin(phi);
        points[i * 4] = sinPhi * Math.cos(theta);
        points[i * 4 + 1] = Math.cos(phi);
        points[i * 4 + 2] = sinPhi * Math.sin(theta);
        points[i * 4 + 3] = particleRadius(i);
      }
    };

    const resize = (): boolean => {
      const cw = canvas.clientWidth;
      const ch = canvas.clientHeight;
      if (cw <= 0 || ch <= 0) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cw;
      h = ch;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const nextCount = clamp(Math.floor((cw * ch) / 900), MIN_PARTICLES, MAX_PARTICLES);
      if (nextCount !== count) {
        count = nextCount;
        buildPoints(count);
      }
      return true;
    };

    const draw = (timeSec: number) => {
      if (w <= 0 || h <= 0 || count === 0) return;
      const cx = w / 2;
      const cy = h / 2;
      // Radius breathes ±3% on a ~6s sine.
      const pulse = 1 + 0.03 * Math.sin((timeSec * Math.PI * 2) / 6);
      const rad = Math.min(w, h) * 0.37 * pulse;
      const syncFactor = clamp(syncRef.current, 0, 100) / 100;

      ctx.clearRect(0, 0, w, h);

      // Core glow, additive pass only.
      const glow = ctx.createRadialGradient(cx, cy, rad * 0.15, cx, cy, rad * 1.15);
      glow.addColorStop(0, `rgba(18, 122, 150, ${0.05 + syncFactor * 0.05})`);
      glow.addColorStop(0.75, 'rgba(16, 130, 160, 0.08)');
      glow.addColorStop(1, 'rgba(4, 10, 20, 0)');
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'source-over';

      // Faint outer ring.
      ctx.strokeStyle = 'rgba(91, 190, 220, 0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, rad * 1.02, 0, Math.PI * 2);
      ctx.stroke();

      // Rotate (Y by angle + tiltY, then X by tiltX) and project into the reused buffer.
      const angle = angleRef.current;
      const tiltX = tiltRef.current.x;
      const tiltY = tiltRef.current.y;
      const cosA = Math.cos(angle + tiltY);
      const sinA = Math.sin(angle + tiltY);
      const cosT = Math.cos(tiltX);
      const sinT = Math.sin(tiltX);
      for (let i = 0; i < count; i++) {
        const px = points[i * 4];
        const py = points[i * 4 + 1];
        const pz = points[i * 4 + 2];
        const x1 = px * cosA - pz * sinA;
        const z1 = px * sinA + pz * cosA;
        const y1 = py * cosT - z1 * sinT;
        const z2 = py * sinT + z1 * cosT;
        projected[i * 3] = cx + x1 * rad;
        projected[i * 3 + 1] = cy + y1 * rad;
        projected[i * 3 + 2] = z2;
      }

      // Connection lines: only i % 3 === 0 against a fixed offset neighbour.
      const threshold = rad * 0.24;
      for (let i = 0; i < count; i += 3) {
        const j = (i + 17) % count;
        const dx = projected[i * 3] - projected[j * 3];
        const dy = projected[i * 3 + 1] - projected[j * 3 + 1];
        if (dx * dx + dy * dy < threshold * threshold) {
          const z = projected[i * 3 + 2];
          ctx.strokeStyle = `rgba(56, 190, 220, ${0.08 + (z + 1) * 0.06})`;
          ctx.lineWidth = 0.55;
          ctx.beginPath();
          ctx.moveTo(projected[i * 3], projected[i * 3 + 1]);
          ctx.lineTo(projected[j * 3], projected[j * 3 + 1]);
          ctx.stroke();
        }
      }

      // Particles, back-to-front in two passes (no per-frame sort/allocation).
      for (let pass = 0; pass < 2; pass++) {
        for (let i = 0; i < count; i++) {
          const z = projected[i * 3 + 2];
          if ((pass === 0) !== (z <= 0)) continue;
          const r = points[i * 4 + 3];
          ctx.fillStyle =
            z > 0.25
              ? `rgba(115, 225, 239, ${0.25 + (z + 1) * 0.3})`
              : `rgba(91, 143, 194, ${0.12 + (z + 1) * 0.18})`;
          ctx.beginPath();
          ctx.arc(projected[i * 3], projected[i * 3 + 1], r * (0.7 + (z + 1) * 0.4), 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    if (!resize()) {
      // Zero-size canvas: wait for the ResizeObserver to size us.
    }

    let raf = 0;
    let stopped = true;
    let last = 0;

    const start = () => {
      if (!stopped || reduced) return;
      if (!runningRef.current || document.hidden) return;
      stopped = false;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const stop = () => {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(raf);
    };

    const tick = (now: number) => {
      if (stopped) return;
      // Delta-time, clamped to 50ms, so rotation speed is frame-rate independent.
      const dt = Math.min(now - last, 50);
      last = now;
      const syncFactor = clamp(syncRef.current, 0, 100) / 100;
      angleRef.current += BASE_ROTATION * (0.7 + syncFactor * 0.6) * (dt / 1000);
      // Ease tilt toward its pointer target.
      const k = Math.min(1, dt / 120);
      tiltRef.current.x += (targetTiltRef.current.x - tiltRef.current.x) * k;
      tiltRef.current.y += (targetTiltRef.current.y - tiltRef.current.y) * k;
      draw(now / 1000);
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const ro = new ResizeObserver(() => {
      if (resize()) {
        // Keep a static frame correct when paused / reduced-motion.
        if (reduced || stopped) draw(performance.now() / 1000);
      }
    });
    ro.observe(canvas);

    if (reduced) {
      // prefers-reduced-motion: one static frame, never animate.
      draw(0);
    } else {
      start();
    }

    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
      ro.disconnect();
    };
    // Re-run when `running` flips so the loop starts/stops promptly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'touch') return;
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const nx = (e.clientX - rect.left) / rect.width - 0.5;
    const ny = (e.clientY - rect.top) / rect.height - 0.5;
    targetTiltRef.current = {
      x: clamp(-ny * 0.7, -0.35, 0.35),
      y: clamp(nx * 0.7, -0.35, 0.35),
    };
  };

  const onPointerLeave = () => {
    targetTiltRef.current = { x: 0, y: 0 };
  };

  return (
    <canvas
      ref={canvasRef}
      className="orb"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    />
  );
}
