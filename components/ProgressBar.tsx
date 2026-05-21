'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface ProgressBarProps {
  progress: number;
  label?: string;
}

export default function ProgressBar({ progress, label = 'PROCESSING...' }: ProgressBarProps) {
  const fillRef = useRef<HTMLDivElement>(null);
  const counterRef = useRef<{ val: number }>({ val: 0 });
  const displayRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!fillRef.current || !displayRef.current) return;

    gsap.to(fillRef.current, {
      width: `${progress}%`,
      duration: 0.4,
      ease: 'power1.out',
    });

    gsap.to(counterRef.current, {
      val: progress,
      duration: 0.4,
      snap: { val: 1 },
      onUpdate: () => {
        if (displayRef.current) {
          displayRef.current.textContent = String(Math.round(counterRef.current.val));
        }
      },
    });
  }, [progress]);

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-space-mono), monospace',
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-space-mono), monospace',
            fontSize: '0.7rem',
            letterSpacing: '0.08em',
            color: 'var(--accent-1)',
          }}
        >
          <span ref={displayRef}>0</span>%
        </span>
      </div>
      <div
        style={{
          width: '100%',
          height: '2px',
          background: 'var(--border-accent)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <div
          ref={fillRef}
          className="progress-fill"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: '0%',
            background: 'var(--accent-1)',
          }}
        />
      </div>
    </div>
  );
}
