'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  parseSnapmatic,
  generateSnapmaticFilename,
  blobToObjectURL,
} from '@/lib/snapmatic';
import type { SnapmaticMetadata } from '@/lib/snapmatic';
import { injectExifIntoJpeg } from '@/lib/exif';
import { enhance, terminateWorker } from '@/lib/enhance';
import type { EnhanceParams, UpscaleFactor } from '@/lib/enhance';
import { esrganEnhance, terminateEsrganWorker } from '@/lib/esrgan';
import type { ExtendedEnhanceParams } from '@/components/EnhancementPanel';

export type Stage = 'idle' | 'validating' | 'converting' | 'preview' | 'enhancing' | 'result' | 'downloaded' | 'error';

export interface FileEntry {
  id: string;
  originalFile: File;
  rawBlob: Blob;
  rawUrl: string;
  enhancedBlob: Blob | null;
  enhancedUrl: string | null;
  name: string;
  metadata?: SnapmaticMetadata;
  warnings?: string[];
  suggestedFilename?: string;
}

export interface ProcessorState {
  stage: Stage;
  files: FileEntry[];
  error: string | null;
  progress: number;
}

const CONCURRENCY = 5;

function runPool<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const results: T[] = [];
    let index = 0;
    let running = 0;
    let done = 0;

    function next() {
      while (running < concurrency && index < tasks.length) {
        const currentIndex = index++;
        running++;
        tasks[currentIndex]()
          .then((result) => {
            results[currentIndex] = result;
            running--;
            done++;
            if (done === tasks.length) resolve(results);
            else next();
          })
          .catch(reject);
      }
    }
    next();
  });
}

function imageDataFromBlob(blob: Blob): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not available')); return; }
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, canvas.width, canvas.height));
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

function imageDataToJpegBlob(imageData: ImageData, quality = 0.95): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) { reject(new Error('Canvas not available')); return; }
    ctx.putImageData(imageData, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('toBlob failed'));
      },
      'image/jpeg',
      quality
    );
  });
}

export function useFileProcessor() {
  const [stage, setStage] = useState<Stage>('idle');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [aiStatus, setAiStatus] = useState<string | undefined>(undefined);
  const urlsToRevoke = useRef<string[]>([]);

  const revokeAll = useCallback(() => {
    urlsToRevoke.current.forEach((u) => URL.revokeObjectURL(u));
    urlsToRevoke.current = [];
  }, []);

  useEffect(() => {
    return () => {
      revokeAll();
      terminateWorker();
      terminateEsrganWorker();
    };
  }, [revokeAll]);

  const handleFiles = useCallback(async (rawFiles: File[]) => {
    if (rawFiles.length === 0) return;
    setStage('validating');
    setError(null);
    setProgress(0);

    const validFiles = rawFiles.filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return !ext || !['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
    });

    if (validFiles.length === 0) {
      setError('No valid Snapmatic files selected. Files must not have image extensions.');
      setStage('error');
      return;
    }

    setStage('converting');
    let completed = 0;
    const errors: string[] = [];

    const tasks = validFiles.map((file) => async (): Promise<FileEntry | null> => {
      try {
        const buffer = await file.arrayBuffer();
        const parseResult = parseSnapmatic(buffer);
        const url = blobToObjectURL(parseResult.jpegBlob);
        urlsToRevoke.current.push(url);
        completed++;
        setProgress(Math.round((completed / validFiles.length) * 100));
        const baseName = file.name.replace(/\.[^.]+$/, '') || file.name;
        const suggestedFilename = generateSnapmaticFilename(parseResult.metadata, file.name);
        return {
          id: `${file.name}-${file.lastModified}-${Math.random().toString(36).substring(2, 7)}`,
          originalFile: file,
          rawBlob: parseResult.jpegBlob,
          rawUrl: url,
          enhancedBlob: null,
          enhancedUrl: null,
          name: baseName,
          metadata: parseResult.metadata,
          warnings: parseResult.warnings,
          suggestedFilename,
        };
      } catch (err) {
        completed++;
        setProgress(Math.round((completed / validFiles.length) * 100));
        errors.push(`${file.name}: ${err instanceof Error ? err.message : 'Invalid Snapmatic format'}`);
        return null;
      }
    });

    try {
      const settled = await runPool(tasks, CONCURRENCY);
      const successful = settled.filter((item): item is FileEntry => item !== null);

      if (successful.length === 0) {
        setError(errors.join(' | ') || 'All selected files failed to parse.');
        setStage('error');
        return;
      }

      setFiles(successful);
      if (errors.length > 0) {
        setError(`Converted ${successful.length} of ${validFiles.length} files. Skipped corrupt files: ${errors.join(', ')}`);
      }
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setStage('error');
    }
  }, []);

  const applyEnhancement = useCallback(
    async (params: ExtendedEnhanceParams) => {
      if (files.length === 0) return;
      setStage('enhancing');
      setAiStatus(undefined);

      try {
        const updated: FileEntry[] = [];
        const isAi = params.upscale === 'ai';

        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          let imageData = await imageDataFromBlob(file.rawBlob);

          if (isAi) {
            // Phase 1: ESRGAN 4x upscale
            const esrganResult = await esrganEnhance(imageData, {
              onProgress: (pct) => {
                const fileOffset = i / files.length;
                const fileShare  = 1 / files.length;
                setProgress(Math.round((fileOffset + fileShare * pct / 100) * 100));
              },
              onStatus: (msg) => setAiStatus(msg),
            });
            imageData = esrganResult.imageData;

            // Phase 2: canvas post-process (sharpen/brightness/contrast/saturation) at upscale=1
            const canvasParams: EnhanceParams = {
              ...params,
              upscale: 1 as UpscaleFactor,
              imageData,
            };
            const canvasResult = await enhance(canvasParams);
            imageData = canvasResult.imageData;
          } else {
            // Normal canvas-only path (upscale is a numeric UpscaleFactor here)
            const { upscale, ...restParams } = params;
            const result = await enhance({ ...restParams, upscale: upscale as UpscaleFactor, imageData });
            imageData = result.imageData;
          }

          const blob = await imageDataToJpegBlob(imageData);
          if (file.enhancedUrl) URL.revokeObjectURL(file.enhancedUrl);
          const url = blobToObjectURL(blob);
          urlsToRevoke.current.push(url);
          updated.push({ ...file, enhancedBlob: blob, enhancedUrl: url });
        }

        setFiles(updated);
        setAiStatus(undefined);
        setStage('result');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Enhancement failed');
        setAiStatus(undefined);
        setStage('error');
      }
    },
    [files]
  );

  const downloadSingle = useCallback(
    async (entry: FileEntry) => {
      const sourceBlob = entry.enhancedBlob ?? entry.rawBlob;
      let finalBlob = sourceBlob;

      // Bake EXIF if metadata available
      if (entry.metadata) {
        try {
          const arrayBuf = await sourceBlob.arrayBuffer();
          const withExif = injectExifIntoJpeg(new Uint8Array(arrayBuf), entry.metadata);
          finalBlob = new Blob([withExif.buffer as ArrayBuffer], { type: 'image/jpeg' });
        } catch {
          // Graceful fallback to original blob
        }
      }

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      a.href = url;
      if (entry.suggestedFilename) {
        const base = entry.suggestedFilename.replace(/\.jpg$/i, '');
        a.download = entry.enhancedBlob ? `${base}_enhanced.jpg` : `${base}.jpg`;
      } else {
        const suffix = entry.enhancedBlob ? '_enhanced.jpg' : '_converted.jpg';
        a.download = `${entry.name}${suffix}`;
      }
      a.click();
      URL.revokeObjectURL(url);
    },
    []
  );

  const downloadAll = useCallback(async () => {
    if (files.length === 1) {
      downloadSingle(files[0]);
      setStage('downloaded');
      return;
    }
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    const manifest = {
      app: 'SnapConverter-GTAV',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      totalFiles: files.length,
      photos: [] as Record<string, unknown>[],
    };

    for (const f of files) {
      const sourceBlob = f.enhancedBlob ?? f.rawBlob;
      let finalBlob = sourceBlob;

      if (f.metadata) {
        try {
          const buf = await sourceBlob.arrayBuffer();
          const withExif = injectExifIntoJpeg(new Uint8Array(buf), f.metadata);
          finalBlob = new Blob([withExif.buffer as ArrayBuffer], { type: 'image/jpeg' });
        } catch {
          // Fallback
        }
      }

      let filename = `${f.name}${f.enhancedBlob ? '_enhanced.jpg' : '_converted.jpg'}`;
      if (f.suggestedFilename) {
        const base = f.suggestedFilename.replace(/\.jpg$/i, '');
        filename = f.enhancedBlob ? `${base}_enhanced.jpg` : `${base}.jpg`;
      }
      zip.file(filename, finalBlob);

      manifest.photos.push({
        filename,
        originalSnapmatic: f.originalFile.name,
        area: f.metadata?.areaName || f.metadata?.area || 'Unknown',
        coordinates: f.metadata?.loc || null,
        timestamp: f.metadata?.createdAt?.toISOString() || null,
        title: f.metadata?.title || null,
        description: f.metadata?.description || null,
        isSelfie: f.metadata?.isSelfie || false,
        isDirector: f.metadata?.isDirector || false,
        players: f.metadata?.players || [],
      });
    }

    // Embed metadata manifest JSON into ZIP
    zip.file('snapmatic_manifest.json', JSON.stringify(manifest, null, 2));

    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'snapconvert_batch.zip';
    a.click();
    URL.revokeObjectURL(url);
    setStage('downloaded');
  }, [files, downloadSingle]);

  const reset = useCallback(() => {
    revokeAll();
    terminateWorker();
    terminateEsrganWorker();
    setFiles([]);
    setError(null);
    setProgress(0);
    setStage('idle');
  }, [revokeAll]);

  return {
    stage,
    files,
    error,
    progress,
    aiStatus,
    handleFiles,
    applyEnhancement,
    downloadSingle,
    downloadAll,
    reset,
  };
}
