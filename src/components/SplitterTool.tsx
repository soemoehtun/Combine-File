import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Download, FileText, Loader2, Scissors, Table2, X } from 'lucide-react';
import { formatBytes, formatDuration, formatNumber, getExtension, isAllowedExtension, sanitizeFileName } from '../lib/csv';
import { previewTextFile, previewExcelFile, streamTextFile, loadExcelSheetFull, rowsToCsv, yieldToUI, isTextExt, ProgressTracker, createYielder } from '../lib/engine';

interface Loaded {
  file: File;
  name: string;
  size: number;
  ext: string;
  delimiter: string;
  sheets: string[];
  selectedSheet: string;
  headers: string[];
  previewRows: string[][];
  estimatedRows: number;
  ready: boolean;
}

type Method = 'rows' | 'count' | 'size';
const GREEN = 'bg-[#3ea36e] hover:bg-[#35925f]';

export default function SplitterTool() {
  const [data, setData] = useState<Loaded | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [method, setMethod] = useState<Method>('rows');
  const [rowsPerFile, setRowsPerFile] = useState('100000');
  const [fileCount, setFileCount] = useState('10');
  const [maxSizeMB, setMaxSizeMB] = useState('500');
  const [includeHeader, setIncludeHeader] = useState(true);
  const [outDelimiter, setOutDelimiter] = useState(',');
  const [processAllSheets, setProcessAllSheets] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [trimWs, setTrimWs] = useState(false);
  const [removeBlanks, setRemoveBlanks] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [prog, setProg] = useState({ percent: 0, parts: 0, total: 0, rows: 0, bytesDone: 0, totalBytes: 0, speed: 0, etaMs: 0, elapsed: 0, current: '' });
  const [error, setError] = useState<string | null>(null);
  const [parts, setParts] = useState<{ name: string; url: string; size: number; rows: number }[]>([]);
  const [stats, setStats] = useState<{ rows: number; ms: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);

  const loadFile = useCallback(async (file: File) => {
    if (!isAllowedExtension(file.name)) {
      setError('Only CSV, TXT, XLSX and XLS files are supported.');
      setTimeout(() => setError(null), 4000);
      return;
    }
    setError(null);
    setParts([]);
    setStats(null);
    const ext = getExtension(file.name);
    // instant placeholder
    setData({ file, name: file.name, size: file.size, ext, delimiter: ',', sheets: [], selectedSheet: '', headers: [], previewRows: [], estimatedRows: 0, ready: false });
    try {
      if (isTextExt(ext)) {
        const pv = await previewTextFile(file);
        setData({
          file, name: file.name, size: file.size, ext,
          delimiter: pv.delimiter, sheets: [], selectedSheet: '',
          headers: pv.headers, previewRows: pv.previewRows, estimatedRows: pv.estimatedRows, ready: true,
        });
      } else {
        const pv = await previewExcelFile(file);
        const full = await loadExcelSheetFull(file, pv.selectedSheet);
        setData({
          file, name: file.name, size: file.size, ext,
          delimiter: ',', sheets: pv.sheets, selectedSheet: pv.selectedSheet,
          headers: full.headers.length ? full.headers : pv.headers,
          previewRows: [full.headers, ...full.rows.slice(0, 5)],
          estimatedRows: full.totalRows, ready: true,
        });
      }
    } catch (e: any) {
      setError(e?.message || 'Could not read file.');
      setData(null);
    }
  }, []);

  const changeSheet = useCallback(async (sheet: string) => {
    if (!data) return;
    setData({ ...data, selectedSheet: sheet, ready: false });
    try {
      const full = await loadExcelSheetFull(data.file, sheet);
      setData({ ...data, selectedSheet: sheet, headers: full.headers, previewRows: [full.headers, ...full.rows.slice(0, 5)], estimatedRows: full.totalRows, ready: true });
      setParts([]);
      setStats(null);
    } catch {
      setError(`Could not read sheet "${sheet}".`);
      setTimeout(() => setError(null), 3000);
      setData({ ...data, selectedSheet: sheet, ready: true });
    }
  }, [data]);

  const clearAll = () => {
    cancelRef.current = true;
    parts.forEach((p) => URL.revokeObjectURL(p.url));
    setData(null);
    setParts([]);
    setStats(null);
    setError(null);
    setProcessing(false);
    setProg({ percent: 0, parts: 0, total: 0, rows: 0, bytesDone: 0, totalBytes: 0, speed: 0, etaMs: 0, elapsed: 0, current: '' });
  };

  const estimatedParts = (() => {
    if (!data || !data.ready) return 0;
    const n = Math.max(1, data.estimatedRows);
    if (method === 'rows') return Math.max(1, Math.ceil(n / Math.max(1, parseInt(rowsPerFile) || 1)));
    if (method === 'count') return Math.max(1, parseInt(fileCount) || 1);
    const avg = Math.max(30, data.size / n);
    const rowsPerChunk = Math.max(1, Math.floor(((parseFloat(maxSizeMB) || 500) * 1024 * 1024) / avg));
    return Math.max(1, Math.ceil(n / rowsPerChunk));
  })();

  const handleSplit = useCallback(async () => {
    if (!data || !data.ready || processing) return;
    setError(null);
    parts.forEach((p) => URL.revokeObjectURL(p.url));
    setParts([]);
    setStats(null);
    setProcessing(true);
    cancelRef.current = false;

    // Show immediate progress feedback
    setProg({ percent: 0, parts: 0, total: 1, rows: 0, bytesDone: 0, totalBytes: data.size, speed: 0, etaMs: 0, elapsed: 0, current: 'Starting…' });
    await yieldToUI();

    const tracker = new ProgressTracker(data.size);
    const maybeYield = createYielder(40);
    const out: { name: string; url: string; size: number; rows: number }[] = [];
    const baseName = sanitizeFileName(data.name.replace(/\.[^.]+$/, ''));
    const eol = '\n';
    let totalRowsDone = 0;

    const renderBytes = (bytesRead: number, partsDone: number, partsTotal: number, label: string) => {
      const snap = tracker.update(bytesRead, totalRowsDone);
      if (!snap) return;
      setProg({ percent: snap.percent, parts: partsDone, total: partsTotal, rows: snap.rows, bytesDone: snap.bytesDone, totalBytes: snap.totalBytes, speed: snap.speed, etaMs: snap.etaMs, elapsed: snap.elapsed, current: label });
    };

    try {
      if (isTextExt(data.ext)) {
        // ---------- streaming text split ----------
        // determine chunk target
        let rowsTarget = Math.max(1, parseInt(rowsPerFile) || 100000);
        if (method === 'count') {
          const n = Math.max(1, data.estimatedRows);
          rowsTarget = Math.max(1, Math.ceil(n / Math.max(1, parseInt(fileCount) || 1)));
        }
        const maxBytes = method === 'size' ? Math.max(1, (parseFloat(maxSizeMB) || 500) * 1024 * 1024) : Infinity;

        let header: string[] | null = null;
        let headerSkipped = false;
        let partIdx = 1;
        let curRows: string[][] = [];
        let curCount = 0;
        let curBytes = includeHeader && header ? 0 : 0;
        let bytesRead = 0;

        const flushPart = async () => {
          if (!curRows.length) return;
          if (cancelRef.current) throw new Error('cancelled');
          const body = includeHeader && header ? [header, ...curRows] : curRows;
          const csv = rowsToCsv(body, outDelimiter) + eol;
          const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const name = `${baseName}_part_${String(partIdx).padStart(3, '0')}.csv`;
          out.push({ name, url, size: blob.size, rows: curCount });
          setParts([...out]);
          totalRowsDone += curCount;
          partIdx++;
          curRows = [];
          curCount = 0;
          curBytes = 0;
          const snap = tracker.update(bytesRead, totalRowsDone, true);
          if (snap) setProg({ percent: snap.percent, parts: out.length, total: Math.max(estimatedParts, out.length), rows: snap.rows, bytesDone: snap.bytesDone, totalBytes: snap.totalBytes, speed: snap.speed, etaMs: snap.etaMs, elapsed: snap.elapsed, current: name });
          await maybeYield();
        };

        await streamTextFile(data.file, data.delimiter, {
          shouldCancel: () => cancelRef.current,
          onProgress: (br) => {
            bytesRead = br;
            renderBytes(br, out.length, Math.max(estimatedParts, out.length + (curCount > 0 ? 1 : 0)), `Writing ${String(partIdx).padStart(3, '0')}.csv…`);
          },
          onBatch: async (batch) => {
            for (let i = 0; i < batch.length; i++) {
              const row = batch[i];
              if (!headerSkipped) {
                header = row.map((c) => (trimWs ? String(c ?? '').trim() : String(c ?? '')));
                headerSkipped = true;
                continue;
              }
              let r = row.map((c) => (trimWs ? String(c ?? '').trim() : String(c ?? '')));
              // normalize to header width
              if (header && r.length < header.length) r = r.concat(new Array(header.length - r.length).fill(''));
              else if (header && r.length > header.length) r = r.slice(0, header.length);
              if (removeBlanks && r.every((c) => c === '')) continue;
              curRows.push(r);
              curCount++;
              curBytes += r.join(',').length + 1;
              const full = method === 'size' ? curBytes >= maxBytes : curCount >= rowsTarget;
              if (full) await flushPart();
            }
            renderBytes(bytesRead, out.length, Math.max(estimatedParts, out.length + (curCount > 0 ? 1 : 0)), `Writing ${String(partIdx).padStart(3, '0')}.csv…`);
          },
        });

        if (cancelRef.current) throw new Error('cancelled');
        await flushPart();
        const done = tracker.complete(totalRowsDone);
        setStats({ rows: totalRowsDone, ms: done.elapsed });
        setProg({ percent: 100, parts: out.length, total: out.length, rows: done.rows, bytesDone: done.bytesDone, totalBytes: done.totalBytes, speed: done.speed, etaMs: 0, elapsed: done.elapsed, current: '' });
      } else {
        // ---------- excel split ----------
        const jobs: { sheetName: string; headers: string[]; rows: string[][] }[] = [];
        if (processAllSheets && data.sheets.length > 1) {
          for (const sh of data.sheets) {
            if (cancelRef.current) throw new Error('cancelled');
            setProg((p) => ({ ...p, current: `Reading ${sh}…` }));
            const full = await loadExcelSheetFull(data.file, sh);
            let rows = full.rows.slice(1).map((r) => r.map((c) => (trimWs ? String(c ?? '').trim() : String(c ?? ''))));
            if (removeBlanks) rows = rows.filter((r) => !r.every((c) => c === ''));
            if (rows.length) jobs.push({ sheetName: sh, headers: full.headers, rows });
          }
          if (!jobs.length) throw new Error('No sheets contain data.');
        } else {
          setProg((p) => ({ ...p, current: `Reading ${data.selectedSheet}…` }));
          const full = await loadExcelSheetFull(data.file, data.selectedSheet);
          let rows = full.rows.slice(1).map((r) => r.map((c) => (trimWs ? String(c ?? '').trim() : String(c ?? ''))));
          if (removeBlanks) rows = rows.filter((r) => !r.every((c) => c === ''));
          jobs.push({ sheetName: '', headers: full.headers, rows });
        }

        const totalAllRows = jobs.reduce((s, j) => s + j.rows.length, 0);
        // plan chunks
        let totalChunks = 0;
        const plans = jobs.map((j) => {
          const n = j.rows.length;
          let chunk = Math.max(1, parseInt(rowsPerFile) || 100000);
          if (method === 'count') chunk = Math.max(1, Math.ceil(n / Math.max(1, parseInt(fileCount) || 1)));
          if (method === 'size') {
            const avg = Math.max(30, data.size / Math.max(1, n));
            chunk = Math.max(1, Math.floor(((parseFloat(maxSizeMB) || 500) * 1024 * 1024) / avg));
          }
          const count = Math.max(1, Math.ceil(n / chunk));
          totalChunks += count;
          return { job: j, chunk, count };
        });

        let done = 0;
        let rowsDone = 0;
        for (const plan of plans) {
          const { job, chunk, count } = plan;
          for (let p = 0; p < count; p++) {
            if (cancelRef.current) throw new Error('cancelled');
            const slice = job.rows.slice(p * chunk, (p + 1) * chunk);
            const body = includeHeader ? [job.headers, ...slice] : slice;
            const csv = rowsToCsv(body, outDelimiter) + eol;
            const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const suffix = job.sheetName ? `_${sanitizeFileName(job.sheetName)}` : '';
            const name = count === 1 && !job.sheetName ? `${baseName}.csv` : `${baseName}${suffix}_part_${String(p + 1).padStart(3, '0')}.csv`;
            out.push({ name, url, size: blob.size, rows: slice.length });
            setParts([...out]);
            done++;
            rowsDone += slice.length;
            totalRowsDone = rowsDone;
            // % from rows completed vs total rows — monotonic via tracker
            const fracBytes = totalAllRows ? (rowsDone / totalAllRows) * data.size : data.size;
            const snap = tracker.update(fracBytes, rowsDone, true);
            if (snap) setProg({ percent: snap.percent, parts: done, total: totalChunks, rows: snap.rows, bytesDone: snap.bytesDone, totalBytes: snap.totalBytes, speed: snap.speed, etaMs: snap.etaMs, elapsed: snap.elapsed, current: name });
            await maybeYield();
          }
        }
        const doneSnap = tracker.complete(rowsDone);
        setStats({ rows: rowsDone, ms: doneSnap.elapsed });
        setProg({ percent: 100, parts: done, total: totalChunks, rows: doneSnap.rows, bytesDone: doneSnap.bytesDone, totalBytes: doneSnap.totalBytes, speed: doneSnap.speed, etaMs: 0, elapsed: doneSnap.elapsed, current: '' });
      }
    } catch (e: any) {
      if (e?.message === 'cancelled') {
        out.forEach((o) => URL.revokeObjectURL(o.url));
        setParts([]);
        setError('Split cancelled — temporary parts discarded.');
        setTimeout(() => setError(null), 3500);
        setProg((p) => ({ ...p, percent: 0, current: '' }));
      } else {
        setError(e?.message || 'Split failed.');
      }
    } finally {
      setProcessing(false);
    }
  }, [data, processing, method, rowsPerFile, fileCount, maxSizeMB, includeHeader, outDelimiter, processAllSheets, trimWs, removeBlanks, estimatedParts, parts]);

  const downloadAll = () => {
    parts.forEach((p, i) => {
      setTimeout(() => {
        const a = document.createElement('a');
        a.href = p.url;
        a.download = p.name;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }, i * 350);
    });
  };

  return (
    <div className="animate-fade-slide-in">
      <h2 className="section-title">Import File</h2>
      <p className="section-sub mb-4">Upload one CSV, TXT or Excel file — preview is instant, splitting is streamed</p>

      {!data ? (
        <div
          onDrop={(e) => { e.preventDefault(); setDragActive(false); const f = e.dataTransfer.files?.[0]; if (f) loadFile(f); }}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer rounded-lg border border-dashed transition-all px-4 py-8 text-center ${dragActive ? 'border-[#2c6bb3] bg-[#eff6ff]' : 'border-slate-300 bg-slate-50 hover:border-slate-400 hover:bg-slate-100'}`}
        >
          <input ref={inputRef} type="file" accept=".csv,.txt,.xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); e.target.value = ''; }} />
          <div className="mx-auto w-10 h-10 rounded-lg bg-slate-200/70 flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-slate-500" />
          </div>
          <p className="text-sm font-semibold text-slate-700">Drag &amp; drop file here</p>
          <p className="text-[13px] text-slate-500 mt-1">or <span className="text-[#2c6bb3] font-semibold">browse file</span></p>
          <p className="text-xs text-slate-400 font-mono mt-1">.xlsx · .xls · .csv · .txt</p>
          <p className="text-[11px] tracking-wide text-slate-400 mt-2.5 font-semibold uppercase">Output: CSV only</p>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="flex items-center gap-2.5 px-3.5 py-3">
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded uppercase ${data.ext === '.csv' ? 'bg-emerald-100 text-emerald-700' : data.ext === '.txt' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{data.ext.replace('.', '')}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-gray-800 truncate">{data.name}</p>
              <p className="text-[11px] text-gray-500">
                {formatBytes(data.size)} • {!data.ready ? 'Inspecting…' : <>{formatNumber(data.estimatedRows)} rows est. • {data.headers.length} cols</>}
              </p>
            </div>
            {!data.ready && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
            <button onClick={clearAll} className="p-1.5 rounded-md text-gray-400 hover:text-red-500 hover:bg-red-50 transition" title="Remove"><X className="w-4 h-4" /></button>
          </div>
          {data.ready && data.previewRows.length > 0 && (
            <div className="border-t border-gray-100 x-scroll">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="bg-gray-50">
                    {data.previewRows[0]?.map((h, i) => <th key={i} className="text-left px-2.5 py-1.5 font-bold text-gray-600 whitespace-nowrap max-w-[130px] truncate">{h || `Col ${i + 1}`}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.previewRows.slice(1, 4).map((r, i) => (
                    <tr key={i}>{r.map((c, j) => <td key={j} className="px-2.5 py-1.5 text-gray-500 whitespace-nowrap max-w-[130px] truncate">{c}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <hr className="rule" />

      <h2 className="section-title">Settings</h2>
      <p className="section-sub">Configure how the file is split</p>

      <div className="mt-5 grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
        <div>
          <label className="field-label">Split Method: <span className="text-red-500">*</span></label>
          <select value={method} onChange={(e) => setMethod(e.target.value as Method)}>
            <option value="rows">Rows per file</option>
            <option value="count">Number of files</option>
            <option value="size">Maximum file size</option>
          </select>
        </div>
        <div>
          <label className="field-label">
            {method === 'rows' ? 'Rows per file:' : method === 'count' ? 'Number of files:' : 'Maximum size (MB):'} <span className="text-red-500">*</span>
          </label>
          {method === 'rows' && <input type="number" min={1} value={rowsPerFile} onChange={(e) => setRowsPerFile(e.target.value)} />}
          {method === 'count' && <input type="number" min={2} max={999} value={fileCount} onChange={(e) => setFileCount(e.target.value)} />}
          {method === 'size' && <input type="number" min={1} value={maxSizeMB} onChange={(e) => setMaxSizeMB(e.target.value)} />}
        </div>
      </div>

      {data && data.ready && (data.ext === '.xlsx' || data.ext === '.xls') && (
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 mt-4">
          <div>
            <label className="field-label">Select Sheet: <span className="text-red-500">*</span></label>
            <select value={data.selectedSheet} onChange={(e) => changeSheet(e.target.value)}>
              {data.sheets.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer hover:text-slate-900">
              <input type="checkbox" checked={processAllSheets} onChange={() => setProcessAllSheets(!processAllSheets)} />
              Process all sheets <span className="text-slate-400">(one CSV set per sheet)</span>
            </label>
          </div>
        </div>
      )}

      <label className="flex items-center gap-2 text-[13px] text-slate-700 mt-4 cursor-pointer hover:text-slate-900 font-medium">
        <input type="checkbox" checked={includeHeader} onChange={() => setIncludeHeader(!includeHeader)} />
        Include header in every output file
      </label>

      <h2 className="section-label mt-6">Output Preview</h2>
      <div className="mt-3 panel">
        {!data && <p className="text-[13px] text-slate-500">Import a file to preview split output.</p>}
        {data && !data.ready && <p className="text-[13px] text-slate-500">Inspecting file…</p>}
        {data && data.ready && (
          <p className="text-[13px] text-slate-600 leading-6">
            Will generate <span className="font-semibold text-slate-900">~{estimatedParts} CSV file{estimatedParts === 1 ? '' : 's'}</span> from <span className="font-semibold">{formatNumber(data.estimatedRows)} rows est.</span>
            {data.selectedSheet && <span> (sheet <span className="font-semibold text-slate-700">{data.selectedSheet}</span>)</span>} • naming: <span className="font-mono text-xs">name_part_001.csv</span>
          </p>
        )}
      </div>

      <button onClick={() => setShowAdvanced(!showAdvanced)} className="mt-3 text-[12px] font-semibold text-gray-500 hover:text-gray-800 flex items-center gap-1 transition">
        Advanced &amp; Output Options
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
      </button>
      {showAdvanced && (
        <div className="mt-2 rounded-md border border-gray-200 p-3.5 grid sm:grid-cols-2 gap-4 animate-fade-slide-in">
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Output CSV delimiter</p>
            <div className="flex gap-1.5">
              {[{ v: ',', l: ',' }, { v: ';', l: ';' }, { v: '	', l: 'Tab' }, { v: '|', l: '|' }].map((o) => (
                <button key={o.l} onClick={() => setOutDelimiter(o.v)} className={`px-2.5 py-1 rounded text-[12px] font-bold border transition ${outDelimiter === o.v ? 'bg-[#0f2a4a] text-white border-[#0f2a4a]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}>{o.l}</button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-2">UTF-8 with BOM • LF line endings • Always <span className="font-mono font-bold">.csv</span></p>
          </div>
          <div>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">Cleaning</p>
            <label className="flex items-center gap-2 text-[12px] text-gray-600 py-1 cursor-pointer"><input type="checkbox" checked={trimWs} onChange={() => setTrimWs(!trimWs)} className="w-3.5 h-3.5 accent-[#3ea36e]" /> Trim whitespace</label>
            <label className="flex items-center gap-2 text-[12px] text-gray-600 py-1 cursor-pointer"><input type="checkbox" checked={removeBlanks} onChange={() => setRemoveBlanks(!removeBlanks)} className="w-3.5 h-3.5 accent-[#3ea36e]" /> Remove blank rows</label>
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-[12px] text-red-700 flex items-start gap-2 animate-fade-slide-in">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> <span>{error}</span>
        </div>
      )}

      {processing && (
        <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4 animate-fade-slide-in shadow-sm">
          <div className="flex items-end justify-between mb-2">
            <div>
              <p className="text-[12px] font-bold text-gray-500 uppercase tracking-wide">Processing</p>
              <p className="text-[34px] leading-none font-extrabold text-gray-900 tabular-nums mt-1">{prog.percent}<span className="text-[20px] text-gray-400">%</span></p>
            </div>
            <div className="text-right">
              <p className="text-[12px] font-bold text-gray-700 tabular-nums">{prog.parts}/{prog.total || '…'} parts</p>
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
          {prog.current && <p className="text-[11px] text-gray-500 mt-2 truncate">Writing: <span className="font-semibold text-gray-700">{prog.current}</span></p>}
        </div>
      )}

      {parts.length > 0 && !processing && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50/60 p-4 animate-fade-slide-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-bold text-gray-900 flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-[#3ea36e] flex items-center justify-center"><Check className="w-4 h-4 text-white" /></span> Split complete — 100% • {parts.length} CSV files</p>
            {parts.length > 1 && (
              <button onClick={downloadAll} className="inline-flex items-center gap-1.5 text-[12px] font-bold text-[#3ea36e] hover:underline"><Download className="w-3.5 h-3.5" /> Download all</button>
            )}
          </div>
          {stats && <p className="text-[12px] text-gray-600 mb-3">{formatNumber(stats.rows)} rows split in {formatDuration(stats.ms)} • each part keeps the header</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 sm:max-h-64 overflow-y-auto pr-0.5">
            {parts.map((p) => (
              <a key={p.url} href={p.url} download={p.name} className="flex items-center gap-2.5 px-3 py-3 sm:py-2.5 rounded-lg bg-white border border-green-100 hover:border-[#3ea36e] hover:shadow-sm active:bg-green-50 transition group">
                <Scissors className="w-4 h-4 text-[#3ea36e] shrink-0" />
                <span className="flex-1 min-w-0">
                  <span className="block text-[12px] font-bold text-gray-800 truncate group-hover:text-[#3ea36e]">{p.name}</span>
                  <span className="block text-[11px] text-gray-500">{formatNumber(p.rows)} rows • {formatBytes(p.size)}</span>
                </span>
                <Download className="w-4 h-4 text-gray-300 group-hover:text-[#3ea36e] shrink-0 transition" />
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5 mt-6">
        <button onClick={clearAll} className="w-full sm:w-auto px-5 py-2.5 rounded-md border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 active:bg-slate-100 transition">Clear All</button>
        <button onClick={handleSplit} disabled={!data || !data.ready || processing} className={`w-full sm:w-auto px-6 py-2.5 rounded-md text-white text-sm font-semibold shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed ${GREEN}`}>
          {processing ? `${prog.percent}% Splitting…` : 'Split File'}
        </button>
      </div>

      {data && data.ready && (
        <div className="mt-4 rounded-md border border-gray-200 overflow-hidden">
          <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-1.5 text-[11px] font-bold text-gray-500 uppercase tracking-wide">
            <Table2 className="w-3.5 h-3.5" /> Full preview — first rows
          </div>
          <div className="x-scroll max-h-48 overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0">
                <tr className="bg-white">
                  {data.headers?.map((h, i) => <th key={i} className="text-left px-2.5 py-1.5 font-bold text-gray-700 border-b border-gray-100 whitespace-nowrap max-w-[140px] truncate bg-white">{h || `Col ${i + 1}`}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.previewRows.slice(1, 9).map((r, i) => (
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
