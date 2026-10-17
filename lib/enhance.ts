export type UpscaleFactor = 1 | 2 | 4 | 8;

export interface EnhanceParams {
  imageData: ImageData;
  upscale: UpscaleFactor;
  sharpen: number;
  brightness: number;
  contrast: number;
  noiseReduction: boolean;
  saturation: number;
  gloss?: number;
  grain?: number;
}

export interface EnhanceResult {
  imageData: ImageData;
}

let workerInstance: Worker | null = null;
let messageId = 0;
const pendingMessages = new Map<number, { resolve: (r: EnhanceResult) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!workerInstance) {
    workerInstance = new Worker(
      new URL('../workers/enhance.worker.ts', import.meta.url)
    );
    workerInstance.onmessage = (e: MessageEvent<{ id: number; imageData: ImageData } | { id: number; error: string }>) => {
      const { id } = e.data;
      const pending = pendingMessages.get(id);
      if (!pending) return;
      pendingMessages.delete(id);

      if ('error' in e.data) {
        pending.reject(new Error(e.data.error));
      } else {
        pending.resolve({ imageData: e.data.imageData });
      }
    };
    workerInstance.onerror = (e) => {
      pendingMessages.forEach(({ reject }) => reject(new Error(e.message)));
      pendingMessages.clear();
    };
  }
  return workerInstance;
}

export function enhance(params: EnhanceParams): Promise<EnhanceResult> {
  return new Promise((resolve, reject) => {
    const id = ++messageId;
    pendingMessages.set(id, { resolve, reject });
    const worker = getWorker();
    const { imageData, ...rest } = params;
    worker.postMessage({ id, imageData, ...rest }, [imageData.data.buffer]);
  });
}

export function terminateWorker(): void {
  if (workerInstance) {
    workerInstance.terminate();
    workerInstance = null;
    pendingMessages.clear();
  }
}
