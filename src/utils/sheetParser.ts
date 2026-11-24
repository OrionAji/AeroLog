import type {
  AppSheetSchemaField,
  CanonicalFlightField,
  ColumnMapping,
  ConnectedSheetConfig,
  EngineCategory,
  FlightEntry,
  FlightRoleType,
  FlightSource,
} from '../types/logbook';
import {
  formatHHMM,
  formatShortSheetDate,
  inferEngineCategory,
  normalizeDateString,
  parseDurationToMinutes,
  parseInteger,
} from './flightMath';

export interface FieldMeta {
  key: CanonicalFlightField;
  label: string;
  group: 'Core' | 'Hours (HH:MM)' | 'Ops & IFR';
}

export const CANONICAL_FIELDS: FieldMeta[] = [
  { key: 'date', label: 'Flight Date', group: 'Core' },
  { key: 'aircraftType', label: 'Aircraft Type (A-JET, K8-E...)', group: 'Core' },
  { key: 'aircraftMark', label: 'Mark (Aircraft Mark)', group: 'Core' },
  { key: 'engineCategory', label: 'Engine Class', group: 'Core' },
  { key: 'departure', label: 'From (Departure)', group: 'Core' },
  { key: 'arrival', label: 'To (Arrival)', group: 'Core' },
  { key: 'instructor', label: 'Instructor / Captain', group: 'Core' },
  { key: 'sortie', label: 'Sortie (Sortie Ref)', group: 'Core' },
  { key: 'exercise', label: 'Exercise / Mission', group: 'Core' },
  { key: 'flightType', label: 'Type (DUAL / SOLO / SIM)', group: 'Core' },
  { key: 'totalTime', label: 'Time / Total Duration', group: 'Hours (HH:MM)' },
  { key: 'dualTime', label: 'Dual Time', group: 'Hours (HH:MM)' },
  { key: 'soloTime', label: 'PIC / Solo Time', group: 'Hours (HH:MM)' },
  { key: 'nightTime', label: 'Night Time', group: 'Hours (HH:MM)' },
  { key: 'instrumentTime', label: 'Instrument Time', group: 'Hours (HH:MM)' },
  { key: 'simulatorTime', label: 'Simulator Time', group: 'Hours (HH:MM)' },
  { key: 'takeoffs', label: 'Take-offs', group: 'Ops & IFR' },
  { key: 'landings', label: 'Landings', group: 'Ops & IFR' },
  { key: 'approaches', label: 'Inst. Approaches', group: 'Ops & IFR' },
  { key: 'remarks', label: 'Remarks / Notes', group: 'Ops & IFR' },
];

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]{15,})/);
  if (urlMatch) return urlMatch[1];

  const keyParamMatch = trimmed.match(/[?&](?:id|key)=([a-zA-Z0-9-_]{15,})/);
  if (keyParamMatch) return keyParamMatch[1];

  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function parseDelimitedText(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return [];

  const firstLine = cleaned.split(/\r?\n/)[0] ?? '';
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;

  let delimiter = ',';
  if (tabCount > commaCount && tabCount >= semiCount) {
    delimiter = '\t';
  } else if (semiCount > commaCount && commaCount === 0) {
    delimiter = ';';
  }

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    const next = cleaned[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r' && next === '\n') {
      row.push(cell.trim());
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
      i++;
    } else if (ch === '\n' || ch === '\r') {
      row.push(cell.trim());
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((v) => v !== '')) rows.push(row);

  return rows;
}

/**
 * Detects whether a pasted/uploaded CSV is the Dashboard summary tab (like Pilot_Logbook_AppSheet)
 * rather than the raw Flights table tab.
 */
export function isDashboardSummaryCsv(rows: string[][]): boolean {
  const joined = rows
    .slice(0, 12)
    .map((r) => r.join(' '))
    .join('\n')
    .toUpperCase();
  return (
    joined.includes('PILOT FLIGHT LOGBOOK') &&
    (joined.includes('TOTAL FLIGHT HOURS') || joined.includes('HOURS BY AIRCRAFT TYPE'))
  );
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/[_\-/.#()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const PRIMARY_HEADER_RULES: Array<{ field: CanonicalFlightField; patterns: RegExp[] }> = [
  { field: 'date', patterns: [/^date$/, /^flight date$/, /^flt date$/, /^log date$/] },
  {
    field: 'aircraftType',
    patterns: [/^aircraft$/, /^aircraft type$/, /^acft type$/, /^make.*model$/, /^model$/],
  },
  {
    field: 'aircraftMark',
    patterns: [
      /^aircraft\s*mark$/,
      /^a\s*c\s*mark$/,
      /^acft\s*mark$/,
      /^mark$/,
      /\baircraft\s*mark\b/,
      /\bmark\b/,
    ],
  },
  { field: 'engineCategory', patterns: [/^engine$/, /^engine type$/, /^engine class$/] },
  {
    field: 'sortie',
    patterns: [
      /^sortie\s*ref(erence)?$/,
      /^sortie\s*ref\s*(no|num|number|id)?$/,
      /^sortie\s*id$/,
    ],
  },
  { field: 'instructor', patterns: [/^instructor$/, /^captain$/, /instructor/, /captain/, /cfi/] },
  { field: 'exercise', patterns: [/^exercise$/, /^mission$/, /exercise/] },
  { field: 'flightType', patterns: [/^type$/, /^flight type$/, /^duty$/, /^role$/] },
  { field: 'departure', patterns: [/^from$/, /^dep$/, /^departure$/, /^origin$/] },
  { field: 'arrival', patterns: [/^to$/, /^arr$/, /^arrival$/, /^dest(ination)?$/] },
  {
    field: 'totalTime',
    patterns: [/^time$/, /^total time$/, /^flight time$/, /^block time$/, /^duration$/, /^hours$/, /^hrs$/],
  },
  { field: 'dualTime', patterns: [/^dual$/, /dual/, /instruction/] },
  { field: 'soloTime', patterns: [/^solo$/, /^pic$/, /pilot in command/, /^p1$/] },
  { field: 'nightTime', patterns: [/^night$/, /night time/, /night hrs/] },
  { field: 'instrumentTime', patterns: [/^instrument$/, /instrument/, /^ifr$/, /^imc$/, /hood/] },
  { field: 'simulatorTime', patterns: [/^sim(ulator)?$/, /fstd/] },
  { field: 'takeoffs', patterns: [/take ?off/, /^t o$/, /^to count$/] },
  { field: 'landings', patterns: [/landing/, /^ldg/] },
  { field: 'approaches', patterns: [/approach/, /^inst app/, /^app$/] },
  { field: 'remarks', patterns: [/remark/, /comment/, /note/, /description/] },
];

const FALLBACK_HEADER_RULES: Array<{ field: CanonicalFlightField; patterns: RegExp[] }> = [
  { field: 'date', patterns: [/^day$/, /date/] },
  {
    field: 'aircraftMark',
    patterns: [
      /aircraft\s*no/,
      /a\s*c\s*no/,
      /tail/,
      /reg(istration)?/,
      /aircraft\s*serial/,
      /callsign/,
      /^ident$/,
    ],
  },
  { field: 'engineCategory', patterns: [/engine/] },
  {
    field: 'sortie',
    patterns: [
      /^sortie$/,
      /^sortie\s*(no|num|number)$/,
      /^flt\s*no$/,
      /^flight\s*no$/,
      /\bsortie\b/,
    ],
  },
  { field: 'instructor', patterns: [/pilot in charge/, /crew/] },
  { field: 'exercise', patterns: [/mission/, /detail/, /maneuver/] },
  { field: 'flightType', patterns: [/dual.*solo/] },
  { field: 'departure', patterns: [/^from/, /^dep/] },
  { field: 'arrival', patterns: [/^arr/, /dest/] },
  { field: 'totalTime', patterns: [/total.*hrs/, /flight.*hrs/] },
];

const APPSHEET_SYSTEM_HEADERS = new Set([
  '_rownumber',
  'row id',
  'rowid',
  'row key',
  'uniqueid',
  '_computedkey',
]);

const ROW_INDEX_HEADER_PATTERN = /^(s\s*n|s\s*no|sr\s*no|serial(\s*no|\s*number)?|no|index|row\s*#?)$/;

export function detectAppSheetHeaders(headers: string[]): boolean {
  return headers.some((h) => {
    const clean = h.trim().toLowerCase();
    return (
      APPSHEET_SYSTEM_HEADERS.has(clean) ||
      clean.startsWith('_computed') ||
      clean.includes('_id') ||
      clean.startsWith('related ')
    );
  });
}

export function autoDetectColumnMapping(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  const usedFields = new Set<CanonicalFlightField>();
  const normalizedHeaders = headers.map((h) => normalizeHeader(h));

  // Pre-mark empty, AppSheet system, and row-counter columns as ignored
  headers.forEach((rawHeader, idx) => {
    const rawLower = rawHeader.trim().toLowerCase();
    const norm = normalizedHeaders[idx];
    if (
      !rawLower ||
      APPSHEET_SYSTEM_HEADERS.has(rawLower) ||
      rawLower.startsWith('related ') ||
      ROW_INDEX_HEADER_PATTERN.test(norm)
    ) {
      mapping[idx] = 'ignore';
    }
  });

  // Pass 1: High-confidence / exact headers (so "Aircraft Mark" / "Mark" always wins)
  headers.forEach((_, idx) => {
    if (mapping[idx] !== undefined) return;
    const norm = normalizedHeaders[idx];
    for (const rule of PRIMARY_HEADER_RULES) {
      if (usedFields.has(rule.field)) continue;
      if (rule.patterns.some((re) => re.test(norm))) {
        mapping[idx] = rule.field;
        usedFields.add(rule.field);
        break;
      }
    }
  });

  // Pass 2: Secondary fallback headers for any unmapped canonical fields
  headers.forEach((_, idx) => {
    if (mapping[idx] !== undefined) return;
    const norm = normalizedHeaders[idx];
    for (const rule of FALLBACK_HEADER_RULES) {
      if (usedFields.has(rule.field)) continue;
      if (rule.patterns.some((re) => re.test(norm))) {
        mapping[idx] = rule.field;
        usedFields.add(rule.field);
        break;
      }
    }
    if (mapping[idx] === undefined) {
      mapping[idx] = 'custom';
    }
  });

  return mapping;
}

/**
 * Finds the most likely column header row in the first 10 rows of a sheet/CSV
 * (handles sheets that have a title banner or blank row above the column headers).
 */
export function detectHeaderRowIndex(rows: string[][]): number {
  const scanLimit = Math.min(rows.length, 10);
  let bestIdx = 0;
  let bestScore = -1;

  for (let i = 0; i < scanLimit; i++) {
    const row = rows[i] ?? [];
    const cleaned = row.map((c) => String(c ?? '').trim());
    if (cleaned.every((c) => !c)) continue;
    const map = autoDetectColumnMapping(cleaned);
    const canonicalHits = Object.values(map).filter(
      (v) => v !== 'ignore' && v !== 'custom'
    ).length;
    if (canonicalHits > bestScore) {
      bestScore = canonicalHits;
      bestIdx = i;
    }
  }

  return bestScore >= 2 ? bestIdx : 0;
}

const MARK_CUSTOM_KEY_PATTERN = /^(aircraft\s*mark|a\s*c\s*mark|acft\s*mark|mark)$/i;
const SORTIE_REF_CUSTOM_KEY_PATTERN =
  /^(sortie\s*ref(erence)?|sortie\s*ref\s*(no|num|number|id)?|sortie\s*id)$/i;
const SORTIE_CUSTOM_KEY_PATTERN = /^(sortie|sortie\s*(no|num|number)?|flt\s*no|flight\s*no)$/i;
const FROM_CUSTOM_KEY_PATTERN = /^(from|dep|departure|origin)$/i;
const TO_CUSTOM_KEY_PATTERN = /^(to|arr|arrival|dest(ination)?)$/i;

/**
 * Promotes any "Aircraft Mark" / "Mark", "Sortie Ref" / "Sortie", "From", or "To" values
 * previously captured under customFields into their canonical FlightEntry fields.
 * "Sortie Ref" always takes precedence over generic "Sortie" if present.
 */
export function backfillMarksFromCustomFields(flights: FlightEntry[]): {
  flights: FlightEntry[];
  updatedCount: number;
} {
  let updatedCount = 0;
  const next = flights.map((flight) => {
    if (!flight.customFields) return flight;

    let aircraftMark = flight.aircraftMark?.trim() || '';
    let sortie = flight.sortie?.trim() || '';
    let sortieFromRef = false;
    let departure = flight.departure?.trim() || '';
    let arrival = flight.arrival?.trim() || '';
    const keysToRemove: string[] = [];

    // Pass 1: Prioritize explicit "Sortie Ref" over any generic sortie value
    for (const [key, val] of Object.entries(flight.customFields)) {
      const cleaned = String(val ?? '').trim();
      if (!cleaned) continue;
      const normKey = normalizeHeader(key);
      if (SORTIE_REF_CUSTOM_KEY_PATTERN.test(normKey)) {
        sortie = cleaned;
        sortieFromRef = true;
        keysToRemove.push(key);
        break;
      }
    }

    // Pass 2: Backfill remaining canonical fields when empty
    for (const [key, val] of Object.entries(flight.customFields)) {
      if (keysToRemove.includes(key)) continue;
      const cleaned = String(val ?? '').trim();
      if (!cleaned) continue;
      const normKey = normalizeHeader(key);
      if (!aircraftMark && MARK_CUSTOM_KEY_PATTERN.test(normKey)) {
        aircraftMark = cleaned;
        keysToRemove.push(key);
      } else if (!sortie && !sortieFromRef && SORTIE_CUSTOM_KEY_PATTERN.test(normKey)) {
        sortie = cleaned;
        keysToRemove.push(key);
      } else if (!departure && FROM_CUSTOM_KEY_PATTERN.test(normKey)) {
        departure = cleaned.toUpperCase();
        keysToRemove.push(key);
      } else if (!arrival && TO_CUSTOM_KEY_PATTERN.test(normKey)) {
        arrival = cleaned.toUpperCase();
        keysToRemove.push(key);
      }
    }

    if (keysToRemove.length === 0) return flight;
    updatedCount += 1;
    const remainingCustom = { ...flight.customFields };
    for (const k of keysToRemove) {
      delete remainingCustom[k];
    }
    return {
      ...flight,
      aircraftMark,
      sortie: sortie || undefined,
      departure: departure || undefined,
      arrival: arrival || undefined,
      customFields: Object.keys(remainingCustom).length > 0 ? remainingCustom : undefined,
    };
  });

  return { flights: next, updatedCount };
}

export function upgradeConnectedSheetMapping(
  config: ConnectedSheetConfig | null
): ConnectedSheetConfig | null {
  if (!config || !config.headers?.length) return config;

  const auto = autoDetectColumnMapping(config.headers);
  const nextMapping: ColumnMapping = { ...config.mapping };
  let changed = false;

  // Ensure an explicit "Sortie Ref" column always owns the canonical 'sortie' field
  const autoSortieEntry = Object.entries(auto).find(([, field]) => field === 'sortie');
  if (autoSortieEntry) {
    const refColIdx = Number(autoSortieEntry[0]);
    const refHeaderNorm = normalizeHeader(config.headers[refColIdx] ?? '');
    if (
      SORTIE_REF_CUSTOM_KEY_PATTERN.test(refHeaderNorm) &&
      nextMapping[refColIdx] !== 'sortie'
    ) {
      for (const [idxStr, field] of Object.entries(nextMapping)) {
        if (field === 'sortie') {
          nextMapping[Number(idxStr)] = 'custom';
        }
      }
      const prevVal = nextMapping[refColIdx];
      nextMapping[refColIdx] = 'sortie';
      changed = true;
      if (prevVal === 'exercise') {
        const exEntry = Object.entries(auto).find(([, field]) => field === 'exercise');
        if (exEntry) {
          nextMapping[Number(exEntry[0])] = 'exercise';
        }
      }
    }
  }

  const targetFields: CanonicalFlightField[] = [
    'aircraftMark',
    'sortie',
    'departure',
    'arrival',
  ];

  for (const targetField of targetFields) {
    const alreadyMapped = Object.values(nextMapping).includes(targetField);
    if (alreadyMapped) continue;

    const autoEntry = Object.entries(auto).find(([, field]) => field === targetField);
    if (!autoEntry) continue;

    const colIdx = Number(autoEntry[0]);
    const prevVal = nextMapping[colIdx];
    // Safely upgrade columns that were previously custom/ignore/unmapped, or where 'Sortie' previously mapped to 'exercise'
    if (
      prevVal === undefined ||
      prevVal === 'custom' ||
      prevVal === 'ignore' ||
      (targetField === 'sortie' && prevVal === 'exercise')
    ) {
      nextMapping[colIdx] = targetField;
      changed = true;
      // If 'sortie' freed up 'exercise', also bind the real 'Exercise' column if present
      if (targetField === 'sortie' && prevVal === 'exercise') {
        const exEntry = Object.entries(auto).find(([, field]) => field === 'exercise');
        if (exEntry) {
          nextMapping[Number(exEntry[0])] = 'exercise';
        }
      }
    }
  }

  return changed ? { ...config, mapping: nextMapping } : config;
}

function normalizeRoleType(raw: string, engineCategory: EngineCategory): FlightRoleType {
  if (engineCategory === 'SIMULATOR') return 'SIMULATOR';
  const upper = raw.trim().toUpperCase();
  if (upper.includes('SIM')) return 'SIMULATOR';
  if (upper.includes('SOLO')) return 'SOLO';
  if (upper.includes('PIC') || upper === 'P1' || upper.includes('CAPTAIN')) return 'PIC';
  return 'DUAL';
}

export interface MappedImportResult {
  flights: FlightEntry[];
  skippedRows: number;
  warnings: string[];
}

export function mapRowsToFlights(
  headers: string[],
  dataRows: string[][],
  mapping: ColumnMapping,
  source: FlightSource,
  startingSheetRow = 2
): MappedImportResult {
  const flights: FlightEntry[] = [];
  const warnings: string[] = [];
  let skippedRows = 0;

  dataRows.forEach((row, rIdx) => {
    if (!row || row.every((c) => !String(c ?? '').trim())) return;

    let date = '';
    let aircraftType = '';
    let aircraftMark = '';
    let rawEngine = '';
    let instructor = '';
    let exercise = '';
    let rawFlightType = '';
    let sortie = '';
    let departure = '';
    let arrival = '';
    let totalMinutes = 0;
    let dualMinutes = 0;
    let soloMinutes = 0;
    let nightMinutes = 0;
    let instrumentMinutes = 0;
    let simulatorMinutes = 0;
    let takeoffs = -1;
    let landings = -1;
    let approaches = 0;
    let remarks = '';
    const customFields: Record<string, string> = {};

    headers.forEach((headerName, colIdx) => {
      const target = mapping[colIdx];
      const rawVal = String(row[colIdx] ?? '').trim();
      if (!target || target === 'ignore' || !rawVal) return;

      if (target === 'custom') {
        customFields[headerName || `Column_${colIdx + 1}`] = rawVal;
        return;
      }

      switch (target) {
        case 'date':
          date = normalizeDateString(rawVal);
          break;
        case 'aircraftType':
          aircraftType = rawVal.toUpperCase();
          break;
        case 'aircraftMark':
          aircraftMark = rawVal.trim();
          break;
        case 'engineCategory':
          rawEngine = rawVal;
          break;
        case 'instructor':
          instructor = rawVal.toUpperCase();
          break;
        case 'exercise':
          exercise = rawVal.toUpperCase();
          break;
        case 'flightType':
          rawFlightType = rawVal;
          break;
        case 'sortie':
          sortie = rawVal.trim();
          break;
        case 'departure':
          departure = rawVal.toUpperCase();
          break;
        case 'arrival':
          arrival = rawVal.toUpperCase();
          break;
        case 'totalTime':
          totalMinutes = parseDurationToMinutes(rawVal);
          break;
        case 'dualTime':
          dualMinutes = parseDurationToMinutes(rawVal);
          break;
        case 'soloTime':
          soloMinutes = parseDurationToMinutes(rawVal);
          break;
        case 'nightTime':
          nightMinutes = parseDurationToMinutes(rawVal);
          break;
        case 'instrumentTime':
          instrumentMinutes = parseDurationToMinutes(rawVal);
          break;
        case 'simulatorTime':
          simulatorMinutes = parseDurationToMinutes(rawVal);
          break;
        case 'takeoffs':
          takeoffs = parseInteger(rawVal);
          break;
        case 'landings':
          landings = parseInteger(rawVal);
          break;
        case 'approaches':
          approaches = parseInteger(rawVal);
          break;
        case 'remarks':
          remarks = rawVal;
          break;
      }
    });

    if (!date && !aircraftType && totalMinutes === 0) {
      skippedRows++;
      return;
    }

    if (!date) {
      warnings.push(`Row ${startingSheetRow + rIdx}: Missing valid date, skipped.`);
      skippedRows++;
      return;
    }

    const engineCategory = inferEngineCategory(aircraftType, rawEngine);
    const flightType = normalizeRoleType(rawFlightType, engineCategory);

    // Derive totalMinutes if only dual/solo/sim columns were mapped
    if (totalMinutes <= 0) {
      totalMinutes = dualMinutes + soloMinutes + simulatorMinutes;
    }

    // Derive dual/solo/simulator split from flightType if only a single Time column was present
    if (engineCategory === 'SIMULATOR' || flightType === 'SIMULATOR') {
      if (simulatorMinutes <= 0) simulatorMinutes = totalMinutes;
    } else if (dualMinutes === 0 && soloMinutes === 0 && totalMinutes > 0) {
      if (flightType === 'SOLO' || flightType === 'PIC') {
        soloMinutes = totalMinutes;
      } else {
        dualMinutes = totalMinutes;
      }
    }

    flights.push({
      id: `imp-${Date.now()}-${rIdx}-${Math.random().toString(36).slice(2, 7)}`,
      date,
      aircraftType: aircraftType || 'UNSPECIFIED',
      aircraftMark,
      engineCategory,
      instructor,
      exercise: exercise || 'SORTIE',
      flightType,
      sortie: sortie || undefined,
      departure: departure || undefined,
      arrival: arrival || undefined,
      totalMinutes,
      dualMinutes,
      soloMinutes,
      nightMinutes,
      instrumentMinutes,
      simulatorMinutes,
      takeoffs: takeoffs >= 0 ? takeoffs : 1,
      landings: landings >= 0 ? landings : 1,
      approaches,
      remarks,
      source,
      sheetRowNumber: startingSheetRow + rIdx,
      customFields: Object.keys(customFields).length > 0 ? customFields : undefined,
    });
  });

  return { flights, skippedRows, warnings };
}

export function serializeFlightToSheetRow(
  flight: FlightEntry,
  headers: string[],
  mapping: ColumnMapping
): (string | number)[] {
  return headers.map((header, idx) => {
    const field = mapping[idx];
    if (!field || field === 'ignore') return '';
    if (field === 'custom') {
      return flight.customFields?.[header] ?? '';
    }
    switch (field) {
      case 'date':
        return formatShortSheetDate(flight.date);
      case 'aircraftType':
        return flight.aircraftType;
      case 'aircraftMark':
        return flight.aircraftMark;
      case 'engineCategory':
        return flight.engineCategory;
      case 'instructor':
        return flight.instructor;
      case 'exercise':
        return flight.exercise;
      case 'flightType':
        return flight.flightType;
      case 'sortie':
        return flight.sortie ?? '';
      case 'departure':
        return flight.departure ?? '';
      case 'arrival':
        return flight.arrival ?? '';
      case 'totalTime':
        return formatHHMM(flight.totalMinutes);
      case 'dualTime':
        return flight.dualMinutes > 0 ? formatHHMM(flight.dualMinutes) : '';
      case 'soloTime':
        return flight.soloMinutes > 0 ? formatHHMM(flight.soloMinutes) : '';
      case 'nightTime':
        return flight.nightMinutes > 0 ? formatHHMM(flight.nightMinutes) : '';
      case 'instrumentTime':
        return flight.instrumentMinutes > 0 ? formatHHMM(flight.instrumentMinutes) : '';
      case 'simulatorTime':
        return flight.simulatorMinutes > 0 ? formatHHMM(flight.simulatorMinutes) : '';
      case 'takeoffs':
        return flight.takeoffs;
      case 'landings':
        return flight.landings;
      case 'approaches':
        return flight.approaches;
      case 'remarks':
        return flight.remarks;
      default:
        return '';
    }
  });
}

export const STANDARD_SHEET_HEADERS = [
  'Date',
  'Aircraft',
  'Engine',
  'Mark',
  'From',
  'To',
  'Instructor',
  'Sortie Ref',
  'Exercise',
  'Type',
  'Take-offs',
  'Landings',
  'Time',
  'Dual',
  'Solo',
  'Night',
  'Instrument',
  'Inst. Approaches',
  'Remarks',
];

function csvEscape(val: string | number | boolean | undefined): string {
  const s = val === undefined || val === null ? '' : String(val);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function exportFlightsToCsv(flights: FlightEntry[]): string {
  const mapping = autoDetectColumnMapping(STANDARD_SHEET_HEADERS);
  const lines = [STANDARD_SHEET_HEADERS.map(csvEscape).join(',')];
  for (const flight of flights) {
    const row = serializeFlightToSheetRow(flight, STANDARD_SHEET_HEADERS, mapping);
    lines.push(row.map(csvEscape).join(','));
  }
  return lines.join('\n');
}

export function parseAppSheetSchemaText(text: string): AppSheetSchemaField[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      const list = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed.columns)
          ? parsed.columns
          : Array.isArray(parsed.Columns)
            ? parsed.Columns
            : [];
      if (list.length > 0) {
        const names = list.map((item: any) =>
          typeof item === 'string' ? item : String(item.name || item.Name || item.column || '')
        );
        const mapping = autoDetectColumnMapping(names);
        return list.map((item: any, idx: number) => ({
          name: names[idx] || `Field_${idx + 1}`,
          appSheetType: typeof item === 'object' ? String(item.type || item.Type || 'Text') : 'Text',
          mappedTo: mapping[idx] ?? 'custom',
          isVirtual: Boolean(typeof item === 'object' && (item.isVirtual || item.virtual || item.AppFormula)),
        }));
      }
    } catch {
      // fall through
    }
  }

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const entries =
    lines.length === 1 && lines[0].includes(',')
      ? lines[0].split(',').map((s) => s.trim()).filter(Boolean)
      : lines;

  const parsedEntries = entries.map((line) => {
    const parenMatch = line.match(/^([^(\t:]+)(?:\s*\(([^)]+)\)|\s*[:\t]\s*(.+))?$/);
    const name = (parenMatch?.[1] ?? line).trim();
    const rawType = (parenMatch?.[2] ?? parenMatch?.[3] ?? 'Text').trim();
    const isVirtual = /virtual|formula|related /i.test(line);
    return { name, appSheetType: rawType, isVirtual };
  });

  const mapping = autoDetectColumnMapping(parsedEntries.map((e) => e.name));
  return parsedEntries.map((e, idx) => ({
    ...e,
    mappedTo: mapping[idx] ?? 'custom',
  }));
}
