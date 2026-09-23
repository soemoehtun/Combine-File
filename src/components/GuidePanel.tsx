import { ArrowRight, CheckCircle2, FileSpreadsheet, Files, Scissors } from 'lucide-react';

export default function GuidePanel({ onGoCombine, onGoSplit }: { onGoCombine: () => void; onGoSplit: () => void }) {
  return (
    <div className="animate-fade-slide-in">
      {/* combine steps */}
      <div className="rounded-md border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <Files className="w-4 h-4 text-[#3ea36e]" />
          <p className="text-[13px] font-bold text-gray-800">Combining files</p>
        </div>
        <ol className="divide-y divide-gray-100 text-[13px]">
          {[
            ['1', 'Import files', 'Drag & drop multiple .csv, .txt, .xlsx or .xls files. Use the order shown — the combined CSV follows it.'],
            ['2', 'Choose Start Row', 'Row 1 includes the heading. Row 2 skips it. Use Custom (e.g. 5) when reports have title rows on top.'],
            ['3', 'Select Sheet', 'Pick one sheet name to apply to every workbook (e.g. GSM), or pick per-file sheets in the file list. Only the selected sheet is read.'],
            ['4', 'Check headers', 'Green Match = identical columns. Amber Different = counts or names differ. Switch to "Match columns by name" to auto-align.'],
            ['5', 'Combine & download', 'Click Combine Files, watch real progress, then Download combined.csv.'],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-3 px-4 py-2.5">
              <span className="w-5 h-5 rounded-full bg-[#0f2a4a] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
              <span><span className="font-bold text-gray-800">{t} — </span><span className="text-gray-600">{d}</span></span>
            </li>
          ))}
        </ol>
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          <button onClick={onGoCombine} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#3ea36e] hover:underline">Open Combiner Tool <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* split steps */}
      <div className="rounded-md border border-gray-200 overflow-hidden mb-4">
        <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <Scissors className="w-4 h-4 text-[#3ea36e]" />
          <p className="text-[13px] font-bold text-gray-800">Splitting a file</p>
        </div>
        <ol className="divide-y divide-gray-100 text-[13px]">
          {[
            ['1', 'Import one file', 'Upload a CSV, TXT, XLSX or XLS file. A preview of the first rows appears instantly.'],
            ['2', 'Pick a method', 'Rows per file (e.g. 1,000,000), Number of files (e.g. 10), or Maximum size (e.g. 500 MB).'],
            ['3', 'Keep the header', 'Leave "Include header in every output file" on so every part_001.csv, part_002.csv… starts with the same header row.'],
            ['4', 'Excel sheets', 'Choose a single sheet, or tick "Process all sheets" to get filename_GSM.csv, filename_LTE.csv… separately.'],
            ['5', 'Split & download', 'Click Split File, then download parts individually or use Download all.'],
          ].map(([n, t, d]) => (
            <li key={n} className="flex gap-3 px-4 py-2.5">
              <span className="w-5 h-5 rounded-full bg-[#0f2a4a] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n}</span>
              <span><span className="font-bold text-gray-800">{t} — </span><span className="text-gray-600">{d}</span></span>
            </li>
          ))}
        </ol>
        <div className="px-4 py-3 bg-white border-t border-gray-100">
          <button onClick={onGoSplit} className="inline-flex items-center gap-1.5 text-[13px] font-bold text-[#3ea36e] hover:underline">Open Splitter Tool <ArrowRight className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* formats */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-md border border-gray-200 p-3.5">
          <p className="text-[12px] font-bold text-gray-800 flex items-center gap-1.5 mb-2"><FileSpreadsheet className="w-4 h-4 text-[#3ea36e]" /> Supported input</p>
          <div className="flex gap-1.5 flex-wrap">
            {['CSV', 'TXT', 'XLSX', 'XLS'].map((t) => <span key={t} className="px-2 py-0.5 rounded bg-green-50 border border-green-200 text-green-700 text-[11px] font-extrabold">{t}</span>)}
          </div>
          <p className="text-[11px] text-gray-500 mt-2">TXT is treated as delimited data with auto-detection (Tab, Comma, Semicolon, Pipe). Quoted fields, embedded commas and CRLF/LF are handled.</p>
        </div>
        <div className="rounded-md border border-gray-200 p-3.5">
          <p className="text-[12px] font-bold text-gray-800 flex items-center gap-1.5 mb-2"><CheckCircle2 className="w-4 h-4 text-[#3ea36e]" /> Output</p>
          <div className="flex gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded bg-[#0f2a4a] text-white text-[11px] font-extrabold">CSV only</span>
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-400 text-[11px] font-bold line-through">XLSX</span>
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-400 text-[11px] font-bold line-through">XLS</span>
            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-400 text-[11px] font-bold line-through">TXT</span>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">UTF-8 with BOM, configurable delimiter and LF/CRLF line endings.</p>
        </div>
      </div>
    </div>
  );
}
