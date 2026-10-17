'use client';

import { useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import gsap from 'gsap';
import ProgressBar from './ProgressBar';
import type { Stage } from '@/hooks/useFileProcessor';

interface DropZoneProps {
  onFiles: (files: File[]) => void;
  stage: Stage;
  progress: number;
  error: string | null;
  onReset: () => void;
}

export default function DropZone({ onFiles, stage, progress, error, onReset }: DropZoneProps) {
  const zoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!zoneRef.current) return;
    gsap.to(zoneRef.current, {
      scale: 1.02,
      borderColor: 'var(--accent-1)',
      boxShadow: '0 0 40px rgba(232,255,71,0.15)',
      duration: 0.3,
      ease: 'power2.out',
    });
  }, []);

  const handleDragLeave = useCallback(() => {
    if (!zoneRef.current) return;
    gsap.to(zoneRef.current, {
      scale: 1,
      borderColor: 'var(--border)',
      boxShadow: '0 0 0px rgba(232,255,71,0)',
      duration: 0.3,
      ease: 'power2.out',
    });
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      handleDragLeave();

      const items = e.dataTransfer.items;
      const files: File[] = [];

      if (items && items.length > 0) {
        const queue: FileSystemEntry[] = [];
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry?.();
          if (entry) queue.push(entry);
        }

        const readEntry = async (entry: FileSystemEntry): Promise<void> => {
          if (entry.isFile) {
            const fileEntry = entry as FileSystemFileEntry;
            await new Promise<void>((resolve) => {
              fileEntry.file((file) => {
                files.push(file);
                resolve();
              }, () => resolve());
            });
          } else if (entry.isDirectory) {
            const dirEntry = entry as FileSystemDirectoryEntry;
            const dirReader = dirEntry.createReader();
            const readEntriesBatch = (): Promise<FileSystemEntry[]> => {
              return new Promise((resolve) => {
                dirReader.readEntries((entries) => resolve(entries), () => resolve([]));
              });
            };

            let batch: FileSystemEntry[];
            do {
              batch = await readEntriesBatch();
              for (const child of batch) {
                await readEntry(child);
              }
            } while (batch.length > 0);
          }
        };

        for (const entry of queue) {
          await readEntry(entry);
        }
      }

      if (files.length === 0) {
        files.push(...Array.from(e.dataTransfer.files));
      }

      onFiles(files);
    },
    [handleDragLeave, onFiles]
  );

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      onFiles(files);
      e.target.value = '';
    },
    [onFiles]
  );

  const isIdle = stage === 'idle' || stage === 'error';
  const isProcessing = stage === 'validating' || stage === 'converting';

  return (
    <div
      ref={zoneRef}
      className="dropzone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => isIdle && inputRef.current?.click()}
      style={{
        border: `1px dashed ${error ? 'var(--accent-2)' : 'var(--border)'}`,
        borderRadius: 0,
        padding: '3rem 2rem',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        minHeight: '200px',
        cursor: isIdle ? 'crosshair' : 'default',
        transition: 'border-color 0.3s ease',
        background: 'var(--bg-surface)',
        position: 'relative',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        onChange={handleChange}
        style={{ display: 'none' }}
      />

      {isProcessing && (
        <div style={{ width: '100%', maxWidth: '400px' }}>
          <ProgressBar progress={progress} />
        </div>
      )}

      {!isProcessing && !error && (
        <>
          <div
            style={{
              width: '40px',
              height: '40px',
              border: '1px solid var(--border-accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-1)" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p
              style={{
                fontFamily: 'var(--font-space-mono), monospace',
                fontSize: '0.875rem',
                letterSpacing: '0.08em',
                color: 'var(--text-primary)',
                margin: 0,
              }}
            >
              Drop your files
            </p>
            <p
              style={{
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: '0.8rem',
                color: 'var(--text-muted)',
                margin: '0.25rem 0 0',
              }}
            >
              Drop Snapmatic files or Rockstar profile folder — zero upload, 100% private
            </p>
          </div>
        </>
      )}

      {error && (
        <div style={{ textAlign: 'center' }}>
          <p
            style={{
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: '0.8rem',
              letterSpacing: '0.05em',
              color: 'var(--accent-2)',
              margin: '0 0 0.75rem',
            }}
          >
            {error}
          </p>
          <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); onReset(); }}>
            <span>Try again</span>
          </button>
        </div>
      )}
    </div>
  );
}
