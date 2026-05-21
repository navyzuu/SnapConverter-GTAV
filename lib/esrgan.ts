// Worker wrapper for the ESRGAN inference worker.
// Same singleton pattern as enhance.ts.

export interface EsrganResult {
  imageData: ImageData;
}

type PendingEntry = {
  resolve: (r: EsrganResult) => void;
  reject: (e: Error) => void;
  onProgress?: (pct: number) => void;
  onStatus?: (msg: string) => void;
};

let workerInstance: Worker | null = null;
let messageId = 0;
const pending = new Map<number, PendingEntry>();

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('../workers/esrgan.worker.ts', import.meta.url)
    );

    workerInstance.onmessage = (e: MessageEvent) => {
      const data = e.data as {
        id?: number;
        type?: string;
        message?: string;
        progress?: number;
        imageData?: ImageData;
        error?: string;
      };

      // Global status messages (no id)
      if (data.type === 'status') {
        pending.forEach((p) => p.onStatus?.(data.message ?? ''));
        return;
      }

      const { id } = data;
      if (id == null) return;
      const entry = pending.get(id);
      if (!entry) return;

      if ('progress' in data && data.progress != null) {
        entry.onProgress?.(data.progress);
      } else if ('error' in data && data.error) {
        pending.delete(id);
        entry.reject(new Error(data.error));
      } else if (data.imageData) {
        pending.delete(id);
        entry.resolve({ imageData: data.imageData });
      }
    };

    workerInstance.onerror = (e) => {
      pending.forEach(({ reject }) => reject(new Error(e.message ?? 'ESRGAN worker error')));
      pending.clear();
    };
  }
  return workerInstance;
}

export interface EsrganOptions {
  onProgress?: (pct: number) => void;
  onStatus?: (msg: string) => void;
}

export function esrganEnhance(
  imageData: ImageData,
  options: EsrganOptions = {}
): Promise<EsrganResult> {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pending.set(id, { resolve, reject, ...options });
    getWorker().postMessage({ id, imageData }, [imageData.data.buffer]);
  });
}

export function terminateEsrganWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    pending.clear();
    messageId = 0;
  }
}
