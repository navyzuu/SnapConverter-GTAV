'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import gsap from 'gsap';
import { Draggable } from 'gsap/Draggable';

gsap.registerPlugin(Draggable);

interface BeforeAfterProps {
  beforeUrl: string;
  afterUrl: string;
}

type ViewMode = 'split' | 'toggle' | 'side-by-side';

export default function BeforeAfter({ beforeUrl, afterUrl }: BeforeAfterProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLDivElement>(null);
  const beforeLayerRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [isShowingBefore, setIsShowingBefore] = useState(false);

  const initDraggable = useCallback(() => {
    if (!containerRef.current || !handleRef.current || !beforeLayerRef.current) return;
    const container = containerRef.current;

    const draggable = Draggable.create(handleRef.current, {
      type: 'x',
      bounds: container,
      onDrag() {
        const containerWidth = container.offsetWidth;
        const localX = this.x + containerWidth / 2;
        const newPct = Math.min(100, Math.max(0, (localX / containerWidth) * 100));
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
      draggable[0]?.kill();
    };
  }, []);

  useEffect(() => {
    if (viewMode === 'split') {
      const cleanup = initDraggable();
      return cleanup;
    }
  }, [viewMode, initDraggable, beforeUrl, afterUrl]);

  const isEnhanced = beforeUrl !== afterUrl;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {/* Comparison Mode Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-surface)',
          padding: '0.4rem 0.6rem',
          border: '1px solid var(--border)',
          fontSize: '0.7rem',
          fontFamily: 'var(--font-space-mono), monospace',
        }}
      >
        <span style={{ color: 'var(--text-muted)' }}>VIEW MODE:</span>
        <div style={{ display: 'flex', gap: '0.35rem' }}>
          <button
            className={`btn-secondary ${viewMode === 'split' ? 'active' : ''}`}
            onClick={() => setViewMode('split')}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.65rem' }}
          >
            Split Slider
          </button>
          <button
            className={`btn-secondary ${viewMode === 'toggle' ? 'active' : ''}`}
            onClick={() => setViewMode('toggle')}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.65rem' }}
          >
            Full Compare
          </button>
          <button
            className={`btn-secondary ${viewMode === 'side-by-side' ? 'active' : ''}`}
            onClick={() => setViewMode('side-by-side')}
            style={{ padding: '0.25rem 0.6rem', fontSize: '0.65rem' }}
          >
            Side-by-Side
          </button>
        </div>
      </div>

      {/* Mode 1: Split Slider */}
      {viewMode === 'split' && (
        <div
          ref={containerRef}
          style={{
            position: 'relative',
            width: '100%',
            overflow: 'hidden',
            background: 'var(--bg-primary)',
            userSelect: 'none',
            border: '1px solid var(--border)',
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
              background: 'rgba(10,10,10,0.8)',
              border: '1px solid var(--border)',
              padding: '0.25rem 0.5rem',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            BEFORE (ORIGINAL)
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
              background: 'rgba(10,10,10,0.8)',
              border: '1px solid var(--border)',
              padding: '0.25rem 0.5rem',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            AFTER (ENHANCED)
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
      )}

      {/* Mode 2: Full Compare (Hold / Click to toggle between original & enhanced) */}
      {viewMode === 'toggle' && (
        <div
          style={{
            position: 'relative',
            width: '100%',
            cursor: 'pointer',
            border: '1px solid var(--border)',
            userSelect: 'none',
          }}
          onClick={() => setIsShowingBefore((prev) => !prev)}
          onMouseDown={() => setIsShowingBefore(true)}
          onMouseUp={() => setIsShowingBefore(false)}
          onTouchStart={() => setIsShowingBefore(true)}
          onTouchEnd={() => setIsShowingBefore(false)}
        >
          <img
            src={isShowingBefore ? beforeUrl : afterUrl}
            alt={isShowingBefore ? 'Original' : 'Enhanced'}
            style={{ display: 'block', width: '100%', height: 'auto', pointerEvents: 'none' }}
          />

          <div
            style={{
              position: 'absolute',
              top: '0.75rem',
              left: '0.75rem',
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: '0.7rem',
              letterSpacing: '0.12em',
              color: isShowingBefore ? 'var(--text-primary)' : 'var(--accent-1)',
              background: 'rgba(10,10,10,0.85)',
              border: `1px solid ${isShowingBefore ? 'var(--border)' : 'var(--accent-1)'}`,
              padding: '0.35rem 0.65rem',
              pointerEvents: 'none',
            }}
          >
            {isShowingBefore ? 'VIEWING: ORIGINAL' : 'VIEWING: ENHANCED'}
          </div>

          <div
            style={{
              position: 'absolute',
              bottom: '0.75rem',
              left: '50%',
              transform: 'translateX(-50%)',
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: '0.65rem',
              color: 'var(--text-primary)',
              background: 'rgba(10,10,10,0.8)',
              padding: '0.2rem 0.6rem',
              borderRadius: 0,
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            Press & hold or click to flip before / after
          </div>
        </div>
      )}

      {/* Mode 3: Side-by-Side */}
      {viewMode === 'side-by-side' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div style={{ position: 'relative', border: '1px solid var(--border)' }}>
            <span
              style={{
                position: 'absolute',
                top: '0.5rem',
                left: '0.5rem',
                fontFamily: 'var(--font-space-mono), monospace',
                fontSize: '0.6rem',
                background: 'rgba(10,10,10,0.85)',
                color: 'var(--text-primary)',
                padding: '0.2rem 0.4rem',
              }}
            >
              ORIGINAL
            </span>
            <img src={beforeUrl} alt="Original" style={{ width: '100%', display: 'block', height: 'auto' }} />
          </div>

          <div style={{ position: 'relative', border: '1px solid var(--accent-1)' }}>
            <span
              style={{
                position: 'absolute',
                top: '0.5rem',
                left: '0.5rem',
                fontFamily: 'var(--font-space-mono), monospace',
                fontSize: '0.6rem',
                background: 'rgba(10,10,10,0.85)',
                color: 'var(--accent-1)',
                padding: '0.2rem 0.4rem',
              }}
            >
              ENHANCED
            </span>
            <img src={afterUrl} alt="Enhanced" style={{ width: '100%', display: 'block', height: 'auto' }} />
          </div>
        </div>
      )}

      {/* Clarification guide */}
      <div
        style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          💡 Note: Geser slider atau pilih <strong>Full Compare</strong> untuk melihat seluruh frame foto.
        </span>
        {!isEnhanced && (
          <span style={{ color: 'var(--accent-1)' }}>
            Raw extracted view (Apply preset to see enhancement)
          </span>
        )}
      </div>
    </div>
  );
}
