'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';

gsap.registerPlugin(Draggable);

interface BeforeAfterProps {
  beforeUrl: string;
  afterUrl: string;
}

export default function BeforeAfter({ beforeUrl, afterUrl }: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const beforeLayerRef = useRef<HTMLDivElement>(null);
  const [pct, setPct] = useState(50);

  useEffect(() => {
    if (!containerRef.current || !handleRef.current || !beforeLayerRef.current) return;

    const container = containerRef.current;

    const draggable = Draggable.create(handleRef.current, {
      type: 'x',
      bounds: container,
      onDrag() {
        const containerWidth = container.offsetWidth;
        const localX = this.x + containerWidth / 2;
        const newPct = Math.min(100, Math.max(0, (localX / containerWidth) * 100));
        setPct(newPct);
        if (beforeLayerRef.current) {
          gsap.set(beforeLayerRef.current, {
            clipPath: `inset(0 ${100 - newPct}% 0 0)`,
          });
        }
      },
    });

    // Set initial position
    gsap.set(handleRef.current, { x: 0 });
    gsap.set(beforeLayerRef.current, { clipPath: 'inset(0 50% 0 0)' });

    return () => {
      draggable[0].kill();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        background: 'var(--bg-primary)',
        userSelect: 'none',
      }}
    >
      {/* After (base layer) */}
      <img
        src={afterUrl}
        alt="After"
        style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none' }}
        draggable={false}
      />

      {/* Before (clipped layer) */}
      <div
        ref={beforeLayerRef}
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: 'inset(0 50% 0 0)',
        }}
      >
        <img
          src={beforeUrl}
          alt="Before"
          style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
          draggable={false}
        />
      </div>

      {/* Labels */}
      <span
        style={{
          position: 'absolute',
          top: '0.75rem',
          left: '0.75rem',
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: '0.65rem',
          letterSpacing: '0.15em',
          color: 'var(--text-primary)',
          background: 'rgba(10,10,10,0.7)',
          padding: '0.2rem 0.4rem',
          pointerEvents: 'none',
        }}
      >
        BEFORE
      </span>
      <span
        style={{
          position: 'absolute',
          top: '0.75rem',
          right: '0.75rem',
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: '0.65rem',
          letterSpacing: '0.15em',
          color: 'var(--accent-1)',
          background: 'rgba(10,10,10,0.7)',
          padding: '0.2rem 0.4rem',
          pointerEvents: 'none',
        }}
      >
        AFTER
      </span>

      {/* Slider handle */}
      <div
        ref={handleRef}
        className="slider-handle"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: '50%',
          width: '1px',
          background: 'var(--accent-1)',
          cursor: 'ew-resize',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            background: 'var(--accent-1)',
            border: '2px solid var(--bg-primary)',
            borderRadius: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="var(--bg-primary)">
            <path d="M3 1L1 5l2 4M7 1l2 4-2 4" stroke="var(--bg-primary)" strokeWidth="1.5" fill="none" />
          </svg>
        </div>
      </div>
    </div>
  );
}
