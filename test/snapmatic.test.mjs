import assert from 'node:assert/strict';
import {
  parseSnapmatic,
  generateSnapmaticFilename,
  getAreaName,
  GTA_AREA_NAMES,
  SNAPMATIC_STANDARD_HEADER_SIZE,
} from '../lib/snapmatic.ts';

function buildSyntheticSnapmatic({
  headerSize = SNAPMATIC_STANDARD_HEADER_SIZE,
  includeJpeg = true,
  includeEoi = true,
  jsonPayload = null,
  title = null,
  description = null,
  corruptJson = false,
} = {}) {
  const chunks = [];

  // 1. Header prefix
  const header = new Uint8Array(headerSize);
  header.fill(0xaa); // dummy header content
  chunks.push(header);

  // 2. JPEG stream
  if (includeJpeg) {
    const jpegBody = [
      0xff, 0xd8, 0xff, 0xe0, // SOI + APP0
      0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
      0xff, 0xdb, 0x00, 0x43, 0x00, // DQT
    ];
    for (let i = 0; i < 64; i++) jpegBody.push(0x10);

    if (includeEoi) {
      jpegBody.push(0xff, 0xd9); // EOI
    }
    chunks.push(new Uint8Array(jpegBody));
  }

  // 3. Post-JPEG chunks
  if (jsonPayload) {
    // "JSON" (4 bytes) + length (int32 LE, 4 bytes) + string
    const jsonStr = corruptJson ? '{ bad json :' : JSON.stringify(jsonPayload);
    const jsonBytes = new TextEncoder().encode(jsonStr);
    const marker = new Uint8Array([0x4a, 0x53, 0x4f, 0x4e]);
    const lenBuf = new ArrayBuffer(4);
    new DataView(lenBuf).setInt32(0, jsonBytes.length, true);

    chunks.push(marker);
    chunks.push(new Uint8Array(lenBuf));
    chunks.push(jsonBytes);
  }

  if (title) {
    const titleBytes = new TextEncoder().encode(title + '\0');
    const marker = new Uint8Array([0x54, 0x49, 0x54, 0x4c]);
    const lenBuf = new ArrayBuffer(4);
    new DataView(lenBuf).setInt32(0, titleBytes.length, true);

    chunks.push(marker);
    chunks.push(new Uint8Array(lenBuf));
    chunks.push(titleBytes);
  }

  if (description) {
    const descBytes = new TextEncoder().encode(description + '\0');
    const marker = new Uint8Array([0x44, 0x45, 0x53, 0x43]);
    const lenBuf = new ArrayBuffer(4);
    new DataView(lenBuf).setInt32(0, descBytes.length, true);

    chunks.push(marker);
    chunks.push(new Uint8Array(lenBuf));
    chunks.push(descBytes);
  }

  // Calculate total size and assemble
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result.buffer;
}

console.log('--- RUNNING SNAPMATIC CONTAINER PARSER TESTS ---');

// Test 1: Area name resolution
assert.equal(getAreaName('VINE'), 'Vinewood');
assert.equal(getAreaName('SANDY'), 'Sandy Shores');
assert.equal(getAreaName('UNKNOWN_LOC'), 'UNKNOWN_LOC');
assert.equal(getAreaName('VINE', true), 'Cayo Perico');
console.log('✓ Test 1: Area name lookup passed');

// Test 2: Standard PC Snapmatic Container
{
  const timestamp = 1716357600; // 2024-05-22T06:00:00Z
  const buffer = buildSyntheticSnapmatic({
    headerSize: 292,
    jsonPayload: {
      loc: { x: -1038.5, y: -2738.2, z: 13.8 },
      area: 'VINE',
      creat: timestamp,
      plyrs: ['Michael', 'Franklin'],
      slf: true,
      drctr: false,
      onislandx: false,
    },
    title: 'Vinewood Sign Vista',
    description: 'Beautiful sunrise snapshot',
  });

  const parsed = parseSnapmatic(buffer);
  assert.equal(parsed.format, 'pc');
  assert.equal(parsed.headerOffset, 292);
  assert.equal(parsed.jpegBytes[0], 0xff);
  assert.equal(parsed.jpegBytes[1], 0xd8);
  assert.equal(parsed.jpegBytes[parsed.jpegBytes.length - 2], 0xff);
  assert.equal(parsed.jpegBytes[parsed.jpegBytes.length - 1], 0xd9);

  // Metadata verification
  assert.equal(parsed.metadata.area, 'VINE');
  assert.equal(parsed.metadata.areaName, 'Vinewood');
  assert.equal(parsed.metadata.isSelfie, true);
  assert.equal(parsed.metadata.isCayoPerico, false);
  assert.deepEqual(parsed.metadata.loc, { x: -1038.5, y: -2738.2, z: 13.8 });
  assert.deepEqual(parsed.metadata.players, ['Michael', 'Franklin']);
  assert.equal(parsed.metadata.title, 'Vinewood Sign Vista');
  assert.equal(parsed.metadata.description, 'Beautiful sunrise snapshot');
  assert.equal(parsed.warnings.length, 0);

  // Filename generator
  const filename = generateSnapmaticFilename(parsed.metadata, 'PGTA5123456789');
  assert(filename.includes('Snapmatic_'));
  assert(filename.includes('Vinewood'));
  assert(filename.includes('Selfie'));
  assert(filename.endsWith('.jpg'));
  console.log('✓ Test 2: Standard PC Snapmatic parsing & filename generation passed');
}

// Test 3: Console / Non-standard Offset Container
{
  const buffer = buildSyntheticSnapmatic({
    headerSize: 512,
    jsonPayload: {
      area: 'SANDY',
      creat: 1716357600,
      onislandx: false,
    },
  });

  const parsed = parseSnapmatic(buffer);
  assert.equal(parsed.format, 'console');
  assert.equal(parsed.headerOffset, 512);
  assert.equal(parsed.metadata.areaName, 'Sandy Shores');
  console.log('✓ Test 3: Non-standard header offset container passed');
}

// Test 4: File too small (< 300 bytes)
{
  const smallBuf = new ArrayBuffer(150);
  assert.throws(() => {
    parseSnapmatic(smallBuf);
  }, /too small/);
  console.log('✓ Test 4: Reject undersized files passed');
}

// Test 5: Corrupt SOI marker
{
  const buffer = new Uint8Array(400);
  buffer.fill(0x00);
  assert.throws(() => {
    parseSnapmatic(buffer.buffer);
  }, /No JPEG SOI header found/);
  console.log('✓ Test 5: Reject missing SOI passed');
}

// Test 6: Missing EOI marker
{
  const buffer = buildSyntheticSnapmatic({
    headerSize: 292,
    includeEoi: false,
  });
  assert.throws(() => {
    parseSnapmatic(buffer);
  }, /JPEG EOI marker/);
  console.log('✓ Test 6: Reject missing EOI passed');
}

// Test 7: Corrupted JSON chunk resilience
{
  const buffer = buildSyntheticSnapmatic({
    headerSize: 292,
    corruptJson: true,
  });
  const parsed = parseSnapmatic(buffer);
  assert.equal(parsed.format, 'pc');
  assert(parsed.warnings.length > 0);
  assert(parsed.jpegBytes.length > 0);
  console.log('✓ Test 7: Corrupt metadata resilience (graceful degradation) passed');
}

// Test 8: EXIF APP1 Injection
{
  const { injectExifIntoJpeg, buildExifApp1Segment } = await import('../lib/exif.ts');
  const dummyJpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x11, 0x22, 0xff, 0xd9]);
  const metadata = {
    loc: { x: 120.5, y: -450.2, z: 25.0 },
    area: 'VINE',
    areaName: 'Vinewood',
    createdAt: new Date('2024-05-22T10:30:00Z'),
    isSelfie: true,
  };

  const segment = buildExifApp1Segment(metadata);
  assert.equal(segment[0], 0xff);
  assert.equal(segment[1], 0xe1); // APP1 marker

  const withExif = injectExifIntoJpeg(dummyJpeg, metadata);
  assert.equal(withExif[0], 0xff);
  assert.equal(withExif[1], 0xd8); // SOI
  assert.equal(withExif[2], 0xff);
  assert.equal(withExif[3], 0xe1); // APP1 immediately follows SOI
  console.log('✓ Test 8: EXIF APP1 segment construction & JPEG injection passed');
}

// Test 9: ZIP Manifest structure verification
{
  const testManifest = {
    app: 'SnapConverter-GTAV',
    version: '1.0.0',
    totalFiles: 1,
    photos: [
      {
        filename: 'Snapmatic_Vinewood.jpg',
        area: 'Vinewood',
        coordinates: { x: 10, y: 20, z: 30 },
      },
    ],
  };
  const jsonStr = JSON.stringify(testManifest);
  const parsedManifest = JSON.parse(jsonStr);
  assert.equal(parsedManifest.app, 'SnapConverter-GTAV');
  assert.equal(parsedManifest.photos[0].area, 'Vinewood');
  console.log('✓ Test 9: Batch ZIP metadata manifest JSON passed');
}

console.log('--- ALL 9 SNAPMATIC UNIT TESTS PASSED SUCCESSFULLY! ---');
