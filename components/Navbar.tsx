'use client';

export default function Navbar() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4"
      style={{
        borderBottom: '1px solid var(--border)',
        background: 'rgba(10,10,10,0.85)',
        backdropFilter: 'blur(12px)',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: '0.875rem',
          letterSpacing: '0.15em',
          color: 'var(--text-primary)',
          textTransform: 'uppercase',
        }}
      >
        SNAP<span style={{ color: 'var(--accent-1)' }}>CONVERT</span>
      </span>
      <span
        style={{
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: '0.7rem',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
        }}
      >
        GTA V / SNAPMATIC CONVERTER
      </span>
    </nav>
  );
}
