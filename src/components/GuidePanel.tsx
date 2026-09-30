import type { ReactNode } from 'react';
import { ArrowRight, CheckCircle2, FileSpreadsheet, Files, Scissors } from 'lucide-react';

type Step = { t: string; d: string };

export default function GuidePanel({
  onGoCombine,
  onGoSplit,
}: {
  onGoCombine: () => void;
  onGoSplit: () => void;
}) {
  return (
    <div className="animate-fade-slide-in space-y-3">
      {/* format rule */}
      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
        <FileSpreadsheet className="w-4 h-4 text-[#2c6bb3]" />
        <span className="font-semibold text-slate-700">Input:</span>
        {['CSV', 'TXT', 'XLSX', 'XLS'].map((t) => (
          <span key={t} className="font-mono text-[11px] rounded bg-white border border-slate-200 px-1.5 py-px text-slate-600">{t}</span>
        ))}
        <span className="text-slate-300">→</span>
        <CheckCircle2 className="w-4 h-4 text-[#3ea36e]" />
        <span className="font-semibold text-slate-700">Output is always CSV</span>
        <span className="text-slate-400">·</span>
        <span className="text-slate-500">UTF-8 with BOM</span>
      </div>

      <GuideBlock
        icon={<Files className="w-3.5 h-3.5" />}
        title="Combine files"
        steps={[
          { t: 'Add files', d: 'Drop CSV, TXT or Excel — merged in list order.' },
          { t: 'Start row', d: 'Row 1 keeps headings, Row 2 skips, or set a custom row.' },
          { t: 'Sheet', d: 'Excel: choose one sheet name (e.g. GSM) for every workbook.' },
          { t: 'Headers', d: 'Each file shows Match or Different. Use Match by name to align.' },
          { t: 'Download', d: 'Run and download combined.csv.' },
        ]}
        action="Open Combiner"
        onClick={onGoCombine}
      />

      <GuideBlock
        icon={<Scissors className="w-3.5 h-3.5" />}
        title="Split a file"
        steps={[
          { t: 'Add one file', d: 'Header and row count are detected instantly.' },
          { t: 'Method', d: 'Rows per file, number of files, or max size (MB).' },
          { t: 'Header', d: 'Keep header on so every part starts with column names.' },
          { t: 'Sheets', d: 'One sheet, or “Process all sheets” for a set per sheet.' },
          { t: 'Download', d: 'Parts named name_part_001.csv, 002.csv…' },
        ]}
        action="Open Splitter"
        onClick={onGoSplit}
      />

    </div>
  );
}

function GuideBlock({
  icon,
  title,
  steps,
  action,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  steps: Step[];
  action: string;
  onClick: () => void;
}) {
  return (
    <section className="rounded-md border border-slate-200 overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-1.5 text-slate-700">
          <span className="text-[#3ea36e]">{icon}</span>
          <h2 className="text-[12px] font-bold">{title}</h2>
        </div>
        <button
          onClick={onClick}
          className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-[#3ea36e] hover:underline"
        >
          {action} <ArrowRight className="w-3 h-3" />
        </button>
      </header>
      <ol className="divide-y divide-slate-100">
        {steps.map((s, i) => (
          <li key={s.t} className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] leading-5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#0f2744] text-white text-[8px] font-bold flex items-center justify-center shrink-0 tabular-nums">
              {i + 1}
            </span>
            <span className="text-slate-800 font-medium shrink-0">{s.t}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-500 truncate">{s.d}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}


