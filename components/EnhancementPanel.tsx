'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { EnhanceParams, UpscaleFactor } from '@/lib/enhance';

gsap.registerPlugin(ScrollTrigger);

type PresetKey = 'original' | 'cinematic' | 'vivid' | 'clean' | 'vinewood' | 'noir' | 'desert';
export type UpscaleOption = UpscaleFactor | 'ai';

interface Params {
  brightness: number;
  contrast: number;
  sharpen: number;
  noiseReduction: boolean;
  upscale: UpscaleOption;
  saturation: number;
}

const PRESETS: Record<PresetKey, Params> = {
  original:  { brightness: 0,   contrast: 0,  sharpen: 0,  noiseReduction: false, upscale: 1, saturation: 100 },
  cinematic: { brightness: -5,  contrast: 25, sharpen: 5,  noiseReduction: false, upscale: 2, saturation: 95  },
  vivid:     { brightness: 5,   contrast: 20, sharpen: 6,  noiseReduction: false, upscale: 2, saturation: 140 },
  clean:     { brightness: 0,   contrast: 10, sharpen: 4,  noiseReduction: false, upscale: 2, saturation: 100 },
  vinewood:  { brightness: 8,   contrast: 30, sharpen: 5,  noiseReduction: false, upscale: 2, saturation: 130 },
  noir:      { brightness: -10, contrast: 45, sharpen: 7,  noiseReduction: false, upscale: 2, saturation: 0   },
  desert:    { brightness: 12,  contrast: 20, sharpen: 4,  noiseReduction: false, upscale: 2, saturation: 115 },
};

export type ExtendedEnhanceParams = Omit<EnhanceParams, 'imageData' | 'upscale'> & { upscale: UpscaleOption };

interface EnhancementPanelProps {
  onApply: (params: ExtendedEnhanceParams) => void;
  isEnhancing: boolean;
  aiStatus?: string;
}

export default function EnhancementPanel({ onApply, isEnhancing, aiStatus }: EnhancementPanelProps) {
  const [activePreset, setActivePreset] = useState<PresetKey>('original');
  const [params, setParams] = useState<Params>(PRESETS.original);
  const [expanded, setExpanded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const spinnerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!panelRef.current) return;
    const ctx = gsap.context(() => {
      gsap.from('.enhancement-option', {
        opacity: 0,
        x: -30,
        stagger: 0.08,
        duration: 0.5,
        ease: 'power2.out',
        scrollTrigger: {
          trigger: panelRef.current,
          start: 'top 80%',
        },
      });
    }, panelRef.current);
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!spinnerRef.current) return;
    if (isEnhancing) {
      gsap.to(spinnerRef.current, { rotation: 360, duration: 0.8, repeat: -1, ease: 'none' });
    } else {
      gsap.killTweensOf(spinnerRef.current);
      gsap.set(spinnerRef.current, { rotation: 0 });
    }
  }, [isEnhancing]);

  const selectPreset = useCallback((key: PresetKey) => {
    setActivePreset(key);
    setParams(PRESETS[key]);
  }, []);

  const handleParamChange = useCallback((update: Partial<Params>) => {
    setActivePreset('original');
    setParams((prev) => {
      const next = { ...prev, ...update };
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onApply(next);
      }, 300);
      return next;
    });
  }, [onApply]);

  const handleApply = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    onApply(params);
  }, [onApply, params]);

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-space-mono), monospace',
    fontSize: '0.7rem',
    letterSpacing: '0.08em',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    display: 'block',
    marginBottom: '0.4rem',
  };

  return (
    <div
      ref={panelRef}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        padding: '1.5rem',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-space-mono), monospace',
          fontSize: '0.7rem',
          letterSpacing: '0.15em',
          color: 'var(--text-muted)',
          margin: '0 0 1rem',
          textTransform: 'uppercase',
        }}
      >
        Make it sharper.
      </p>

      {/* Preset buttons */}
      <div className="enhancement-option" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(80px, 1fr))', gap: '0.4rem', marginBottom: '1rem' }}>
        {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
          <button
            key={key}
            className={`btn-secondary ${activePreset === key ? 'active' : ''}`}
            onClick={() => selectPreset(key)}
            disabled={isEnhancing}
            style={{ padding: '0.4rem 0.6rem', textAlign: 'center', fontSize: '0.65rem' }}
          >
            {key === 'vinewood' ? 'Sunset' : key === 'noir' ? 'LS Noir' : key === 'desert' ? 'Desert' : key.charAt(0).toUpperCase() + key.slice(1)}
          </button>
        ))}
      </div>

      {/* Manual controls toggle */}
      <button
        className="enhancement-option btn-secondary"
        style={{ marginBottom: expanded ? '1rem' : '0', width: '100%', textAlign: 'left' }}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? '— Manual controls' : '+ Manual controls'}
      </button>

      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Upscale */}
          <div className="enhancement-option">
            <span style={labelStyle}>Upscale Mode (Pure Fidelity)</span>
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {([1, 2, 4, 8] as UpscaleFactor[]).map((v) => (
                <button
                  key={v}
                  className={`btn-secondary ${params.upscale === v ? 'active' : ''}`}
                  onClick={() => handleParamChange({ upscale: v })}
                  disabled={isEnhancing}
                  style={{ fontSize: '0.7rem', padding: '0.35rem 0.6rem' }}
                >
                  {v === 1 ? '1x (Raw)' : `${v}x Pure`}
                </button>
              ))}
              <button
                className={`btn-secondary ${params.upscale === 'ai' ? 'active' : ''}`}
                onClick={() => handleParamChange({ upscale: 'ai' })}
                disabled={isEnhancing}
                title="Real-ESRGAN General Photo v3 (Tencent ARC photorealistic model)"
                style={{ fontSize: '0.7rem', padding: '0.35rem 0.6rem' }}
              >
                AI 4x (Photo)
              </button>
            </div>
            {params.upscale === 'ai' ? (
              <p style={{ ...labelStyle, marginTop: '0.4rem', marginBottom: 0, color: 'var(--accent-1)' }}>
                {aiStatus ?? 'Real-ESRGAN Photo v3: Tencent neural network trained on real-world photos & textures.'}
              </p>
            ) : (
              <p style={{ ...labelStyle, marginTop: '0.4rem', marginBottom: 0, color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                Pure Fidelity: Upscales resolution while preserving natural grain, vehicle reflections, and asphalt texture.
              </p>
            )}
          </div>

          {/* Sharpen / Texture Clarity */}
          <div className="enhancement-option">
            <span style={labelStyle}>Texture Clarity (Sharpen) — {params.sharpen}</span>
            <input
              type="range"
              min={0}
              max={10}
              value={params.sharpen}
              onChange={(e) => handleParamChange({ sharpen: Number(e.target.value) })}
              disabled={isEnhancing}
            />
          </div>

          {/* Brightness */}
          <div className="enhancement-option">
            <span style={labelStyle}>Brightness — {params.brightness > 0 ? `+${params.brightness}` : params.brightness}</span>
            <input
              type="range"
              min={-50}
              max={50}
              value={params.brightness}
              onChange={(e) => handleParamChange({ brightness: Number(e.target.value) })}
              disabled={isEnhancing}
            />
          </div>

          {/* Contrast */}
          <div className="enhancement-option">
            <span style={labelStyle}>Contrast — {params.contrast > 0 ? `+${params.contrast}` : params.contrast}</span>
            <input
              type="range"
              min={-50}
              max={50}
              value={params.contrast}
              onChange={(e) => handleParamChange({ contrast: Number(e.target.value) })}
              disabled={isEnhancing}
            />
          </div>

          {/* Saturation */}
          <div className="enhancement-option">
            <span style={labelStyle}>Saturation — {params.saturation}%</span>
            <input
              type="range"
              min={0}
              max={200}
              value={params.saturation}
              onChange={(e) => handleParamChange({ saturation: Number(e.target.value) })}
              disabled={isEnhancing}
            />
          </div>

          {/* Noise reduction */}
          <div className="enhancement-option" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className={`btn-secondary ${params.noiseReduction ? 'active' : ''}`}
              onClick={() => handleParamChange({ noiseReduction: !params.noiseReduction })}
              disabled={isEnhancing}
              style={{ minWidth: '48px' }}
            >
              {params.noiseReduction ? 'ON' : 'OFF'}
            </button>
            <span style={{ ...labelStyle, marginBottom: 0 }}>Deblock + Denoise</span>
          </div>
        </div>
      )}

      {/* Apply button */}
      <button
        className="btn-cta enhancement-option"
        style={{ marginTop: '1.5rem', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        onClick={handleApply}
        disabled={isEnhancing}
      >
        {isEnhancing && (
          <div
            ref={spinnerRef}
            style={{
              width: '12px',
              height: '12px',
              border: '1.5px solid var(--bg-primary)',
              borderTopColor: 'transparent',
              borderRadius: '50%',
            }}
          />
        )}
        <span>{isEnhancing ? 'Processing...' : 'Apply Enhancement'}</span>
      </button>
    </div>
  );
}
