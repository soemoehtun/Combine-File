import { useState } from 'react';
import CombineTool from './components/CombineTool';
import SplitterTool from './components/SplitterTool';
import GuidePanel from './components/GuidePanel';

type Tab = 'combine' | 'split' | 'guide';

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: 'combine', label: 'Combiner Tool', short: 'Combine' },
  { id: 'split', label: 'Splitter Tool', short: 'Split' },
  { id: 'guide', label: 'User Guide', short: 'Guide' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('combine');

  return (
    <div className="app-shell">
      <div className="app-card">
        {/* Navy header — extends under the phone status bar / notch via the safe-area inset */}
        <header className="app-header mobile-safe-header">
          <h1 className="app-title">Excel Files Combiner &amp; Splitter</h1>
          <p className="app-sub">
            Merge multiple CSV, TXT or Excel files into one CSV. Split large files into smaller CSVs.
          </p>

          <nav className="app-tabs no-scrollbar" role="tablist" aria-label="Tools">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={`app-tab ${tab === t.id ? 'is-active' : ''}`}
              >
                <span className="hidden xs:inline">{t.label}</span>
                <span className="xs:hidden">{t.short}</span>
              </button>
            ))}
          </nav>
        </header>

        <main className="app-body">
          {tab === 'combine' && <CombineTool />}
          {tab === 'split' && <SplitterTool />}
          {tab === 'guide' && (
            <GuidePanel onGoCombine={() => setTab('combine')} onGoSplit={() => setTab('split')} />
          )}
        </main>
      </div>
    </div>
  );
}
