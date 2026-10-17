'use client';

import { useState, useMemo } from 'react';
import BeforeAfter from './BeforeAfter';
import EnhancementPanel from './EnhancementPanel';
import DownloadButton from './DownloadButton';
import MetadataInspector from './MetadataInspector';
import type { FileEntry, Stage } from '@/hooks/useFileProcessor';
import type { ExtendedEnhanceParams } from './EnhancementPanel';

interface ConversionPanelProps {
  files: FileEntry[];
  stage: Stage;
  onApplyEnhancement: (params: ExtendedEnhanceParams) => void;
  onDownload: () => void;
  onReset: () => void;
  aiStatus?: string;
}

export default function ConversionPanel({
  files,
  stage,
  onApplyEnhancement,
  onDownload,
  onReset,
  aiStatus,
}: ConversionPanelProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = files[selectedIndex] ?? files[0];
  const isEnhancing = stage === 'enhancing';

  if (!selected) return null;

  const beforeUrl = selected.rawUrl;
  const afterUrl = selected.enhancedUrl ?? selected.rawUrl;

  return (
    <div
      className="conversion-panel"
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 320px',
        gap: '1.5rem',
        alignItems: 'start',
      }}
    >
      {/* Left: preview */}
      <div>
          {/* File selector for batch */}
          {files.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: '0.5rem',
                marginBottom: '1rem',
                flexWrap: 'wrap',
                maxHeight: '120px',
                overflowY: 'auto',
                padding: '0.25rem',
                border: '1px solid var(--border)',
                background: 'var(--bg-surface)',
              }}
            >
              {files.map((f, i) => (
                <button
                  key={f.id}
                  className={`btn-secondary ${i === selectedIndex ? 'active' : ''}`}
                  onClick={() => setSelectedIndex(i)}
                  title={f.suggestedFilename || f.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    fontSize: '0.7rem',
                  }}
                >
                  <span>{f.metadata?.areaName || f.name}</span>
                  {f.metadata?.isSelfie && (
                    <span style={{ fontSize: '0.6rem', color: 'var(--accent-1)' }}>[SELFIE]</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Active File Info Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.5rem 0.75rem',
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              marginBottom: '0.75rem',
              fontSize: '0.75rem',
              fontFamily: 'var(--font-space-mono), monospace',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span style={{ color: 'var(--accent-1)' }}>
                {selected.suggestedFilename || `${selected.name}.jpg`}
              </span>
              {selected.metadata?.areaName && (
                <span style={{ color: 'var(--text-muted)' }}>
                  📍 {selected.metadata.areaName}
                </span>
              )}
            </div>
            {selected.metadata?.createdAt && (
              <span style={{ color: 'var(--text-muted)' }}>
                {selected.metadata.createdAt.toLocaleDateString()} {selected.metadata.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

        {/* File count badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-space-mono), monospace',
              fontSize: '0.65rem',
              letterSpacing: '0.15em',
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
            }}
          >
            {files.length} {files.length === 1 ? 'FILE' : 'FILES'} CONVERTED
          </span>
          <button
            className="btn-secondary"
            onClick={onReset}
            style={{ marginLeft: 'auto' }}
          >
            Start over
          </button>
        </div>

        <BeforeAfter beforeUrl={beforeUrl} afterUrl={afterUrl} />
      </div>

      {/* Right: controls & metadata */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <MetadataInspector
          metadata={selected.metadata}
          warnings={selected.warnings}
          filename={selected.suggestedFilename || selected.name}
        />
        <EnhancementPanel onApply={onApplyEnhancement} isEnhancing={isEnhancing} aiStatus={aiStatus} />
        <DownloadButton files={files} onDownload={onDownload} />
      </div>
    </div>
  );
}
