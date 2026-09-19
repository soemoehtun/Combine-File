// Fast streaming engine — instant previews + chunked processing with real % progress.
// Text files are streamed via file.stream() in ~512KB chunks with a quote-aware
// incremental parser. Excel previews use sheetRows to avoid full workbook parses.

import * as XLSX from 'xlsx';
import { detectDelimiter, parseDelimited, getExtension } from './csv';

/** Fast yield — setTimeout(0) instead of rAF so batches don't wait ~16ms for paint. */
export function yieldToUI(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

/** Only yield if enough wall-time passed since last yield — keeps big jobs fast. */
export function createYielder(minIntervalMs = 30) {
  let last = 0;
  return async function maybeYield(force = false): Promise<void> {
    const now = performance.now();
    if (force || now - last >= minIntervalMs) {
      last = now;
      await yieldToUI();
    }
  };
}

/**
 * Monotonic progress tracker — the single source of truth for %.
 * - percent NEVER goes backwards (fixes flicker / stuck readings)
 * - percent capped at 99 until complete() is called, then exactly 100
 * - speed via simple bytes/elapsed, ETA from remaining/speed
 */
export interface ProgressSnapshot {
  percent: number;
  bytesDone: number;
  totalBytes: number;
  rows: number;
  speed: number;
  etaMs: number;
  elapsed: number;
}

export class ProgressTracker {
  private t0 = performance.now();
  private maxPercent = 0;
  private bytesDone = 0;
  totalBytes: number;

  constructor(totalBytes: number) {
    this.totalBytes = Math.max(1, totalBytes);
  }

  /** Report absolute completed bytes + total rows so far. Returns null if nothing changed enough to repaint. */
  update(bytesDone: number, rows: number, force = false): ProgressSnapshot | null {
    this.bytesDone = Math.min(this.totalBytes, Math.max(0, bytesDone));
    const now = performance.now();
    const elapsed = now - this.t0;
    let percent = Math.round((this.bytesDone / this.totalBytes) * 100);
    percent = Math.min(99, Math.max(0, percent));
    if (!force && percent <= this.maxPercent) return null; // no visual change — skip render
    if (percent < this.maxPercent) percent = this.maxPercent; // never backwards
    this.maxPercent = percent;
    const speed = elapsed > 150 ? Math.round((this.bytesDone / elapsed) * 1000) : 0;
    const remain = this.totalBytes - this.bytesDone;
    return {
      percent,
      bytesDone: Math.round(this.bytesDone),
      totalBytes: this.totalBytes,
      rows,
      speed,
      etaMs: speed > 0 && remain > 0 ? Math.round((remain / speed) * 1000) : 0,
      elapsed: Math.round(elapsed),
    };
  }

  complete(rows: number): ProgressSnapshot {
    const elapsed = Math.round(performance.now() - this.t0);
    this.maxPercent = 100;
    return {
      percent: 100,
      bytesDone: this.totalBytes,
      totalBytes: this.totalBytes,
      rows,
      speed: elapsed > 0 ? Math.round((this.totalBytes / elapsed) * 1000) : 0,
      etaMs: 0,
      elapsed,
    };
  }
}

/* ---------------- fast incremental delimited parser ---------------- */

export class StreamingParser {
  delimiter: string;
  private field = '';
  private row: string[] = [];
  private inQuotes = false;

  constructor(delimiter: string) {
    this.delimiter = delimiter;
  }

  reset() {
    this.field = '';
    this.row = [];
    this.inQuotes = false;
  }

  /** Push a text chunk, returns fully completed rows */
  push(text: string): string[][] {
    const out: string[][] = [];
    const d = this.delimiter;
    let field = this.field;
    let row = this.row;
    let inQuotes = this.inQuotes;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else {
          field += ch;
        }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === d) { row.push(field); field = ''; }
        else if (ch === '\r') {
          if (text[i + 1] === '\n') i++;
          row.push(field); field = '';
          if (row.length > 1 || row[0] !== '') out.push(row);
          row = [];
        } else if (ch === '\n') {
          row.push(field); field = '';
          if (row.length > 1 || row[0] !== '') out.push(row);
          row = [];
        } else {
          field += ch;
        }
      }
    }

    this.field = field;
    this.row = row;
    this.inQuotes = inQuotes;
    return out;
  }

  flush(): string[][] {
    // if still inside quotes, treat remainder as data
    const row = this.row;
    const field = this.field;
    this.field = '';
    this.row = [];
    this.inQuotes = false;
    row.push(field);
    if (row.length > 1 || (row.length === 1 && row[0] !== '')) return [row];
    return [];
  }
}

/* ---------------- text streaming ---------------- */

export interface StreamCallbacks {
  onBatch?: (rows: string[][]) => void | Promise<void>;
  onProgress?: (bytesRead: number, total: number) => void;
  shouldCancel?: () => boolean;
}

export async function streamTextFile(
  file: File,
  delimiter: string,
  cb: StreamCallbacks,
  batchSize = 25000
): Promise<{ totalRows: number }> {
  const total = file.size;
  const reader = file.stream().getReader();
  const decoder = new TextDecoder('utf-8');
  const parser = new StreamingParser(delimiter);
  let bytesRead = 0;
  let totalRows = 0;
  let batch: string[][] = [];
  let first = true;

  try {
    while (true) {
      if (cb.shouldCancel?.()) break;
      const { done, value } = await reader.read();
      if (value) bytesRead += value.byteLength;
      const text = decoder.decode(value, { stream: !done });
      // strip BOM once
      const clean = first && text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
      first = false;
      const rows = clean ? parser.push(clean) : [];
      if (rows.length) {
        totalRows += rows.length;
        if (cb.onBatch) {
          batch.push(...rows);
          if (batch.length >= batchSize) {
            const b = batch;
            batch = [];
            await cb.onBatch(b);
          }
        }
      }
      cb.onProgress?.(bytesRead, total);
      if (done) break;
    }
  } finally {
    reader.releaseLock();
  }

  const tail = parser.flush();
  if (tail.length && !cb.shouldCancel?.()) {
    totalRows += tail.length;
    if (cb.onBatch) {
      batch.push(...tail);
    }
    cb.onProgress?.(bytesRead, total);
  }
  if (batch.length && cb.onBatch && !cb.shouldCancel?.()) {
    await cb.onBatch(batch);
  }
  return { totalRows };
}

/* ---------------- instant previews (no full parse) ---------------- */

export interface TextPreview {
  delimiter: string;
  delimiterLabel: string;
  headers: string[];
  previewRows: string[][];
  estimatedRows: number;
}

export async function previewTextFile(file: File, forcedDelim?: string): Promise<TextPreview> {
  const SLICE = 192 * 1024;
  const blob = file.size > SLICE ? file.slice(0, SLICE) : file;
  const text = await blob.text();
  let delim = forcedDelim && forcedDelim !== 'auto' ? forcedDelim : detectDelimiter(text).delimiter;
  const rows = parseDelimited(text, delim);
  const headers = (rows[0] || []).map((h) => h.trim());
  const previewRows = rows.slice(0, 6);
  // estimate total rows from sample density
  let estimatedRows = Math.max(0, rows.length - 1);
  if (file.size > SLICE && text.length > 0) {
    const avgBytesPerRow = blob.size / Math.max(1, rows.length);
    estimatedRows = Math.max(estimatedRows, Math.floor(file.size / Math.max(20, avgBytesPerRow)) - 1);
  }
  const label = delim === '\t' ? 'Tab' : delim === ';' ? 'Semicolon (;)' : delim === '|' ? 'Pipe (|)' : 'Comma (,)';
  return { delimiter: delim, delimiterLabel: label, headers, previewRows, estimatedRows };
}

export interface ExcelPreview {
  sheets: string[];
  selectedSheet: string;
  headers: string[];
  previewRows: string[][];
  estimatedRows: number;
}

export async function previewExcelFile(file: File, preferredSheet?: string): Promise<ExcelPreview> {
  const buf = await file.arrayBuffer();
  // FAST: only parse first ~12 rows per sheet for preview + sheet names
  const wb = XLSX.read(buf, { type: 'array', sheetRows: 12, dense: false });
  const sheets = wb.SheetNames.length ? wb.SheetNames : ['Sheet1'];
  const pick = preferredSheet && sheets.includes(preferredSheet) ? preferredSheet : sheets[0];
  const ws = wb.Sheets[pick];
  let previewRows: string[][] = [];
  if (ws) {
    const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false }) as unknown[][];
    previewRows = raw.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : [String(r ?? '')]));
  }
  const headers = (previewRows[0] || []).map((h) => String(h).trim());
  // rough estimate: file size based (excel is compressed, so underestimate) — refined during processing
  const estimatedRows = Math.max(previewRows.length - 1, Math.floor(file.size / 120));
  return { sheets, selectedSheet: pick, headers, previewRows, estimatedRows };
}

export async function loadExcelSheetFull(
  file: File,
  sheet: string,
  onProgress?: (rowsDone: number, totalRows: number) => void
): Promise<{ headers: string[]; rows: string[][]; totalRows: number }> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', dense: false });
  const ws = wb.Sheets[sheet] ?? wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { headers: [], rows: [], totalRows: 0 };
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: '', blankrows: false }) as unknown[][];
  const rows: string[][] = new Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const r = raw[i];
    rows[i] = Array.isArray(r) ? r.map((c) => String(c ?? '')) : [String(r ?? '')];
    if (onProgress && i % 20000 === 0) {
      onProgress(i, raw.length);
      await yieldToUI();
    }
  }
  onProgress?.(raw.length, raw.length);
  const headers = rows[0] || [];
  return { headers, rows, totalRows: Math.max(0, rows.length - 1) };
}

/* ---------------- csv writing (fast) ---------------- */

export function escapeCell(v: string, d: string): string {
  if (v === '' || v == null) return '';
  // fast path: no special chars
  if (v.indexOf('"') === -1 && v.indexOf(d) === -1 && v.indexOf('\n') === -1 && v.indexOf('\r') === -1) return v;
  return '"' + v.replace(/"/g, '""') + '"';
}

export function rowsToCsv(rows: string[][], delimiter: string): string {
  // build with array join — much faster than nested maps for large batches
  const parts: string[] = new Array(rows.length);
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    let line = '';
    for (let j = 0; j < r.length; j++) {
      if (j > 0) line += delimiter;
      line += escapeCell(r[j] ?? '', delimiter);
    }
    parts[i] = line;
  }
  return parts.join('\n');
}

export function isTextExt(ext: string) {
  return ext === '.csv' || ext === '.txt';
}

export function extOf(name: string) {
  return getExtension(name);
}
