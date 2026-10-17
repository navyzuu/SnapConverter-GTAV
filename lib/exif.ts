/**
 * Minimal in-memory EXIF Injector for JPEG files.
 * Injects APP1 Exif segment containing:
 * - ImageDescription (Area & Title)
 * - DateTimeOriginal (Snapmatic in-game timestamp)
 * - UserComment (Raw Snapmatic 3D Coordinates & Camera Mode)
 * - Software: SnapConverter-GTAV
 */

import type { SnapmaticMetadata } from './snapmatic';

function formatExifDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const mins = pad(d.getMinutes());
  const secs = pad(d.getSeconds());
  return `${year}:${month}:${day} ${hours}:${mins}:${secs}\0`;
}

/**
 * Creates an Exif APP1 segment (0xFFE1 + length + "Exif\0\0" + TIFF header + IFD)
 */
export function buildExifApp1Segment(metadata: SnapmaticMetadata): Uint8Array {
  const dateStr = metadata.createdAt ? formatExifDate(metadata.createdAt) : null;
  const descStr = (metadata.title ? `${metadata.title} - ` : '') + (metadata.areaName || metadata.area || 'Los Santos') + '\0';
  const softwareStr = 'SnapConverter-GTAV\0';
  
  // Format coordinate notes
  let commentStr = 'Snapmatic GTA V';
  if (metadata.loc) {
    commentStr += ` | Loc: [X:${metadata.loc.x.toFixed(1)}, Y:${metadata.loc.y.toFixed(1)}, Z:${metadata.loc.z.toFixed(1)}]`;
  }
  if (metadata.isSelfie) commentStr += ' | Mode: Selfie';
  if (metadata.isDirector) commentStr += ' | Mode: Director';
  if (metadata.isCayoPerico) commentStr += ' | Area: Cayo Perico';
  commentStr += '\0';

  const enc = new TextEncoder();
  const descBytes = enc.encode(descStr);
  const softwareBytes = enc.encode(softwareStr);
  const commentBytes = enc.encode(commentStr);
  const dateBytes = dateStr ? enc.encode(dateStr) : null;

  // Build TIFF Header + IFD0 in Little Endian (II)
  const entries: { tag: number; type: number; count: number; valueBytes: Uint8Array }[] = [];

  // 0x010E: ImageDescription (ASCII: 2)
  entries.push({ tag: 0x010e, type: 2, count: descBytes.length, valueBytes: descBytes });
  // 0x0131: Software (ASCII: 2)
  entries.push({ tag: 0x0131, type: 2, count: softwareBytes.length, valueBytes: softwareBytes });

  if (dateBytes) {
    // 0x0132: DateTime (ASCII: 2)
    entries.push({ tag: 0x0132, type: 2, count: dateBytes.length, valueBytes: dateBytes });
    // 0x9003: DateTimeOriginal (in IFD0 or ExifIFD)
    entries.push({ tag: 0x9003, type: 2, count: dateBytes.length, valueBytes: dateBytes });
  }

  // 0x9286: UserComment (UNDEFINED: 7)
  const userCommentPrefix = new Uint8Array([0x41, 0x53, 0x43, 0x49, 0x49, 0x00, 0x00, 0x00]); // ASCII\0\0\0
  const userCommentTotal = new Uint8Array(userCommentPrefix.length + commentBytes.length);
  userCommentTotal.set(userCommentPrefix, 0);
  userCommentTotal.set(commentBytes, userCommentPrefix.length);
  entries.push({ tag: 0x9286, type: 7, count: userCommentTotal.length, valueBytes: userCommentTotal });

  // Sort tags ascending for TIFF specification
  entries.sort((a, b) => a.tag - b.tag);

  // TIFF structure:
  // Offset 0: 'II' (0x4949) + 42 (0x002A) + Offset to IFD0 (4 bytes = 8)
  const numEntries = entries.length;
  const ifd0HeaderSize = 2; // entry count (uint16)
  const ifd0EntriesSize = numEntries * 12; // 12 bytes per IFD directory entry
  const ifd0NextOffsetSize = 4; // uint32 next IFD offset (0)

  let dataOffset = 8 + ifd0HeaderSize + ifd0EntriesSize + ifd0NextOffsetSize;

  // Compute total data size
  let extraDataSize = 0;
  for (const entry of entries) {
    if (entry.valueBytes.length > 4) {
      extraDataSize += entry.valueBytes.length;
    }
  }

  const tiffSize = dataOffset + extraDataSize;
  const tiffBuf = new ArrayBuffer(tiffSize);
  const tiffView = new DataView(tiffBuf);
  const tiffBytes = new Uint8Array(tiffBuf);

  // TIFF Header
  tiffView.setUint16(0, 0x4949, true); // Little endian 'II'
  tiffView.setUint16(2, 42, true); // TIFF magic 42
  tiffView.setUint32(4, 8, true); // Offset to IFD0

  // IFD0 Count
  tiffView.setUint16(8, numEntries, true);

  let currentEntryOffset = 10;
  let currentDataOffset = dataOffset;

  for (const entry of entries) {
    tiffView.setUint16(currentEntryOffset, entry.tag, true);
    tiffView.setUint16(currentEntryOffset + 2, entry.type, true);
    tiffView.setUint32(currentEntryOffset + 4, entry.count, true);

    if (entry.valueBytes.length <= 4) {
      // Inline value
      for (let b = 0; b < entry.valueBytes.length; b++) {
        tiffBytes[currentEntryOffset + 8 + b] = entry.valueBytes[b];
      }
    } else {
      // Offset pointer
      tiffView.setUint32(currentEntryOffset + 8, currentDataOffset, true);
      tiffBytes.set(entry.valueBytes, currentDataOffset);
      currentDataOffset += entry.valueBytes.length;
    }

    currentEntryOffset += 12;
  }

  // Next IFD offset is 0
  tiffView.setUint32(currentEntryOffset, 0, true);

  // APP1 Exif container:
  // Marker (2 bytes: 0xFF, 0xE1) + Length (2 bytes: BE) + "Exif\0\0" (6 bytes) + TIFF
  const exifHeader = new Uint8Array([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]); // "Exif\0\0"
  const app1PayloadSize = 2 + exifHeader.length + tiffSize; // 2 for length itself
  const app1Total = new Uint8Array(2 + app1PayloadSize);

  app1Total[0] = 0xff;
  app1Total[1] = 0xe1;
  new DataView(app1Total.buffer).setUint16(2, app1PayloadSize, false); // Big endian length
  app1Total.set(exifHeader, 4);
  app1Total.set(tiffBytes, 4 + exifHeader.length);

  return app1Total;
}

/**
 * Injects EXIF APP1 metadata into an existing JPEG byte stream
 */
export function injectExifIntoJpeg(jpegBytes: Uint8Array, metadata: SnapmaticMetadata): Uint8Array {
  if (jpegBytes.length < 4 || jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) {
    return jpegBytes; // Not a valid JPEG, return unmodified
  }

  const app1Segment = buildExifApp1Segment(metadata);

  // Insert APP1 right after SOI (0xFFD8)
  const result = new Uint8Array(jpegBytes.length + app1Segment.length);
  result.set(jpegBytes.subarray(0, 2), 0); // SOI (0xFFD8)
  result.set(app1Segment, 2); // Injected APP1 Exif
  result.set(jpegBytes.subarray(2), 2 + app1Segment.length); // Remaining JPEG

  return result;
}
