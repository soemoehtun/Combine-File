import { useState } from 'react';
import CombineTool from './components/CombineTool';
import SplitterTool from './components/SplitterTool';
import GuidePanel from './components/GuidePanel';

type Tab = 'combine' | 'split' | 'guide';

export default function App() {
  const [tab, setTab] = useState<Tab>('combine');

  return (
    <div className="min-h-screen bg-white sm:bg-[#e8eaf0] px-0 py-0 sm:px-4 sm:py-9">
      <div className="max-w-[660px] mx-auto w-full">
        <div className="bg-white rounded-none sm:rounded-xl overflow-hidden shadow-none sm:shadow-[0_2px_12px_rgba(15,42,74,0.08)] border-0 sm:border sm:border-white min-h-screen sm:min-h-0">
          {/* Header — full-bleed on mobile, compact */}
          <div className="bg-[#0f2a4a] px-3 sm:px-6 pt-3 sm:pt-5 pb-0">
            <h1 className="text-[18px] sm:text-[22px] font-extrabold text-white tracking-tight leading-tight break-words">
              Excel Files Combiner &amp; Splitter
            </h1>
            <p className="text-[11.5px] sm:text-[12.5px] text-slate-300 mt-0.5 leading-snug max-w-full">
              Merge multiple CSV, TXT or Excel files into one CSV. Split large files into smaller CSVs.
            </p>
            <div className="flex items-end gap-1 sm:gap-1.5 mt-4 sm:mt-8 sm:pt-1 overflow-x-auto">
              <TabButton active={tab === 'combine'} onClick={() => setTab('combine')}>
                Combiner Tool
              </TabButton>
              <TabButton active={tab === 'split'} onClick={() => setTab('split')}>
                Splitter Tool
              </TabButton>
              <TabButton active={tab === 'guide'} onClick={() => setTab('guide')}>
                User Guide
              </TabButton>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 bg-white">
            {tab === 'combine' && <CombineTool />}
            {tab === 'split' && <SplitterTool />}
            {tab === 'guide' && (
              <GuidePanel onGoCombine={() => setTab('combine')} onGoSplit={() => setTab('split')} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap shrink-0 text-[12px] sm:text-[13px] px-3 sm:px-4 py-1.5 rounded-t-md font-semibold transition-all relative ${
        active
          ? 'bg-white text-gray-900 shadow-sm'
          : 'text-slate-200 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}
