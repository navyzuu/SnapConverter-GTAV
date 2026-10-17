export const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff]);
export const JPEG_EOI = new Uint8Array([0xff, 0xd9]);
export const SNAPMATIC_STANDARD_HEADER_SIZE = 292;
export const SNAPMATIC_CONSOLE_HEADER_SIZE = 512;

export interface SnapmaticCoordinates {
  x: number;
  y: number;
  z: number;
}

export interface SnapmaticMetadata {
  loc?: SnapmaticCoordinates;
  area?: string;
  areaName?: string;
  createdAt?: Date;
  timestamp?: number;
  players?: string[];
  isSelfie?: boolean;
  isMugshot?: boolean;
  isDirector?: boolean;
  isRockstarEditor?: boolean;
  isCayoPerico?: boolean;
  isMeme?: boolean;
  title?: string;
  description?: string;
  uid?: number;
  crewId?: number;
  streetId?: number;
  rawJson?: Record<string, unknown>;
}

export interface SnapmaticParseResult {
  format: 'pc' | 'console' | 'unknown';
  headerOffset: number;
  jpegBlob: Blob;
  jpegBytes: Uint8Array;
  metadata: SnapmaticMetadata;
  warnings: string[];
}

// GTA V Area Code Mapping to Human-Readable Location
export const GTA_AREA_NAMES: Record<string, string> = {
  AIRP: 'Los Santos International Airport',
  LSIA: 'Los Santos International Airport',
  ALAMO: 'Alamo Sea',
  ALTA: 'Alta',
  ARMYB: 'Fort Zancudo',
  BANHAMC: 'Banham Canyon',
  BANNING: 'Banning',
  BEACH: 'Vespucci Beach',
  BHAMCA: 'Banham Canyon',
  BRADP: 'Braddock Pass',
  BRADT: 'Braddock Tunnel',
  BURTON: 'Burton',
  CALAFB: 'Calafia Bridge',
  CANNY: 'Raton Canyon',
  CCREAK: 'Cassidy Creek',
  CHAMH: 'Chamberlain Hills',
  CHIL: 'Vinewood Hills',
  CHU: 'Chumash',
  CMSW: 'Chiliad Mountain State Wilderness',
  CYPRE: 'Cypress Flats',
  DAVIS: 'Davis',
  DELBE: 'Del Perro Beach',
  DELPE: 'Del Perro',
  DELSOL: 'Puerto Del Sol',
  DESRT: 'Grand Senora Desert',
  DOWNT: 'Downtown Los Santos',
  DTVINE: 'Downtown Vinewood',
  EAST_V: 'East Vinewood',
  EBURO: 'El Burro Heights',
  ELGORL: 'El Gordo Lighthouse',
  ELYSIAN: 'Elysian Island',
  GALFISH: 'Galilee',
  GALTREE: 'Grapeseed',
  GOLF: 'GWC Golf Course',
  GRAPES: 'Grapeseed',
  GREATC: 'Great Chaparral',
  HARBOR: 'Port of Los Santos',
  HAWICK: 'Hawick',
  HORS: 'Vinewood Racetrack',
  HUMLAB: 'Humane Labs & Research',
  JAIL: 'Bolingbroke Penitentiary',
  KOREAT: 'Little Seoul',
  LACT: 'Land Act Reservoir',
  LAGO: 'Lago Zancudo',
  LDAM: 'Land Act Dam',
  LEGSQU: 'Legion Square',
  LMESA: 'La Mesa',
  LOSPUER: 'La Puerta',
  MIRR: 'Mirror Park',
  MORN: 'Morningwood',
  MOVIE: 'Richards Majestic',
  MTCHIL: 'Mount Chiliad',
  MTGORDO: 'Mount Gordo',
  MTJOSE: 'Mount Josiah',
  MURRI: 'Murrieta Heights',
  NCHU: 'North Chumash',
  NOOSE: 'N.O.O.S.E. Headquarters',
  OCEANA: 'Pacific Ocean',
  PALCOV: 'Paleto Cove',
  PALETO: 'Paleto Bay',
  PALFOR: 'Paleto Forest',
  PALHIGH: 'Palomino Highlands',
  PALMPOW: 'Palmer-Taylor Power Station',
  PBLUFF: 'Pacific Bluffs',
  PBOX: 'Pillbox Hill',
  PROCOPB: 'Procopio Beach',
  RANCHO: 'Rancho',
  RGLEN: 'Richman Glen',
  RICHM: 'Richman',
  ROCKF: 'Rockford Hills',
  RTRAK: 'Redwood Lights Track',
  SANAND: 'San Andreas',
  SANCHIA: 'San Chianski Mountain Range',
  SANDY: 'Sandy Shores',
  SKID: 'Mission Row',
  SLAB: 'Stab City',
  STAD: 'Maze Bank Arena',
  STRAW: 'Strawberry',
  TATAMO: 'Tataviam Mountains',
  TERMINA: 'Terminal',
  TEXTI: 'Textile City',
  TONGVAH: 'Tongva Hills',
  TONGVAV: 'Tongva Valley',
  VCANA: 'Vespucci Canals',
  VESP: 'Vespucci',
  VINE: 'Vinewood',
  WINDF: 'RON Alternates Wind Farm',
  WVINE: 'West Vinewood',
  ZANCUDO: 'Zancudo River',
  ZP_ORT: 'Port of South Los Santos',
  ISLAND: 'Cayo Perico',
};

export function getAreaName(areaCode?: string, isCayoPerico?: boolean): string {
  if (isCayoPerico) return 'Cayo Perico';
  if (!areaCode) return 'Los Santos';
  const cleanCode = areaCode.trim().toUpperCase();
  return GTA_AREA_NAMES[cleanCode] || cleanCode;
}

function findSequence(
  data: Uint8Array,
  target: Uint8Array,
  start: number = 0,
  maxEnd?: number
): number {
  const end = maxEnd !== undefined ? Math.min(data.length, maxEnd) : data.length;
  const targetLen = target.length;
  for (let i = start; i <= end - targetLen; i++) {
    let match = true;
    for (let j = 0; j < targetLen; j++) {
      if (data[i + j] !== target[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }
  return -1;
}

const MARKER_JSON = new Uint8Array([0x4a, 0x53, 0x4f, 0x4e]); // "JSON"
const MARKER_TITL = new Uint8Array([0x54, 0x49, 0x54, 0x4c]); // "TITL"
const MARKER_DESC = new Uint8Array([0x44, 0x45, 0x53, 0x43]); // "DESC"

function decodeNullTerminatedString(bytes: Uint8Array): string {
  let nullIdx = bytes.indexOf(0);
  if (nullIdx === -1) nullIdx = bytes.length;
  const decoder = new TextDecoder('utf-8', { fatal: false });
  return decoder.decode(bytes.subarray(0, nullIdx)).trim();
}

/**
 * Parses full GTA V Snapmatic container:
 * Extracts embedded JPEG lossless-ly & extracts complete Rage Photo metadata chunks.
 */
export function parseSnapmatic(buffer: ArrayBuffer): SnapmaticParseResult {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const warnings: string[] = [];

  if (bytes.length < 300) {
    throw new Error('Invalid file: File size is too small to be a Snapmatic photo.');
  }

  // 1. Locate JPEG Start (SOI: 0xFF, 0xD8, 0xFF)
  let format: 'pc' | 'console' | 'unknown' = 'unknown';
  let startOffset = -1;

  // Check standard PC 292-byte header first
  if (
    bytes.length > SNAPMATIC_STANDARD_HEADER_SIZE + 3 &&
    bytes[SNAPMATIC_STANDARD_HEADER_SIZE] === JPEG_MAGIC[0] &&
    bytes[SNAPMATIC_STANDARD_HEADER_SIZE + 1] === JPEG_MAGIC[1] &&
    bytes[SNAPMATIC_STANDARD_HEADER_SIZE + 2] === JPEG_MAGIC[2]
  ) {
    startOffset = SNAPMATIC_STANDARD_HEADER_SIZE;
    format = 'pc';
  } else if (
    bytes.length > SNAPMATIC_CONSOLE_HEADER_SIZE + 3 &&
    bytes[SNAPMATIC_CONSOLE_HEADER_SIZE] === JPEG_MAGIC[0] &&
    bytes[SNAPMATIC_CONSOLE_HEADER_SIZE + 1] === JPEG_MAGIC[1] &&
    bytes[SNAPMATIC_CONSOLE_HEADER_SIZE + 2] === JPEG_MAGIC[2]
  ) {
    startOffset = SNAPMATIC_CONSOLE_HEADER_SIZE;
    format = 'console';
  } else {
    // Fallback scan first 2048 bytes
    const searchLimit = Math.min(bytes.length - 3, 2048);
    for (let i = 0; i < searchLimit; i++) {
      if (
        bytes[i] === JPEG_MAGIC[0] &&
        bytes[i + 1] === JPEG_MAGIC[1] &&
        bytes[i + 2] === JPEG_MAGIC[2]
      ) {
        startOffset = i;
        format = i === SNAPMATIC_STANDARD_HEADER_SIZE ? 'pc' : i === SNAPMATIC_CONSOLE_HEADER_SIZE ? 'console' : 'unknown';
        break;
      }
    }
  }

  if (startOffset === -1) {
    throw new Error('Invalid Snapmatic: No JPEG SOI header found.');
  }

  // 2. Locate JPEG End (EOI: 0xFF, 0xD9)
  let endOffset = -1;
  for (let i = bytes.length - 2; i >= startOffset; i--) {
    if (bytes[i] === JPEG_EOI[0] && bytes[i + 1] === JPEG_EOI[1]) {
      endOffset = i + 2;
      break;
    }
  }

  if (endOffset === -1 || endOffset <= startOffset) {
    throw new Error('Corrupted Snapmatic: JPEG EOI marker (0xFFD9) not found.');
  }

  const jpegBytes = bytes.subarray(startOffset, endOffset);
  const jpegBlob = new Blob([jpegBytes], { type: 'image/jpeg' });

  // 3. Scan for Post-JPEG metadata chunks (JSON, TITL, DESC)
  const metadata: SnapmaticMetadata = {};

  // Scan JSON chunk
  const jsonMarkerIdx = findSequence(bytes, MARKER_JSON, startOffset);
  if (jsonMarkerIdx !== -1 && jsonMarkerIdx + 8 < bytes.length) {
    try {
      const lengthField = view.getInt32(jsonMarkerIdx + 4, true); // Little endian
      let jsonBytes: Uint8Array | null = null;

      if (lengthField > 0 && jsonMarkerIdx + 8 + lengthField <= bytes.length) {
        jsonBytes = bytes.subarray(jsonMarkerIdx + 8, jsonMarkerIdx + 8 + lengthField);
      } else {
        // Fallback: scan for { ... }
        const openBrace = bytes.indexOf(0x7b, jsonMarkerIdx); // '{'
        if (openBrace !== -1) {
          const closeBrace = bytes.lastIndexOf(0x7d); // '}'
          if (closeBrace > openBrace) {
            jsonBytes = bytes.subarray(openBrace, closeBrace + 1);
          }
        }
      }

      if (jsonBytes) {
        const jsonText = new TextDecoder('utf-8', { fatal: false }).decode(jsonBytes).trim();
        const parsed = JSON.parse(jsonText);
        metadata.rawJson = parsed;

        if (parsed.loc && typeof parsed.loc === 'object') {
          metadata.loc = {
            x: Number(parsed.loc.x) || 0,
            y: Number(parsed.loc.y) || 0,
            z: Number(parsed.loc.z) || 0,
          };
        }
        if (typeof parsed.area === 'string') {
          metadata.area = parsed.area;
          metadata.areaName = getAreaName(parsed.area, Boolean(parsed.onislandx));
        }
        if (parsed.creat) {
          const ts = Number(parsed.creat);
          if (!isNaN(ts) && ts > 0) {
            metadata.timestamp = ts;
            metadata.createdAt = new Date(ts * 1000);
          }
        }
        if (Array.isArray(parsed.plyrs)) {
          metadata.players = parsed.plyrs.filter((p: unknown) => typeof p === 'string');
        }
        metadata.isSelfie = Boolean(parsed.slf);
        metadata.isMugshot = Boolean(parsed.mug);
        metadata.isDirector = Boolean(parsed.drctr);
        metadata.isRockstarEditor = Boolean(parsed.rsedtr);
        metadata.isCayoPerico = Boolean(parsed.onislandx);
        metadata.isMeme = Boolean(parsed.meme);
        if (parsed.uid) metadata.uid = Number(parsed.uid);
        if (parsed.crewid) metadata.crewId = Number(parsed.crewid);
        if (parsed.street) metadata.streetId = Number(parsed.street);
      }
    } catch {
      warnings.push('Failed to fully parse embedded JSON metadata block.');
    }
  } else {
    warnings.push('No embedded JSON metadata marker found in file.');
  }

  // Scan TITL chunk
  const titlIdx = findSequence(bytes, MARKER_TITL, startOffset);
  if (titlIdx !== -1 && titlIdx + 8 < bytes.length) {
    try {
      const len = view.getInt32(titlIdx + 4, true);
      const safeLen = Math.min(len > 0 ? len : 256, bytes.length - (titlIdx + 8));
      const titleStr = decodeNullTerminatedString(bytes.subarray(titlIdx + 8, titlIdx + 8 + safeLen));
      if (titleStr) metadata.title = titleStr;
    } catch {
      // Ignored
    }
  }

  // Scan DESC chunk
  const descIdx = findSequence(bytes, MARKER_DESC, startOffset);
  if (descIdx !== -1 && descIdx + 8 < bytes.length) {
    try {
      const len = view.getInt32(descIdx + 4, true);
      const safeLen = Math.min(len > 0 ? len : 256, bytes.length - (descIdx + 8));
      const descStr = decodeNullTerminatedString(bytes.subarray(descIdx + 8, descIdx + 8 + safeLen));
      if (descStr) metadata.description = descStr;
    } catch {
      // Ignored
    }
  }

  return {
    format,
    headerOffset: startOffset,
    jpegBlob,
    jpegBytes,
    metadata,
    warnings,
  };
}

/**
 * Generates an informative, clean filename from Snapmatic metadata
 * Example: Snapmatic_2024-05-22_Vinewood.jpg
 */
export function generateSnapmaticFilename(
  metadata: SnapmaticMetadata,
  originalName: string = 'Snapmatic'
): string {
  const parts: string[] = ['Snapmatic'];

  if (metadata.createdAt) {
    const d = metadata.createdAt;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    parts.push(`${year}-${month}-${day}`);
  }

  if (metadata.areaName) {
    const safeArea = metadata.areaName.replace(/[^a-zA-Z0-9]/g, '_');
    parts.push(safeArea);
  } else if (metadata.area) {
    parts.push(metadata.area.replace(/[^a-zA-Z0-9]/g, '_'));
  }

  if (metadata.isSelfie) {
    parts.push('Selfie');
  }

  if (parts.length === 1) {
    const base = originalName.replace(/\.[^.]+$/, '');
    return `${base}.jpg`;
  }

  return `${parts.join('_')}.jpg`;
}

/**
 * Backwards compatibility helper: returns JPEG Blob directly from buffer
 */
export function extractJpegFromSnapmatic(buffer: ArrayBuffer): Blob {
  const result = parseSnapmatic(buffer);
  return result.jpegBlob;
}

export function blobToObjectURL(blob: Blob): string {
  return URL.createObjectURL(blob);
}
