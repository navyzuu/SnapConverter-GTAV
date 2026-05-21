'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { extractJpegFromSnapmatic, blobToObjectURL } from '@/lib/snapmatic';
import { enhance, terminateWorker } from '@/lib/enhance';
import type { EnhanceParams, UpscaleFactor } from '@/lib/enhance';

export type Stage = 'idle' | 'validating' | 'converting' | 'preview' | 'enhancing' | 'result' | 'downloaded' | 'error';

export interface FileEntry {
  id: string;
  originalFile: File;
  rawBlob: Blob;
  rawUrl: string;
  enhancedBlob: Blob | null;
  enhancedUrl: string | null;
  name: string;
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
  const urlsToRevoke = useRef<string[]>([]);

  const revokeAll = useCallback(() => {
    urlsToRevoke.current.forEach((u) => URL.revokeObjectURL(u));
    urlsToRevoke.current = [];
  }, []);

  useEffect(() => {
    return () => {
      revokeAll();
      terminateWorker();
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

    const tasks = validFiles.map((file) => async (): Promise<FileEntry> => {
      const buffer = await file.arrayBuffer();
      const blob = extractJpegFromSnapmatic(buffer);
      const url = blobToObjectURL(blob);
      urlsToRevoke.current.push(url);
      completed++;
      setProgress(Math.round((completed / validFiles.length) * 100));
      const baseName = file.name.replace(/\.[^.]+$/, '') || file.name;
      return {
        id: `${file.name}-${file.lastModified}`,
        originalFile: file,
        rawBlob: blob,
        rawUrl: url,
        enhancedBlob: null,
        enhancedUrl: null,
        name: baseName,
      };
    });

    try {
      const results = await runPool(tasks, CONCURRENCY);
      setFiles(results);
      setStage('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setStage('error');
    }
  }, []);

  const applyEnhancement = useCallback(
    async (params: Omit<EnhanceParams, 'imageData'>) => {
      if (files.length === 0) return;
      setStage('enhancing');

      try {
        const updated: FileEntry[] = [];
        for (const file of files) {
          const imageData = await imageDataFromBlob(file.rawBlob);
          const result = await enhance({ ...params, imageData });
          const blob = await imageDataToJpegBlob(result.imageData);
          if (file.enhancedUrl) {
            URL.revokeObjectURL(file.enhancedUrl);
          }
          const url = blobToObjectURL(blob);
          urlsToRevoke.current.push(url);
          updated.push({ ...file, enhancedBlob: blob, enhancedUrl: url });
        }
        setFiles(updated);
        setStage('result');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Enhancement failed');
        setStage('error');
      }
    },
    [files]
  );

  const downloadSingle = useCallback(
    async (entry: FileEntry) => {
      const blob = entry.enhancedBlob ?? entry.rawBlob;
      const suffix = entry.enhancedBlob ? '_enhanced.jpg' : '_converted.jpg';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${entry.name}${suffix}`;
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
    files.forEach((f) => {
      const blob = f.enhancedBlob ?? f.rawBlob;
      const suffix = f.enhancedBlob ? '_enhanced.jpg' : '_converted.jpg';
      zip.file(`${f.name}${suffix}`, blob);
    });
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
    handleFiles,
    applyEnhancement,
    downloadSingle,
    downloadAll,
    reset,
  };
}
