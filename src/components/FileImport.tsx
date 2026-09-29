import React, { useRef, useState } from 'react';

const ACCENT = '#0284c7';

/* ---------------- Compact dropzone (empty state) ---------------- */
export function Dropzone({
  multiple = false,
  loading = false,
  loadingText = 'Reading and parsing data...',
  hint = 'browse files (.csv, .txt, .xlsx, .xls)',
  label = 'Drag & drop your data file here',
  onFiles,
}: {
  multiple?: boolean;
  loading?: boolean;
  loadingText?: string;
  hint?: string;
  label?: string;
  onFiles: (files: FileList) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div className="w-full">
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept=".csv,.txt,.tsv,.xlsx,.xlsb,.xls,.xlsm"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <div
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          if (e.dataTransfer.files?.length) onFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
        onClick={() => inputRef.current?.click()}
        className={`relative rounded-lg sm:rounded-md border-[1.5px] sm:border border-dashed px-4 py-8 sm:py-5 text-center cursor-pointer transition bg-white ${
          isDragOver ? 'border-[#0284c7] bg-sky-50/50' : 'border-slate-300 hover:border-[#0284c7]'
        }`}
      >
        <div className="flex flex-col items-center justify-center">
          <div className="text-[26px] sm:text-[22px] leading-none select-none">📁</div>
          <p className="mt-2 sm:mt-1.5 text-[14px] sm:text-[13px] text-slate-700">{label}</p>
          <p className="text-[12px]">
            <span className="text-slate-500">or </span>
            <span className="text-[#0284c7] font-medium">{hint}</span>
          </p>
        </div>

        {loading && (
          <div className="absolute inset-0 bg-white/85 rounded-md flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-[#0284c7] font-medium">
              <span className="w-4 h-4 border-2 border-[#0284c7]/30 border-t-[#0284c7] rounded-full animate-spin" />
              {loadingText}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- Compact loaded-file row ---------------- */
export function FileRow({
  name,
  size,
  meta,
  index,
  badge,
  loading,
  status,
  onRemove,
  children,
}: {
  name: string;
  size: string;
  meta: React.ReactNode;
  index?: number;
  badge?: string;
  loading?: boolean;
  status?: React.ReactNode;
  onRemove: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-slate-300 bg-white px-3 py-2 transition">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          {typeof index === 'number' ? (
            <span className="mt-0.5 text-[11px] font-mono text-slate-400 tabular-nums w-4 text-right shrink-0">
              {index}
            </span>
          ) : (
            <span className="text-base leading-none mt-0.5">📁</span>
          )}
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-slate-900 truncate">
              {name}{' '}
              <span className="font-mono font-normal text-[11px] text-slate-500">({size})</span>
              {badge && (
                <span className="ml-1.5 align-middle rounded bg-slate-100 px-1 py-px font-mono text-[10px] uppercase text-slate-500">
                  {badge}
                </span>
              )}
            </p>
            <p className="text-[11px] text-slate-500">
              {loading ? <span className="text-slate-400">Reading…</span> : meta}
            </p>
            {children}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {status}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label="Remove file"
            className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export { ACCENT };
