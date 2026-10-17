'use client';

import type { SnapmaticMetadata } from '@/lib/snapmatic';

interface MetadataInspectorProps {
  metadata?: SnapmaticMetadata;
  warnings?: string[];
  filename: string;
}

export default function MetadataInspector({ metadata, warnings, filename }: MetadataInspectorProps) {
  if (!metadata) {
    return (
      <div
        style={{
          border: '1px solid var(--border)',
          background: 'var(--bg-surface)',
          padding: '1rem',
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
        }}
      >
        [NO SNAPMATIC METADATA FOUND]
      </div>
    );
  }

  const {
    loc,
    areaName,
    area,
    createdAt,
    players,
    isSelfie,
    isDirector,
    isMugshot,
    isCayoPerico,
    isMeme,
    title,
    description,
  } = metadata;

  return (
    <div
      style={{
        border: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-space-mono), monospace',
      }}
    >
      {/* Header HUD */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '0.5rem',
        }}
      >
        <span style={{ color: 'var(--accent-1)', fontWeight: 600, letterSpacing: '0.08em' }}>
          LOS SANTOS HUD // SNAPMATIC
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
          {isCayoPerico ? 'CAYO PERICO' : 'SAN ANDREAS'}
        </span>
      </div>

      {/* Title / Description if available */}
      {(title || description) && (
        <div style={{ background: 'var(--bg-elevated)', padding: '0.5rem', borderLeft: '2px solid var(--accent-1)' }}>
          {title && <div style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{title}</div>}
          {description && <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '0.2rem' }}>{description}</div>}
        </div>
      )}

      {/* Grid Specs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '0.5rem',
        }}
      >
        <div>
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem' }}>DISTRICT / AREA</span>
          <span style={{ color: 'var(--text-primary)' }}>{areaName || area || 'Unknown'}</span>
          {area && area !== areaName && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', marginLeft: '0.3rem' }}>({area})</span>
          )}
        </div>

        <div>
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem' }}>TIMESTAMP</span>
          <span style={{ color: 'var(--text-primary)' }}>
            {createdAt ? createdAt.toLocaleDateString() : 'N/A'}
          </span>
          {createdAt && (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.65rem', display: 'block' }}>
              {createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
        </div>
      </div>

      {/* 3D Coordinates Vector */}
      {loc && (
        <div
          style={{
            padding: '0.5rem',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-accent)',
          }}
        >
          <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.65rem', marginBottom: '0.25rem' }}>
            WORLD VECTOR (X, Y, Z)
          </span>
          <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--accent-1)' }}>
            <span>X: {loc.x.toFixed(1)}</span>
            <span>Y: {loc.y.toFixed(1)}</span>
            <span>Z: {loc.z.toFixed(1)}</span>
          </div>
        </div>
      )}

      {/* Camera & Gameplay Tags */}
      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {isSelfie && (
          <span style={{ padding: '0.2rem 0.4rem', background: 'rgba(232,255,71,0.1)', color: 'var(--accent-1)', border: '1px solid var(--accent-1)', fontSize: '0.65rem' }}>
            SELFIE MODE
          </span>
        )}
        {isDirector && (
          <span style={{ padding: '0.2rem 0.4rem', background: 'rgba(255,75,75,0.1)', color: 'var(--accent-2)', border: '1px solid var(--accent-2)', fontSize: '0.65rem' }}>
            DIRECTOR MODE
          </span>
        )}
        {isMugshot && (
          <span style={{ padding: '0.2rem 0.4rem', background: 'rgba(160,160,160,0.1)', color: 'var(--text-primary)', border: '1px solid var(--text-muted)', fontSize: '0.65rem' }}>
            MUGSHOT
          </span>
        )}
        {isMeme && (
          <span style={{ padding: '0.2rem 0.4rem', background: 'rgba(232,255,71,0.1)', color: 'var(--accent-1)', border: '1px solid var(--border)', fontSize: '0.65rem' }}>
            MEME
          </span>
        )}
      </div>

      {/* Players Tag */}
      {players && players.length > 0 && (
        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
          PLAYERS: <span style={{ color: 'var(--text-primary)' }}>{players.join(', ')}</span>
        </div>
      )}

      {/* Warnings indicator if any */}
      {warnings && warnings.length > 0 && (
        <div style={{ color: 'var(--accent-2)', fontSize: '0.65rem', borderTop: '1px dashed var(--border)', paddingTop: '0.4rem' }}>
          ⚠ {warnings.join(' ')}
        </div>
      )}
    </div>
  );
}
