import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const model = (formData.get('model') as string) || 'realesrgan-x4plus';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const exePath = path.join(process.cwd(), 'tools', 'realesrgan', 'realesrgan-ncnn-vulkan.exe');
    if (!fs.existsSync(exePath)) {
      return NextResponse.json({
        error: 'Local GPU executable not found. Please ensure tools/realesrgan is installed.',
      }, { status: 503 });
    }

    const tempDir = os.tmpdir();
    const randomId = Math.random().toString(36).substring(2, 10);
    const inPath = path.join(tempDir, `snap_in_${randomId}.jpg`);
    const outPath = path.join(tempDir, `snap_out_${randomId}.jpg`);

    const arrayBuffer = await file.arrayBuffer();
    await fs.promises.writeFile(inPath, Buffer.from(arrayBuffer));

    try {
      // Execute Real-ESRGAN Vulkan GPU binary directly
      await execFileAsync(
        exePath,
        [
          '-i', inPath,
          '-o', outPath,
          '-n', model,
          '-f', 'jpg',
          '-g', 'auto',
        ],
        {
          cwd: path.dirname(exePath),
          timeout: 60000,
        }
      );

      if (!fs.existsSync(outPath)) {
        throw new Error('GPU Upscaler did not produce output file.');
      }

      const outBuffer = await fs.promises.readFile(outPath);
      return new NextResponse(outBuffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': String(outBuffer.length),
        },
      });
    } finally {
      // Cleanup temp files safely
      fs.promises.unlink(inPath).catch(() => {});
      fs.promises.unlink(outPath).catch(() => {});
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal GPU enhancement error' },
      { status: 500 }
    );
  }
}
