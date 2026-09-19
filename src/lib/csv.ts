export function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const remS = s % 60;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h > 0) return `${h}:${remM.toString().padStart(2, '0')}:${remS.toString().padStart(2, '0')}`;
  return `${remM}:${remS.toString().padStart(2, '0')}`;
}

/** Detect the most likely delimiter from sample text */
export function detectDelimiter(text: string): { delimiter: string; label: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '').slice(0, 8);
  if (lines.length === 0) return { delimiter: ',', label: 'Comma (,)' };
  const candidates = [
    { d: '\t', label: 'Tab' },
    { d: ',', label: 'Comma (,)' },
    { d: ';', label: 'Semicolon (;)' },
    { d: '|', label: 'Pipe (|)' },
  ];
  let best = candidates[1];
  let bestScore = -1;
  for (const c of candidates) {
    const counts = lines.map((l) => splitLineCount(l, c.d));
    // consistency matters: low variance + high count wins
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((a, b) => a + Math.abs(b - avg), 0);
    const score = avg * 10 - variance;
    if (avg > 0 && score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return { delimiter: best.d, label: best.label };
}

function splitLineCount(line: string, delim: string): number {
  // naive count respecting quotes
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { i++; continue; }
      inQuotes = !inQuotes;
    } else if (!inQuotes && ch === delim) {
      count++;
    }
  }
  return count;
}

/** Robust CSV/TXT parser: handles quotes, escaped quotes, commas inside fields, CRLF/LF, newlines inside quotes */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const d = delimiter;

  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === d) {
        row.push(field);
        field = '';
      } else if (ch === '\r') {
        if (text[i + 1] === '\n') i++;
        row.push(field);
        field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else if (ch === '\n') {
        row.push(field);
        field = '';
        if (row.length > 1 || row[0] !== '') rows.push(row);
        row = [];
      } else {
        field += ch;
      }
    }
  }
  // trailing
  row.push(field);
  if (row.length > 1 || (row.length === 1 && row[0] !== '')) rows.push(row);
  return rows;
}

/** Escape + join rows to CSV text with chosen delimiter + line ending */
export function stringifyDelimited(rows: string[][], delimiter: string, lineEnding: '\n' | '\r\n' = '\n'): string {
  const eol = lineEnding;
  return rows
    .map((r) =>
      r
        .map((cell) => {
          const v = cell ?? '';
          if (v.includes('"') || v.includes(delimiter) || v.includes('\n') || v.includes('\r')) {
            return '"' + v.replace(/"/g, '""') + '"';
          }
          return v;
        })
        .join(delimiter)
    )
    .join(eol);
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\-. ]+/g, '_').slice(0, 120);
}

export function getExtension(name: string): string {
  const parts = name.toLowerCase().split('.');
  return parts.length > 1 ? '.' + parts.pop()! : '';
}

export function isAllowedExtension(name: string): boolean {
  return ['.csv', '.txt', '.xlsx', '.xls'].includes(getExtension(name));
}
