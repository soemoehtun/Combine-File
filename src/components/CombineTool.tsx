import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, FileSpreadsheet, FileText, Loader2, Table2, X } from 'lucide-react';
import { formatBytes, formatDuration, formatNumber, getExtension, isAllowedExtension } from '../lib/csv';
import { previewTextFile, previewExcelFile, streamTextFile, loadExcelSheetFull, rowsToCsv, yieldToUI, isTextExt, ProgressTracker, createYielder } from '../lib/engine';

interface LoadedFile {
  id: string;
  file: File;
  name: string;
  size: number;
  ext: string;
  delimiter: string;
  delimiterLabel: string;
  sheets: string[];
  selectedSheet: string;
  headers: string[];
  previewRows: string[][];
  estimatedRows: number;
  ready: boolean;
  error?: string;
}

type HeaderMode = 'first' | 'validate' | 'byName' | 'byPosition';

const GREEN = 'bg-[#3ea36e] hover:bg-[#35925f]';

export default function CombineTool() {
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [startRow, setStartRow] = useState('1');
  const [customRow, setCustomRow] = useState('5');
  const [globalSheet, setGlobalSheet] = useState('');
  const [headerMode, setHeaderMode] = useState<HeaderMode>('validate');
  const [txtDelimiter, setTxtDelimiter] = useState('auto');
  const [outDelimiter, setOutDelimiter] = useState(',');
  const [lineEnding, setLineEnding] = useState<'LF' | 'CRLF'>('LF');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [trimWs, setTrimWs] = useState(false);
  const [removeBlanks, setRemoveBlanks] = useState(false);
  const [dedupe, setDedupe] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [prog, setProg] = useState({ percent: 0, rows: 0, bytesDone: 0, totalBytes: 0, filesDone: 0, speed: 0, etaMs: 0, elapsed: 0, currentFile: '' });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; name: string; rows: number; inputBytes: number; outputBytes: number; ms: number; files: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const startNum = startRow === '1' ? 1 : startRow === '2' ? 2 : Math.max(1, parseInt(customRow) || 1);
  const headerIdx = startNum - 1;

  const allSheets = useMemo(() => {
    const s = new Set<string>();
    files.forEach((f) => f.sheets.forEach((x) => s.add(x)));
    return Array.from(s);
  }, [files]);

  /* ---------- instant add: placeholder first, preview in background ---------- */
  const addFiles = useCallback(async (list: FileList | File[]) => {
    const arr = Array.from(list);
    const valid = arr.filter((f) => isAllowedExtension(f.name));
    if (valid.length !== arr.length) {
      setError('Only CSV, TXT, XLSX and XLS are supported. Other files were skipped.');
      setTimeout(() => setError(null), 4000);
    }
    if (!valid.length) return;
    setResult(null);

    for (const f of valid) {
      const id = Math.random().toString(36).slice(2, 9);
      const ext = getExtension(f.name);
      const placeholder: LoadedFile = {
        id, file: f, name: f.name, size: f.size, ext,
        delimiter: ',', delimiterLabel: '—',
        sheets: [], selectedSheet: '', headers: [], previewRows: [],
        estimatedRows: 0, ready: false,
      };
      setFiles((p) => [...p, placeholder]);

      // background preview — never blocks UI
      (async () => {
        try {
          if (isTextExt(ext)) {
            const forced = txtDelimiter !== 'auto' ? txtDelimiter : undefined;
            const pv = await previewTextFile(f, forced);
            setFiles((p) => p.map((x) => x.id === id ? {
              ...x, ready: true,
              delimiter: pv.delimiter, delimiterLabel: pv.delimiterLabel,
              headers: pv.headers, previewRows: pv.previewRows, estimatedRows: pv.estimatedRows,
            } : x));
          } else {
            const pv = await previewExcelFile(f, globalSheet || undefined);
            setFiles((p) => p.map((x) => x.id === id ? {
              ...x, ready: true,
              sheets: pv.sheets, selectedSheet: pv.selectedSheet,
              headers: pv.headers, previewRows: pv.previewRows, estimatedRows: pv.estimatedRows,
            } : x));
          }
        } catch (e: any) {
          setFiles((p) => p.map((x) => x.id === id ? { ...x, ready: true, error: e?.message || 'Preview failed' } : x));
        }
      })();
    }
  }, [txtDelimiter, globalSheet]);

  const changeFileSheet = useCallback(async (id: string, sheet: string) => {
    const target = files.find((f) => f.id === id);
    if (!target) return;
    setFiles((p) => p.map((f) => f.id === id ? { ...f, ready: false, selectedSheet: sheet } : f));
    try {
      const pv = await previewExcelFile(target.file, sheet);
      // previewExcelFile re-picks preferred; force our sheet's rows
      const { loadExcelSheetFull } = await import('../lib/engine');
      // fast: only need first rows — reuse pv if pick matches, else load that sheet preview via full lightweight read
      if (pv.selectedSheet === sheet) {
        setFiles((p) => p.map((f) => f.id === id ? { ...f, ready: true, selectedSheet: sheet, headers: pv.headers, previewRows: pv.previewRows, estimatedRows: pv.estimatedRows, sheets: pv.sheets.length ? pv.sheets : f.sheets } : f));
      } else {
        const full = await loadExcelSheetFull(target.file, sheet);
        setFiles((p) => p.map((f) => f.id === id ? { ...f, ready: true, selectedSheet: sheet, headers: full.headers.map((h) => String(h).trim()), previewRows: [full.headers, ...full.rows.slice(0, 5)], estimatedRows: full.totalRows } : f));
      }
    } catch {
      setFiles((p) => p.map((f) => f.id === id ? { ...f, ready: true, selectedSheet: sheet } : f));
    }
  }, [files]);

  const applyGlobalSheet = useCallback((sheet: string) => {
    setGlobalSheet(sheet);
    if (!sheet) return;
    files.forEach((f) => {
      if ((f.ext === '.xlsx' || f.ext === '.xls') && f.sheets.includes(sheet) && f.selectedSheet !== sheet) {
        changeFileSheet(f.id, sheet);
      }
    });
  }, [files, changeFileSheet]);

  const removeFile = (id: string) => {
    setFiles((p) => p.filter((f) => f.id !== id));
    setResult(null);
  };

  const clearAll = () => {
    cancelRef.current = true;
    setFiles([]);
    setResult(null);
    setError(null);
    setProcessing(false);
    setProg({ percent: 0, rows: 0, bytesDone: 0, totalBytes: 0, filesDone: 0, speed: 0, etaMs: 0, elapsed: 0, currentFile: '' });
    setGlobalSheet('');
  };

  /* ---------- header check (offset by start row) ---------- */
  const headerCheck = useMemo(() => {
    if (!files.length) return null;
    const refFile = files[0];
    const ref = refFile.previewRows[headerIdx] || refFile.headers;
    const refNorm = ref.map((h) => String(h ?? '').trim().toLowerCase());
    return files.map((f) => {
      const h = f.previewRows[headerIdx] || f.headers;
      const norm = h.map((x) => String(x ?? '').trim().toLowerCase());
      const sameCount = h.length === ref.length;
      const sameNames = sameCount && norm.every((v, i) => v === refNorm[i]);
      return { id: f.id, name: f.name, cols: h.length, match: sameNames, sameCount, headers: h, ready: f.ready };
    });
  }, [files, headerIdx]);

  const hasMismatch = useMemo(() => headerCheck?.some((h) => h.ready && !h.match) ?? false, [headerCheck]);

  /* ---------- FAST COMBINE ---------- */
  const handleCombine = useCallback(async () => {
    const readyFiles = files.filter((f) => f.ready && !f.error);
    if (!readyFiles.length || processing) return;
    if (readyFiles.length !== files.length) {
      setError('Please wait — some files are still being inspected.');
      return;
    }
    if (headerMode === 'validate' && hasMismatch) {
      setError('Column mismatch detected — headers differ. Switch Header Mode to "Match columns by name" or "Match columns by position" to continue.');
      return;
    }
    setError(null);
    setResult(null);
    setProcessing(true);
    cancelRef.current = false;

    const totalBytes = readyFiles.reduce((s, f) => s + f.size, 0);
    const tracker = new ProgressTracker(totalBytes);
    const maybeYield = createYielder(40);

    // Show immediate progress feedback
    setProg({ percent: 0, rows: 0, bytesDone: 0, totalBytes, filesDone: 0, speed: 0, etaMs: 0, elapsed: 0, currentFile: 'Starting…' });
    await yieldToUI();
    const eol = lineEnding === 'CRLF' ? '\r\n' : '\n';
    const blobParts: string[] = ['﻿'];
    let outHeader: string[] = [];
    let outCols = 0;
    let totalRows = 0;
    let completedBytes = 0; // fully finished files
    let currentBytes = 0;   // bytes read inside the active file
    const seen = dedupe ? new Set<string>() : null;

    const render = (snap: ReturnType<ProgressTracker['update']>, filesDone: number, currentFile: string) => {
      if (!snap) return;
      setProg({
        percent: snap.percent, rows: snap.rows, bytesDone: snap.bytesDone, totalBytes: snap.totalBytes,
        filesDone, speed: snap.speed, etaMs: snap.etaMs, elapsed: snap.elapsed, currentFile,
      });
    };

    const normalizeRow = (r: string[], cols: number): string[] => {
      let row = r.map((c) => {
        const s = String(c ?? '');
        return trimWs ? s.trim() : s;
      });
      if (row.length < cols) {
        const pad = new Array(cols - row.length).fill('');
        row = row.concat(pad);
      } else if (row.length > cols) row = row.slice(0, cols);
      return row;
    };

    try {
      for (let fi = 0; fi < readyFiles.length; fi++) {
        if (cancelRef.current) throw new Error('cancelled');
        const f = readyFiles[fi];
        const skip = headerIdx;
        setProg((p) => ({ ...p, currentFile: f.name, filesDone: fi }));

        if (isTextExt(f.ext)) {
          // ---- streaming text: % = completed files + bytes read in this file ----
          let skipped = 0;
          let fileHeader: string[] | null = null;
          let idxMap: number[] | null = null;
          const isFirstFile = fi === 0;
          currentBytes = 0;

          await streamTextFile(f.file, f.delimiter, {
            shouldCancel: () => cancelRef.current,
            onProgress: (br) => {
              currentBytes = br;
              render(tracker.update(completedBytes + currentBytes, totalRows), fi, f.name);
            },
            onBatch: async (batch) => {
              const outBatch: string[][] = [];
              for (let bi = 0; bi < batch.length; bi++) {
                const row = batch[bi];
                if (skipped < skip) { skipped++; continue; }
                if (!fileHeader) {
                  fileHeader = row.map((c) => (trimWs ? String(c ?? '').trim() : String(c ?? '')));
                  if (isFirstFile) {
                    outHeader = [...fileHeader];
                    outCols = outHeader.length;
                    blobParts.push(outHeader.map((c) => escapeCsv(c, outDelimiter)).join(outDelimiter) + eol);
                  } else if (headerMode === 'byName') {
                    idxMap = outHeader.map((h) => fileHeader!.findIndex((fh) => String(fh).trim().toLowerCase() === String(h).trim().toLowerCase()));
                  }
                  continue;
                }
                let mapped: string[];
                if (!isFirstFile && headerMode === 'byName' && idxMap) {
                  const src = row;
                  mapped = idxMap.map((idx) => {
                    const v = idx >= 0 && idx < src.length ? String(src[idx] ?? '') : '';
                    return trimWs ? v.trim() : v;
                  });
                } else {
                  mapped = normalizeRow(row, outCols || row.length);
                  if (!outCols) { outCols = mapped.length; }
                }
                if (removeBlanks && mapped.every((c) => c === '')) continue;
                if (seen) {
                  const k = mapped.join('');
                  if (seen.has(k)) continue;
                  seen.add(k);
                }
                outBatch.push(mapped);
              }
              if (outBatch.length) {
                blobParts.push(rowsToCsv(outBatch, outDelimiter) + eol);
                totalRows += outBatch.length;
              }
              // rows grew — repaint only if % actually moved (tracker) + cheap time yield
              render(tracker.update(completedBytes + currentBytes, totalRows), fi, f.name);
              await maybeYield();
            },
          });
          completedBytes += f.size;
          currentBytes = 0;
          render(tracker.update(completedBytes, totalRows, true), fi + 1, f.name);
        } else {
          // ---- excel: read (0→40% of file weight), then row walk (40→100%) ----
          const sheet = f.selectedSheet || f.sheets[0];
          render(tracker.update(completedBytes, totalRows, true), fi, `${f.name} — reading sheet…`);
          await maybeYield(true);
          const { rows } = await loadExcelSheetFull(f.file, sheet);
          if (cancelRef.current) throw new Error('cancelled');
          render(tracker.update(completedBytes + f.size * 0.4, totalRows, true), fi, f.name);
          if (!rows.length || rows.length <= skip) {
            completedBytes += f.size;
            render(tracker.update(completedBytes, totalRows, true), fi + 1, f.name);
            continue;
          }
          const fileHeader = rows[skip].map((c) => (trimWs ? String(c ?? '').trim() : String(c ?? '')));
          const data = rows.slice(skip + 1);
          let idxMap: number[] | null = null;
          if (fi === 0) {
            outHeader = [...fileHeader];
            outCols = outHeader.length;
            blobParts.push(outHeader.map((c) => escapeCsv(c, outDelimiter)).join(outDelimiter) + eol);
          } else if (headerMode === 'byName') {
            idxMap = outHeader.map((h) => fileHeader.findIndex((fh) => String(fh).trim().toLowerCase() === String(h).trim().toLowerCase()));
          }
          const BATCH = 25000;
          for (let i = 0; i < data.length; i += BATCH) {
            if (cancelRef.current) throw new Error('cancelled');
            const slice = data.slice(i, i + BATCH);
            const outBatch: string[][] = new Array(slice.length);
            let kept = 0;
            for (let k = 0; k < slice.length; k++) {
              let mapped: string[];
              if (fi !== 0 && idxMap) {
                const src = slice[k];
                mapped = idxMap.map((idx) => {
                  const v = idx >= 0 && idx < src.length ? String(src[idx] ?? '') : '';
                  return trimWs ? v.trim() : v;
                });
              } else {
                mapped = normalizeRow(slice[k], outCols);
              }
              if (removeBlanks && mapped.every((c) => c === '')) continue;
              if (seen) {
                const key = mapped.join('');
                if (seen.has(key)) continue;
                seen.add(key);
              }
              outBatch[kept++] = mapped;
            }
            outBatch.length = kept;
            if (kept) {
              blobParts.push(rowsToCsv(outBatch, outDelimiter) + eol);
              totalRows += kept;
            }
            const frac = 0.4 + 0.6 * (Math.min(i + BATCH, data.length) / Math.max(1, data.length));
            render(tracker.update(completedBytes + f.size * frac, totalRows, true), fi, f.name);
            await maybeYield();
          }
          completedBytes += f.size;
          render(tracker.update(completedBytes, totalRows, true), fi + 1, f.name);
        }
      }

      if (cancelRef.current) throw new Error('cancelled');
      const done = tracker.complete(totalRows);
      const blob = new Blob(blobParts, { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      setProg({ percent: done.percent, rows: done.rows, bytesDone: done.bytesDone, totalBytes: done.totalBytes, filesDone: readyFiles.length, speed: done.speed, etaMs: 0, elapsed: done.elapsed, currentFile: '' });
      setResult({ url, name: 'combined.csv', rows: totalRows, inputBytes: totalBytes, outputBytes: blob.size, ms: done.elapsed, files: readyFiles.length });
    } catch (e: any) {
      if (e?.message === 'cancelled') {
        setError('Combine cancelled — partial output discarded.');
        setTimeout(() => setError(null), 3500);
        setProg((p) => ({ ...p, percent: 0, currentFile: '' }));
      } else {
        setError(e?.message || 'Combine failed. Please check your files and try again.');
      }
    } finally {
      setProcessing(false);
    }
  }, [files, processing, headerMode, hasMismatch, trimWs, removeBlanks, dedupe, outDelimiter, lineEnding, headerIdx]);

  const allReady = files.length > 0 && files.every((f) => f.ready);
  const totalEstRows = files.reduce((s, f) => s + (f.estimatedRows || 0), 0);
  const totalBytesSel = files.reduce((s, f) => s + f.size, 0);

  return (
    <div className="animate-fade-slide-in">
      <h2 className="section-title">Import Files</h2>
      <p className="section-sub mb-4">Drag and drop multiple CSV, TXT or Excel files — inspected instantly, combined by streaming</p>

      <div
        onDrop={(e) => { e.preventDefault(); setDragActive(false); if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files); }}
        onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
        onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-lg border border-dashed transition-all px-4 py-8 text-center ${dragActive ? 'border-[#2c6bb3] bg-[#eff6ff]' : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'}`}
      >
        <input ref={inputRef} type="file" multiple accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => { if (e.target.files?.length) addFiles(e.target.files); e.target.value = ''; }} />
        <div className="mx-auto w-10 h-10 rounded-lg bg-slate-200/70 flex items-center justify-center mb-3">
          <FileText className="w-5 h-5 text-slate-500" />
        </div>
        <p className="text-sm font-semibold text-slate-700">Drag &amp; drop files here</p>
        <p className="text-[13px] text-slate-500 mt-1">or <span className="text-[#2c6bb3] font-semibold">browse files</span></p>
        <p className="text-xs text-slate-400 font-mono mt-1">.xlsx · .xls · .csv · .txt</p>
        <p className="text-[11px] tracking-wide text-slate-400 mt-2.5 font-semibold uppercase">Output: CSV only</p>
      </div>

      {files.length > 0 && (
        <div className="mt-3 rounded-lg border border-gray-200 divide-y divide-gray-100 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 text-[11px] text-gray-500 font-semibold flex justify-between">
            <span>{files.length} file{files.length > 1 ? 's' : ''} • {formatBytes(totalBytesSel)} • ~{formatNumber(totalEstRows)} rows est.</span>
            {!allReady && <span className="text-amber-600 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> inspecting…</span>}
          </div>
          {files.map((f, i) => (
            <div key={f.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-white hover:bg-gray-50 transition">
              <span className="text-[11px] font-bold text-gray-400 w-5 text-center tabular-nums">{String(i + 1).padStart(2, '0')}</span>
              <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wide ${f.ext === '.csv' ? 'bg-emerald-100 text-emerald-700' : f.ext === '.txt' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                {f.ext.replace('.', '')}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-gray-800 truncate">{f.name}</span>
                  <span className="text-[11px] text-gray-400 shrink-0">{formatBytes(f.size)}</span>
                  {!f.ready && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />}
                </div>
                <div className="text-[11px] text-gray-500 truncate mt-0.5">
                  {f.error ? <span className="text-red-500">{f.error}</span> : !f.ready ? <span className="text-gray-400">Reading header…</span> : <>{formatNumber(f.estimatedRows)} rows est. • {(f.previewRows[headerIdx] || f.headers).length} cols{f.delimiterLabel && f.delimiterLabel !== '—' ? ` • ${f.delimiterLabel}` : ''}{f.selectedSheet ? ` • ${f.selectedSheet}` : ''}</>}
                </div>
                {(f.ext === '.xlsx' || f.ext === '.xls') && f.sheets.length > 1 && (
                  <select value={f.selectedSheet} onChange={(e) => changeFileSheet(f.id, e.target.value)} className="mt-1 text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white text-gray-700 focus:outline-none focus:border-[#3ea36e]">
                    {f.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
              </div>
              <button onClick={(e) => { e.stopPropagation(); removeFile(f.id); }} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition" title="Remove">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <hr className="rule" />

      <h2 className="section-title">Settings</h2>
      <p className="section-sub">Configure how files are combined</p>

      <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <div>
          <label className="field-label">Start Row: <span className="text-red-500">*</span></label>
          <select value={startRow} onChange={(e) => setStartRow(e.target.value)}>
            <option value="1">Row 1 (Include Heading)</option>
            <option value="2">Row 2 (Skip Heading)</option>
            <option value="custom">Custom Row…</option>
          </select>
          {startRow === 'custom' && (
            <input type="number" min={1} value={customRow} onChange={(e) => setCustomRow(e.target.value)} className="mt-2" placeholder="e.g. 5" />
          )}
        </div>
        <div>
          <label className="field-label">Select Sheet: <span className="text-red-500">*</span></label>
          <select value={globalSheet} onChange={(e) => applyGlobalSheet(e.target.value)} disabled={!allSheets.length}>
            <option value="">{allSheets.length ? 'Same sheet for all files…' : 'Import files first…'}</option>
            {allSheets.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          {globalSheet && <p className="text-xs text-slate-500 mt-1.5">Applies <span className="font-semibold text-slate-700">{globalSheet}</span> to every workbook that contains it.</p>}
        </div>

        <div>
          <label className="field-label">TXT / CSV Delimiter</label>
          <select value={txtDelimiter} onChange={(e) => setTxtDelimiter(e.target.value)}>
            <option value="auto">Auto-detect</option>
            <option value=",">Comma (,)</option>
            <option value=";">Semicolon (;)</option>
            <option value="	">Tab</option>
            <option value="|">Pipe (|)</option>
          </select>
        </div>
        <div>
          <label className="field-label">Header Mode</label>
          <select value={headerMode} onChange={(e) => setHeaderMode(e.target.value as HeaderMode)}>
            <option value="validate">Validate all headers</option>
            <option value="first">Use first file header</option>
            <option value="byName">Match columns by name</option>
            <option value="byPosition">Match columns by position</option>
          </select>
        </div>
      </div>

      <h2 className="section-label mt-6">Header Check</h2>
      <div className="mt-3 panel">
        {!files.length && <p className="text-[13px] text-slate-500">Import files to check column headers.</p>}
        {files.length > 0 && headerCheck && (
          <div className="overflow-hidden rounded-md border border-slate-200 bg-white">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-left">
                  <th className="px-3 py-2 font-semibold">File</th>
                  <th className="px-3 py-2 font-semibold text-center w-16">Cols</th>
                  <th className="px-3 py-2 font-semibold text-center w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {headerCheck.map((h) => (
                  <tr key={h.id}>
                    <td className="px-3 py-2 text-slate-700 truncate max-w-[220px]" title={h.headers.join(', ')}>{h.name}</td>
                    <td className="px-3 py-2 text-center text-slate-600 tabular-nums">{h.ready ? h.cols : '…'}</td>
                    <td className="px-3 py-2 text-center">
                      {!h.ready ? <span className="text-[11px] text-gray-400">…</span> : h.match
                        ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600"><Check className="w-3.5 h-3.5" /> Match</span>
                        : <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600"><AlertTriangle className="w-3.5 h-3.5" /> Different</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMismatch && (
              <div className="px-3 py-2 bg-amber-50 border-t border-amber-200 text-[12px] text-amber-700 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>Column mismatch detected. Use “Match columns by name” to align by header names (missing → empty), or “Match by position”.</span>
              </div>
            )}
          </div>
        )}
      </div>

      <button onClick={() => setShowAdvanced(!showAdvanced)} className="mt-3 text-[12px] font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 transition">
        Advanced &amp; Output Options
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>
      {showAdvanced && (
        <div className="mt-2 rounded-md border border-gray-200 p-3.5 grid sm:grid-cols-2 gap-4 animate-fade-slide-in">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Output CSV</p>
            <label className="block text-[12px] text-gray-600 mb-1">Delimiter</label>
            <div className="flex gap-1.5 mb-2.5">
              {[{ v: ',', l: ',' }, { v: ';', l: ';' }, { v: '	', l: 'Tab' }, { v: '|', l: '|' }].map((o) => (
                <button key={o.l} onClick={() => setOutDelimiter(o.v)} className={`px-2.5 py-1 rounded text-[12px] font-bold border transition ${outDelimiter === o.v ? 'bg-[#0f2a4a] text-white border-[#0f2a4a]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>{o.l}</button>
              ))}
            </div>
            <label className="block text-[12px] text-gray-600 mb-1">Line ending</label>
            <div className="flex gap-1.5">
              {(['LF', 'CRLF'] as const).map((o) => (
                <button key={o} onClick={() => setLineEnding(o)} className={`px-2.5 py-1 rounded text-[12px] font-bold border transition ${lineEnding === o ? 'bg-[#0f2a4a] text-white border-[#0f2a4a]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>{o}</button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">Encoding: UTF-8 with BOM • Output always <span className="font-mono font-bold">.csv</span></p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Cleaning (slower)</p>
            {[
              { v: trimWs, s: setTrimWs, l: 'Trim whitespace' },
              { v: removeBlanks, s: setRemoveBlanks, l: 'Remove blank rows' },
              { v: dedupe, s: setDedupe, l: 'Remove duplicate rows' },
            ].map((o) => (
              <label key={o.l} className="flex items-center gap-2 text-[12px] text-gray-600 py-1 cursor-pointer hover:text-gray-900">
                <input type="checkbox" checked={o.v} onChange={() => o.s(!o.v)} className="w-3.5 h-3.5 rounded border-gray-300 accent-[#3ea36e]" /> {o.l}
              </label>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-[12px] text-red-700 flex items-start gap-2 animate-fade-slide-in">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {/* ---- BIG % progress ---- */}
      {processing && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 animate-fade-slide-in shadow-sm">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Processing</p>
              <p className="text-[34px] leading-none font-extrabold text-gray-900 tabular-nums mt-1">{prog.percent}<span className="text-[20px] text-gray-400">%</span></p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-bold text-gray-700 tabular-nums">{prog.filesDone}/{files.length} files</p>
              <p className="text-[11px] text-gray-500 tabular-nums">{formatNumber(prog.rows)} rows</p>
              <button onClick={() => { cancelRef.current = true; }} className="mt-1 text-[11px] font-bold text-red-500 hover:text-red-700 hover:underline">Cancel</button>
            </div>
          </div>
          <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div className="h-full bg-[#3ea36e] rounded-full transition-[width] duration-150" style={{ width: `${prog.percent}%` }} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3.5 text-center">
            <div className="rounded-lg bg-gray-50 px-2 py-2"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Speed</p><p className="text-[13px] sm:text-[12px] font-bold text-gray-800 tabular-nums mt-0.5">{formatBytes(prog.speed)}/s</p></div>
            <div className="rounded-lg bg-gray-50 px-2 py-2"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Done</p><p className="text-[13px] sm:text-[12px] font-bold text-gray-800 tabular-nums mt-0.5">{formatBytes(prog.bytesDone)}</p></div>
            <div className="rounded-lg bg-gray-50 px-2 py-2"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Elapsed</p><p className="text-[13px] sm:text-[12px] font-bold text-gray-800 tabular-nums mt-0.5">{formatDuration(prog.elapsed)}</p></div>
            <div className="rounded-lg bg-gray-50 px-2 py-2"><p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">ETA</p><p className="text-[13px] sm:text-[12px] font-bold text-gray-800 tabular-nums mt-0.5">{prog.etaMs ? formatDuration(prog.etaMs) : '—'}</p></div>
          </div>
          {prog.currentFile && <p className="text-[11px] text-gray-500 mt-2 truncate">Working on: <span className="font-semibold text-gray-700">{prog.currentFile}</span></p>}
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50/60 p-4 animate-fade-slide-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-[#3ea36e] flex items-center justify-center shrink-0"><Check className="w-5 h-5 text-white" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-bold text-gray-900">Combine complete — 100%</p>
              <p className="text-[12px] text-gray-600 mt-0.5">{result.files} files • {formatNumber(result.rows)} rows • In {formatBytes(result.inputBytes)} → Out {formatBytes(result.outputBytes)} • {formatDuration(result.ms)}</p>
              <div className="flex flex-wrap gap-2 mt-3">
                <a href={result.url} download={result.name} className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-white text-[13px] font-bold shadow-sm transition ${GREEN}`}>
                  <FileSpreadsheet className="w-4 h-4" /> Download combined.csv
                </a>
                <button onClick={() => setResult(null)} className="px-3 py-2 rounded-md text-[12px] font-semibold text-gray-500 hover:text-gray-800 hover:underline">Dismiss</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 mt-6">
        <button onClick={clearAll} className="w-full sm:w-auto px-5 py-2.5 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 active:bg-slate-100 transition">Clear All</button>
        <button onClick={handleCombine} disabled={!files.length || processing || !allReady} className={`w-full sm:w-auto px-6 py-2.5 rounded-md text-white text-sm font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${GREEN}`}>
          {processing ? `${prog.percent}% Combining…` : 'Combine Files'}
        </button>
      </div>

      {files.length > 0 && files[0]?.previewRows.length > 0 && !result && (
        <div className="mt-4 rounded-md border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
            <Table2 className="w-3.5 h-3.5" /> Preview — {files[0].name}
          </div>
          <div className="x-scroll">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="bg-white">
                  {(files[0].previewRows[headerIdx] || files[0].previewRows[0])?.map((h, i) => <th key={i} className="text-left px-2.5 py-1.5 font-bold text-gray-700 border-b border-gray-100 whitespace-nowrap max-w-[140px] truncate">{h || `Col ${i + 1}`}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {files[0].previewRows.slice(headerIdx + 1, headerIdx + 4).map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50">{r.map((c, j) => <td key={j} className="px-2.5 py-1.5 text-gray-500 whitespace-nowrap max-w-[140px] truncate">{c}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function escapeCsv(v: string, d: string): string {
  if (v.indexOf('"') === -1 && v.indexOf(d) === -1 && v.indexOf('\n') === -1 && v.indexOf('\r') === -1) return v;
  return '"' + v.replace(/"/g, '""') + '"';
}
