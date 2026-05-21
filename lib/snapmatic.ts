export const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]);
export const JPEG_EOI = new Uint8Array([0xff, 0xd9]);

export function extractJpegFromSnapmatic(buffer: ArrayBuffer): Blob {
  const bytes = new Uint8Array(buffer);

  let startOffset = -1;
  for (let i = 0; i < bytes.length - 2; i++) {
    if (
      bytes[i] === JPEG_MAGIC[0] &&
      bytes[i + 1] === JPEG_MAGIC[1] &&
      bytes[i + 2] === JPEG_MAGIC[2]
    ) {
      startOffset = i;
      break;
    }
  }

  if (startOffset === -1) {
    throw new Error('Invalid file: JPEG header not found at any offset.');
  }

  let endOffset = -1;
  for (let i = bytes.length - 2; i >= startOffset; i--) {
    if (bytes[i] === JPEG_EOI[0] && bytes[i + 1] === JPEG_EOI[1]) {
      endOffset = i + 2;
      break;
    }
  }

  if (endOffset === -1) {
    throw new Error('Corrupt file: JPEG EOI marker not found.');
  }

  const jpegBytes = bytes.slice(startOffset, endOffset);
  return new Blob([jpegBytes], { type: 'image/jpeg' });
}

export function blobToObjectURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}
