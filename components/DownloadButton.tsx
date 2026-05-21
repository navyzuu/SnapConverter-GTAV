'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import type { FileEntry } from '@/hooks/useFileProcessor';

interface DownloadButtonProps {
  files: FileEntry[];
  onDownload: () => void;
}

export default function DownloadButton({ files, onDownload }: DownloadButtonProps) {
  const [done, setDone] = useState(false);
  const checkRef = useRef<SVGPathElement>(null);

  useEffect(() => {
    setDone(false);
  }, [files]);

  useEffect(() => {
    if (done && checkRef.current) {
      const length = checkRef.current.getTotalLength();
      gsap.set(checkRef.current, { strokeDasharray: length, strokeDashoffset: length });
      gsap.to(checkRef.current, {
        strokeDashoffset: 0,
        duration: 0.5,
        ease: 'power2.out',
      });
    }
  }, [done]);

  const handleClick = useCallback(async () => {
    if (done) return;
    await onDownload();
    setDone(true);
  }, [done, onDownload]);

  const label = files.length > 1
    ? `Save ${files.length} files as ZIP`
    : 'Save as JPEG';

  return (
    <button
      className="btn-cta"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem',
        borderColor: done ? 'var(--accent-3)' : 'var(--accent-1)',
      }}
      onClick={handleClick}
      disabled={done}
    >
      {done ? (
        <>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              ref={checkRef}
              d="M2 7l3.5 3.5L12 3"
              stroke="var(--accent-1)"
              strokeWidth="1.5"
              strokeLinecap="square"
            />
          </svg>
          <span style={{ color: 'var(--accent-1)' }}>Downloaded</span>
        </>
      ) : (
        <span>{label}</span>
      )}
    </button>
  );
}
