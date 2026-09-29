import type { ReactNode } from 'react';
import { ArrowRight, Files, Scissors } from 'lucide-react';

type Step = { title: string; text: string };

export default function GuidePanel({ onGoCombine, onGoSplit }: { onGoCombine: () => void; onGoSplit: () => void }) {
  return (
    <div className="animate-fade-slide-in space-y-2.5">
      <GuideFlow
        icon={<Files className="w-3.5 h-3.5" />}
        title="Combine files"
        steps={[
          { title: 'Add files', text: 'Drop several CSV, TXT or Excel files. They merge in the order listed.' },
          { title: 'Start row', text: 'Row 1 keeps headings, Row 2 skips them, or set a custom row.' },
          { title: 'Sheet', text: 'For Excel, choose one sheet name (e.g. GSM) for every workbook.' },
          { title: 'Headers', text: 'Each file shows Match or Different. Use “by name” to align layouts.' },
          { title: 'Download', text: 'Watch the live % progress, then download combined.csv.' },
        ]}
        action="Open Combiner"
        onClick={onGoCombine}
      />

      <GuideFlow
        icon={<Scissors className="w-3.5 h-3.5" />}
        title="Split a file"
        steps={[
          { title: 'Add one file', text: 'Upload a CSV, TXT or Excel file. Rows and columns are detected instantly.' },
          { title: 'Method', text: 'Rows per file, number of files, or maximum size in MB.' },
          { title: 'Header', text: 'Keep the header option on so every part has the same columns.' },
          { title: 'Sheets', text: 'Split one sheet, or tick “Process all sheets” for a set per sheet.' },
          { title: 'Download', text: 'Parts are named name_part_001.csv… Download each or all.' },
        ]}
        action="Open Splitter"
        onClick={onGoSplit}
      />
    </div>
  );
}

function GuideFlow({
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
      <div className="px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-slate-700">
          <span className="text-[#3ea36e]">{icon}</span>
          <h2 className="text-[12px] font-bold">{title}</h2>
        </div>
        <button
          onClick={onClick}
          className="text-[11px] font-semibold text-[#3ea36e] hover:underline flex items-center gap-0.5"
        >
          {action} <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <ol className="divide-y divide-slate-100">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-baseline gap-2 px-2.5 py-1.5">
            <span className="w-3.5 h-3.5 rounded-full bg-[#0f2744] text-white text-[8px] font-bold flex items-center justify-center shrink-0 translate-y-[1px]">
              {i + 1}
            </span>
            <p className="text-[11.5px] leading-[1.35] text-slate-600">
              <span className="font-semibold text-slate-800">{s.title}</span>
              <span className="text-slate-300"> · </span>
              {s.text}
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
