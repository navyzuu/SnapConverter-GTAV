'use client';

import { useState } from 'react';
import BeforeAfter from './BeforeAfter';
import EnhancementPanel from './EnhancementPanel';
import DownloadButton from './DownloadButton';
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
            }}
          >
            {files.map((f, i) => (
              <button
                key={f.id}
                className={`btn-secondary ${i === selectedIndex ? 'active' : ''}`}
                onClick={() => setSelectedIndex(i)}
              >
                {f.name.length > 16 ? f.name.slice(0, 14) + '…' : f.name}
              </button>
            ))}
          </div>
        )}

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

      {/* Right: controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <EnhancementPanel onApply={onApplyEnhancement} isEnhancing={isEnhancing} aiStatus={aiStatus} />
        <DownloadButton files={files} onDownload={onDownload} />
      </div>
    </div>
  );
}
