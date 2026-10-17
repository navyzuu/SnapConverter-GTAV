'use client';

import { useCallback, useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Flip } from 'gsap/Flip';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Hero from '@/components/Hero';
import DropZone from '@/components/DropZone';
import ConversionPanel from '@/components/ConversionPanel';
import { useFileProcessor } from '@/hooks/useFileProcessor';

gsap.registerPlugin(Flip, ScrollTrigger);

export default function Home() {
  const {
    stage,
    files,
    error,
    progress,
    aiStatus,
    handleFiles,
    applyEnhancement,
    downloadAll,
    reset,
  } = useFileProcessor();

  const dropZoneRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const prevStage = useRef(stage);

  // GSAP Flip: animate layout transition when conversion panel appears
  useEffect(() => {
    if (
      prevStage.current !== stage &&
      (stage === 'preview' || stage === 'result')
    ) {
      const state = Flip.getState('.conversion-panel, .dropzone-wrapper');
      // Layout has already changed, animate from previous state
      Flip.from(state, {
        duration: 0.6,
        ease: 'expo.out',
        stagger: 0.05,
        absolute: true,
      });
    }
    prevStage.current = stage;
  }, [stage]);

  const showHero = stage === 'idle';
  const showConversion = ['preview', 'enhancing', 'result', 'downloaded'].includes(stage);

  const scrollToDropzone = useCallback(() => {
    dropZoneRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Animate dropzone entrance
  useEffect(() => {
    if (!mainRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('.dropzone-wrapper', {
        opacity: 0,
        y: 30,
        duration: 0.8,
        ease: 'power3.out',
        delay: showHero ? 0.8 : 0,
      });
    }, mainRef.current);
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      ref={mainRef}
      style={{
        minHeight: '100vh',
        paddingTop: '4rem',
      }}
    >
      {showHero && <Hero onCTAClick={scrollToDropzone} />}

      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: showHero ? '2rem 2rem 4rem' : '4rem 2rem',
        }}
      >
        {/* DropZone — always visible unless conversion is complete */}
        {!showConversion && (
          <div ref={dropZoneRef} className="dropzone-wrapper" style={{ marginBottom: '2rem' }}>
            <DropZone
              onFiles={handleFiles}
              stage={stage}
              progress={progress}
              error={error}
              onReset={reset}
            />
          </div>
        )}

        {/* Warning notification banner if some files failed but others succeeded */}
        {showConversion && error && (
          <div
            style={{
              padding: '0.75rem 1rem',
              marginBottom: '1.5rem',
              background: 'rgba(255, 75, 75, 0.1)',
              border: '1px solid var(--accent-2)',
              color: 'var(--accent-2)',
              fontSize: '0.8rem',
              fontFamily: 'var(--font-space-mono), monospace',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>⚠ {error}</span>
            <button
              onClick={() => {}}
              className="btn-secondary"
              style={{ fontSize: '0.65rem', padding: '0.2rem 0.5rem' }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Conversion Panel */}
        {showConversion && files.length > 0 && (
          <ConversionPanel
            files={files}
            stage={stage}
            onApplyEnhancement={applyEnhancement}
            onDownload={downloadAll}
            onReset={reset}
            aiStatus={aiStatus}
          />
        )}
      </div>
    </main>
  );
}
