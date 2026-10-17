import fs from 'node:fs';
import path from 'node:path';

function createDummyJpeg() {
  const width = 960;
  const height = 536;

  // Minimal valid 1x1 or small JPEG with baseline DCT
  // A solid simple JPEG stream:
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x08,
    0x00, 0x08, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f,
    0x00, 0xbf, 0x00, 0xff, 0xd9
  ]);
}

function generateSnapmaticFile({
  filename,
  headerSize = 292,
  jsonPayload,
  title,
  description,
}) {
  const chunks = [];

  // Header prefix (292 bytes for PC)
  const header = Buffer.alloc(headerSize, 0x00);
  header.write('PHOTO-GTA5-SNAPMATIC', 0, 'utf8');
  chunks.push(header);

  // JPEG stream
  const jpeg = createDummyJpeg();
  chunks.push(jpeg);

  // JSON marker + length (int32 LE) + payload
  if (jsonPayload) {
    const jsonStr = JSON.stringify(jsonPayload);
    const jsonBuf = Buffer.from(jsonStr, 'utf8');
    const marker = Buffer.from('JSON', 'utf8');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeInt32LE(jsonBuf.length, 0);

    chunks.push(marker);
    chunks.push(lenBuf);
    chunks.push(jsonBuf);
  }

  // TITL
  if (title) {
    const titleBuf = Buffer.from(title + '\0', 'utf8');
    const marker = Buffer.from('TITL', 'utf8');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeInt32LE(titleBuf.length, 0);

    chunks.push(marker);
    chunks.push(lenBuf);
    chunks.push(titleBuf);
  }

  // DESC
  if (description) {
    const descBuf = Buffer.from(description + '\0', 'utf8');
    const marker = Buffer.from('DESC', 'utf8');
    const lenBuf = Buffer.alloc(4);
    lenBuf.writeInt32LE(descBuf.length, 0);

    chunks.push(marker);
    chunks.push(lenBuf);
    chunks.push(descBuf);
  }

  const finalBuf = Buffer.concat(chunks);
  const outPath = path.resolve('samples', filename);
  fs.writeFileSync(outPath, finalBuf);
  console.log(`Generated sample: ${outPath} (${finalBuf.length} bytes)`);
}

// 1. Vinewood Hills Sunset Selfie
generateSnapmaticFile({
  filename: 'PGTA5100010001',
  headerSize: 292,
  jsonPayload: {
    loc: { x: 712.4, y: 1198.2, z: 325.8 },
    area: 'CHIL', // Vinewood Hills
    creat: Math.floor(Date.now() / 1000) - 86400 * 2,
    plyrs: ['Franklin', 'Chop'],
    slf: true,
    drctr: false,
    onislandx: false,
    meme: false,
  },
  title: 'Vinewood Hills Sunset',
  description: 'Golden hour view from Galileo Observatory',
});

// 2. Del Perro Beach Day
generateSnapmaticFile({
  filename: 'PGTA5100020002',
  headerSize: 292,
  jsonPayload: {
    loc: { x: -1684.2, y: -1071.5, z: 13.1 },
    area: 'DELBE', // Del Perro Beach
    creat: Math.floor(Date.now() / 1000) - 86400 * 5,
    plyrs: ['Michael'],
    slf: false,
    drctr: false,
    onislandx: false,
    meme: false,
  },
  title: 'Del Perro Pier',
  description: 'Ferris wheel by the beach side',
});

// 3. Cayo Perico Island Raid
generateSnapmaticFile({
  filename: 'PGTA5100030003',
  headerSize: 292,
  jsonPayload: {
    loc: { x: 4890.1, y: -5120.3, z: 2.4 },
    area: 'ISLAND',
    creat: Math.floor(Date.now() / 1000) - 86400 * 10,
    plyrs: ['Trevor'],
    slf: false,
    drctr: true,
    onislandx: true,
    meme: false,
  },
  title: 'El Rubio Compound',
  description: 'Infiltration spot near airstrip',
});
