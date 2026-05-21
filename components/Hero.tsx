'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

interface HeroProps {
  onCTAClick: () => void;
}

export default function Hero({ onCTAClick }: HeroProps) {
  const heroRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!heroRef.current) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('.hero-label',   { opacity: 0, y: -20, duration: 0.6 })
        .from('.hero-heading', { opacity: 0, y: 40,  duration: 0.9 }, '-=0.3')
        .from('.hero-subtext', { opacity: 0, y: 20,  duration: 0.7 }, '-=0.5')
        .from('.hero-cta',     { opacity: 0, scale: 0.95, duration: 0.5 }, '-=0.3');
    }, heroRef.current);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={heroRef}
      className="dot-grid"
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6rem 2rem 4rem',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      {/* Gradient fade at bottom of dot grid */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '120px',
          background: 'linear-gradient(to bottom, transparent, var(--bg-primary))',
          pointerEvents: 'none',
        }}
      />

      <span
        className="hero-label"
        style={{
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: '0.7rem',
          letterSpacing: '0.15em',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          border: '1px solid var(--border)',
          padding: '0.3rem 0.75rem',
          marginBottom: '2rem',
          display: 'inline-block',
        }}
      >
        GTA V / Snapmatic
      </span>

      <h1
        className="hero-heading"
        style={{
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: 'clamp(2rem, 6vw, 5rem)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: 'var(--text-primary)',
          margin: '0 0 1.5rem',
          lineHeight: 1.1,
          maxWidth: '800px',
        }}
      >
        Convert your<br />
        <span style={{ color: 'var(--accent-1)' }}>GTA V photos.</span>
      </h1>

      <p
        className="hero-subtext"
        style={{
          fontFamily: 'var(--font-dm-sans), sans-serif',
          fontSize: 'clamp(0.95rem, 2vw, 1.1rem)',
          color: 'var(--accent-3)',
          margin: '0 0 2.5rem',
          maxWidth: '500px',
          lineHeight: 1.6,
        }}
      >
        Snapmatic to JPEG — local, instant, private.
        <br />
        No upload required.
      </p>

      <button className="btn-cta hero-cta" onClick={onCTAClick}>
        <span>Select Snapmatic files</span>
      </button>

      {/* Feature hints */}
      <div
        style={{
          display: 'flex',
          gap: '2rem',
          marginTop: '3rem',
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        {[
          'Client-side only',
          'Batch conversion',
          'AI-style enhancement',
          'Free, forever',
        ].map((item) => (
          <span
            key={item}
            style={{
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: '0.7rem',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            — {item}
          </span>
        ))}
      </div>
    </section>
  );
}
