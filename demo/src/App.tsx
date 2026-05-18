/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { 
  Search as SearchIcon, 
  Monitor as ScannerIcon, 
  CheckSquare as VerificationIcon, 
  Settings as SettingsIcon, 
  User as ProfileIcon,
  Bell,
  Wifi,
  MoreVertical,
  Download,
  FolderOpen,
  Play,
  RefreshCw as SyncIcon, 
  CheckCircle,
  AlertTriangle,
  History,
  Star,
  Filter,
  SortAsc,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Timer,
  Languages,
  ArrowRight,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { translations } from './i18n';

type View = 'search' | 'scanner' | 'verification' | 'settings';
type Language = 'en' | 'zh';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('scanner');
  const [language, setLanguage] = useState<Language>('en');

  const t = translations[language];

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">
      {/* SideNavBar */}
      <aside className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-outline-variant/30 bg-surface-container-low px-4 py-6">
        <div className="mb-8 px-2">
          <h1 className="text-2xl font-bold text-primary">{t.title}</h1>
          <p className="text-sm text-on-surface-variant">{t.subtitle}</p>
        </div>
        
        <nav className="flex-1 space-y-1">
          {[
            { id: 'search', label: t.search, icon: SearchIcon },
            { id: 'scanner', label: t.scanner, icon: ScannerIcon },
            { id: 'verification', label: t.verification, icon: VerificationIcon },
            { id: 'settings', label: t.settings, icon: SettingsIcon },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id as View)}
                className={`flex w-full items-center gap-4 rounded-lg p-3 transition-all active:scale-95 duration-100 ${
                  isActive 
                    ? 'bg-surface-container-high text-primary font-bold border-r-2 border-primary' 
                    : 'text-on-surface-variant font-medium hover:bg-surface-container-high'
                }`}
              >
                <Icon className={isActive ? 'text-primary' : ''} size={20} />
                <span className="text-sm">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-outline-variant/30 pt-4">
          <button className="flex w-full items-center gap-4 rounded-lg p-3 text-on-surface-variant font-medium transition-all hover:bg-surface-container-high active:scale-95 duration-100">
            <ProfileIcon size={20} />
            <span className="text-sm">{t.profile}</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="ml-64 flex min-h-screen flex-1 flex-col overflow-y-auto">
        {/* TopNavBar */}
        <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-outline-variant/30 bg-surface px-8">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-black text-on-surface">{t.title}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex gap-4 items-center">
              <button 
                onClick={() => setLanguage(language === 'en' ? 'zh' : 'en')}
                className="flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container px-3 py-1 text-xs font-bold text-on-surface-variant transition-all hover:border-primary active:scale-95"
              >
                <Languages size={14} />
                {language === 'en' ? 'EN' : '中文'}
              </button>
              <button className="text-on-surface-variant transition-all duration-200 hover:text-primary">
                <Bell size={20} />
              </button>
              <button className="text-on-surface-variant transition-all duration-200 hover:text-primary">
                <Wifi size={20} />
              </button>
            </div>
            <div className="h-8 w-8 overflow-hidden rounded-full border border-outline-variant">
              <img 
                src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?q=80&w=100&auto=format&fit=crop" 
                alt="Profile" 
                className="h-full w-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        {/* View Content */}
        <div className="p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {currentView === 'scanner' && <ScannerView language={language} t={t} />}
              {currentView === 'verification' && <VerificationView language={language} t={t} />}
              {currentView === 'search' && <SearchView language={language} t={t} />}
              {currentView === 'settings' && <SettingsView language={language} t={t} />}
            </motion.div>
          </AnimatePresence>
        </div>
        
        <footer className="mt-auto border-t border-outline-variant/30 px-8 py-6 text-center">
          <p className="text-xs text-on-surface-variant">{t.v2_text}</p>
        </footer>
      </main>
    </div>
  );
}

// Sub-views implementation goes here... (Internal components)
function ScannerView({ t }: { language: Language, t: any }) {
  return (
    <div className="mx-auto w-full max-w-7xl space-y-8">
       <section className="grid grid-cols-1 gap-6 md:grid-cols-4">
          <div className="ghost-border col-span-2 flex items-center justify-between rounded-xl bg-surface-container p-6">
            <div>
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t.library_path}</p>
              <h2 className="text-xl font-bold">/mnt/media/jellyfin/movies</h2>
            </div>
            <button className="rounded-lg bg-surface-container-high p-3 transition-colors hover:bg-outline-variant">
              <FolderOpen size={24} />
            </button>
          </div>
          <div className="ghost-border rounded-xl bg-surface-container p-6">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t.total_files}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold">1,428</span>
              <span className="text-sm text-on-surface-variant">{t.items}</span>
            </div>
          </div>
          <div className="ghost-border rounded-xl bg-surface-container p-6">
            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t.missing_subs}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-tertiary">342</span>
              <span className="text-sm text-on-surface-variant">24%</span>
            </div>
          </div>
       </section>

       <section className="ghost-border space-y-6 rounded-xl bg-surface-container-low p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <SyncIcon size={24} className="animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{t.active_jellyfin_scan}</h3>
                <p className="text-sm text-on-surface-variant">{t.sync_desc}</p>
              </div>
            </div>
            <button className="flex items-center gap-2 rounded-lg bg-primary-container px-6 py-3 text-xs font-bold text-on-primary-container transition-all hover:brightness-110 active:scale-95">
              <Play size={16} fill="currentColor" />
              {t.scan_now}
            </button>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span>{t.scanning}: <span className="text-primary font-medium">Dune.Part.Two.2024.2160p.mkv</span></span>
              <span className="font-bold">68% {t.complete}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
              <div className="h-full bg-primary-container transition-all duration-500 shadow-[0_0_10px_rgba(0,164,220,0.5)]" style={{ width: '68%' }} />
            </div>
          </div>
       </section>

       <section className="ghost-border overflow-hidden rounded-xl bg-surface-container">
          <div className="flex items-center justify-between bg-surface-container-high px-6 py-4">
            <h4 className="text-lg font-bold">{t.recent_findings}</h4>
            <button className="flex items-center gap-2 rounded-lg border border-outline-variant/30 bg-surface-container px-3 py-1 text-sm text-on-surface-variant transition-colors hover:bg-surface-container-highest">
              <Filter size={16} />
              <span>{t.all_status}</span>
            </button>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="border-b border-outline-variant/30 bg-surface-container-high/50 text-xs font-bold uppercase text-on-surface-variant">
                <tr>
                  <th className="px-6 py-4">{t.media_file}</th>
                  <th className="px-6 py-4">{t.type}</th>
                  <th className="px-6 py-4">{t.resolution}</th>
                  <th className="px-6 py-4">{t.status}</th>
                  <th className="px-6 py-4 text-right">{t.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {[
                  { title: 'Dune: Part Two (2024)', file: 'dune.pt2.2160p.atmos.mkv', type: t.movie, res: '4K HDR', status: t.matched, img: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=200&auto=format&fit=crop' },
                  { title: 'The Bear - S03E01', file: 'the.bear.s03e01.1080p.mkv', type: t.tv_show, res: '1080P', status: t.processing, img: 'https://images.unsplash.com/photo-1541963463532-d68292c34b19?w=200&auto=format&fit=crop' },
                  { title: 'Deep Sea Explorers (2023)', file: 'deep_sea_explorers_remux.mkv', type: t.movie, res: '1080P', status: t.warning, img: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=200&auto=format&fit=crop' },
                  { title: 'The Creator (2023)', file: 'the.creator.2160p.mkv', type: t.movie, res: '4K HDR', status: t.matched, img: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=200&auto=format&fit=crop' },
                ].map((row, i) => (
                  <tr key={i} className="transition-colors hover:bg-surface-container-highest group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <img src={row.img} alt={row.title} className="h-10 w-8 rounded object-cover" referrerPolicy="no-referrer" />
                        <div>
                          <p className="font-semibold group-hover:text-primary transition-colors">{row.title}</p>
                          <p className="font-mono text-[10px] text-on-surface-variant">{row.file}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{row.type}</td>
                    <td className="px-6 py-4">
                      <span className={`rounded-md px-2 py-1 text-[10px] font-bold ${row.res === '4K HDR' ? 'bg-primary/10 text-primary' : 'bg-surface-container-high text-on-surface-variant'}`}>
                        {row.res}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`flex items-center gap-2 text-xs font-bold uppercase ${
                        row.status === t.matched ? 'text-green-400' : 
                        row.status === t.processing ? 'text-primary' : 'text-tertiary'
                      }`}>
                        {row.status === t.matched && <CheckCircle2 size={14} />}
                        {row.status === t.processing && <SyncIcon size={14} className="animate-spin" />}
                        {row.status === t.warning && <AlertTriangle size={14} />}
                        {row.status}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-on-surface-variant hover:text-on-surface transition-colors">
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between bg-surface-container-low px-6 py-4 text-sm text-on-surface-variant">
            <span>{t.showing_x_of_y.replace('{x}', '4').replace('{y}', '1,428')}</span>
            <div className="flex gap-2">
              <button className="ghost-border rounded p-1 hover:bg-surface-container-high transition-colors"><ChevronLeft size={16} /></button>
              <button className="ghost-border rounded p-1 hover:bg-surface-container-high transition-colors"><ChevronRight size={16} /></button>
            </div>
          </div>
       </section>
    </div>
  );
}

function VerificationView({ t }: { language: Language, t: any }) {
  return (
    <div className="grid grid-cols-12 gap-8 h-full">
      <section className="col-span-12 lg:col-span-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <VerificationIcon className="text-primary" size={20} />
            {t.pending_verification}
          </h2>
          <span className="rounded-full bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase text-primary">14 {t.files}</span>
        </div>
        
        <div className="flex flex-col gap-3 max-h-[calc(100vh-250px)] overflow-y-auto pr-2 custom-scrollbar">
          {[
            { id: 'TN-90210', name: 'NEON_NIGHTS_EP04.mp4', match: 68, status: t.untagged, dur: '24:15', active: true },
            { id: 'TN-90211', name: 'CYBER_CHASE_S01.mkv', match: 92, status: t.ai_flagged, dur: '42:00', active: false },
            { id: 'TN-90215', name: 'VOID_WALKER_TEASER.mp4', match: 41, status: t.sync_error, dur: '01:30', active: false },
            { id: 'TN-90218', name: 'DOCUMENTARY_RUSH_4.mkv', match: 74, status: t.manual_required, dur: '12:45', active: false },
          ].map((item) => (
            <div 
              key={item.id}
              className={`cursor-pointer rounded-xl p-4 transition-all duration-200 border-2 ${
                item.active 
                  ? 'border-primary bg-surface-container-high shadow-lg' 
                  : 'border-outline-variant/30 bg-surface-container hover:bg-surface-container-high opacity-70 hover:opacity-100'
              }`}
            >
              <div className="mb-2 flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold">{item.name}</p>
                  <p className="text-[10px] text-on-surface-variant">ID: {item.id}</p>
                </div>
                <div className="flex flex-col items-end">
                   <span className={`text-[10px] font-bold ${item.match > 80 ? 'text-primary' : item.match > 50 ? 'text-tertiary' : 'text-error'}`}>
                     {item.match}% {t.match}
                   </span>
                   <div className="mt-1 h-1 w-16 overflow-hidden rounded-full bg-surface-variant">
                     <div 
                      className={`h-full ${item.match > 80 ? 'bg-primary' : item.match > 50 ? 'bg-tertiary' : 'bg-error'}`} 
                      style={{ width: `${item.match}%` }} 
                     />
                   </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`rounded border px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                  item.status === t.untagged ? 'border-error/30 text-error bg-error/5' :
                  item.status === t.ai_flagged ? 'border-primary/30 text-primary bg-primary/5' :
                  'border-tertiary/30 text-tertiary bg-tertiary/5'
                }`}>
                  {item.status}
                </span>
                <span className="text-[9px] font-bold uppercase text-on-surface-variant opacity-60">• {item.dur} {t.dur}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="col-span-12 lg:col-span-8 flex flex-col gap-4">
        <div className="ghost-border flex items-center justify-between rounded-xl bg-surface-container-high p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-outline-variant/20 bg-surface-container-highest">
              <ScannerIcon className="text-primary" size={24} />
            </div>
            <div>
              <p className="text-sm font-bold">NEON_NIGHTS_EP04.srt</p>
              <p className="text-[10px] font-bold tracking-wider text-on-surface-variant uppercase">{t.format_encoding.replace('{format}', 'SubRip').replace('{encoding}', 'UTF-8')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest"><Download size={18} /></button>
            <button className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest"><MoreVertical size={18} /></button>
          </div>
        </div>

        <div className="ghost-border flex min-h-[500px] flex-1 flex-col overflow-hidden rounded-xl bg-surface-container-lowest">
          <div className="relative h-1 w-full bg-surface-container-highest">
            <div className="absolute left-0 top-0 h-full w-1/3 bg-primary shadow-[0_0_8px_rgba(123,208,255,0.5)]" />
            <div className="absolute left-1/3 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-primary bg-white shadow-lg" />
          </div>
          
          <div className="flex-1 space-y-6 overflow-y-auto p-6 font-mono text-[13px] custom-scrollbar">
            {[
              { time: '00:00:12,450', text: 'In the heart of the city, silence is a luxury no one can afford.', active: false },
              { time: '00:00:15,800', text: 'They say the rain washes away the sins of the neon lights.', active: true },
              { time: '00:00:19,120', text: 'But some stains are too deep for water. Too deep for time.', active: false },
              { time: '00:00:22,050', text: '[Ambient mechanical whirring increases]', active: false },
              { time: '00:00:25,900', text: 'I should have known you\'d come looking for me eventually.', active: false },
            ].map((line, i) => (
              <div key={i} className="group flex gap-6">
                <div className={`w-24 shrink-0 text-right font-bold transition-colors ${line.active ? 'text-primary' : 'text-on-surface-variant opacity-40'}`}>
                  {line.time}
                </div>
                <div className={`flex-1 rounded-lg border p-4 transition-all ${
                  line.active 
                    ? 'bg-surface-container-high border-primary/50 shadow-inner' 
                    : 'bg-surface-container/30 border-transparent group-hover:border-outline-variant/30 group-hover:bg-surface-container/50'
                }`}>
                  <p className={`${line.active ? 'text-on-surface text-base font-semibold' : 'text-on-surface-variant'}`}>{line.text}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-outline-variant/30 bg-surface-container-low p-6 sm:flex-row">
            <div className="flex flex-wrap gap-2">
              <button className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-primary active:scale-95">
                <CheckCircle size={16} /> {t.correct}
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-tertiary active:scale-95">
                <Timer size={16} /> {t.off_sync}
              </button>
              <button className="flex items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-highest px-4 py-2 text-sm font-bold text-on-surface transition-all hover:border-error active:scale-95">
                <Languages size={16} /> {t.wrong_lang}
              </button>
            </div>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-container px-8 py-3 font-bold text-white shadow-[0_4px_12px_rgba(0,164,220,0.4)] transition-all hover:brightness-110 active:scale-95 sm:w-auto">
              <CheckCircle2 size={18} /> {t.confirm_verification}
            </button>
          </div>
        </div>

        <div className="flex justify-center gap-8 py-2 text-[10px] font-bold uppercase text-on-surface-variant/40">
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-outline-variant/50 bg-surface-container-high px-1.5 py-0.5">SPACE</kbd>
            <span>{t.play_pause}</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-outline-variant/50 bg-surface-container-high px-1.5 py-0.5">V</kbd>
            <span>{t.mark_correct}</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-outline-variant/50 bg-surface-container-high px-1.5 py-0.5">ENTER</kbd>
            <span>{t.confirm}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function SearchView({ t }: { language: Language, t: any }) {
  return (
    <div className="mx-auto max-w-7xl space-y-12">
      <section className="flex flex-col items-center py-12 text-center">
        <div className="w-full max-w-3xl space-y-4">
          <h2 className="text-4xl font-bold">{t.find_perfect}</h2>
          <p className="text-lg text-on-surface-variant">{t.search_desc}</p>
          <div className="group relative mt-8">
            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-outline">
              <SearchIcon size={24} />
            </div>
            <input 
              type="text" 
              placeholder={t.search_placeholder} 
              className="h-16 w-full rounded-xl border border-outline-variant/50 bg-surface-container-high pl-12 pr-4 text-lg text-on-surface transition-all focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xl backdrop-blur-md"
            />
            <div className="absolute inset-y-2 right-2 flex items-center">
              <button className="h-12 rounded-lg bg-primary-container px-8 text-sm font-bold text-on-primary-container transition-all hover:brightness-110 active:scale-95">
                {t.search_btn}
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-12 gap-8">
        <aside className="col-span-12 lg:col-span-3 space-y-8">
          <div className="ghost-border rounded-xl bg-surface-container p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{t.recent_searches}</h3>
              <button className="text-xs font-bold text-primary hover:underline">{t.clear}</button>
            </div>
            <ul className="space-y-1">
               {['Oppenheimer (2023)', 'Succession S04', 'The Bear', 'Interstellar 4K'].map((item) => (
                 <li key={item} className="group flex cursor-pointer items-center gap-2 rounded-lg p-2 transition-colors hover:bg-surface-container-high">
                    <History size={16} className="text-outline group-hover:text-primary transition-colors" />
                    <span className="text-sm text-on-surface-variant group-hover:text-on-surface transition-colors">{item}</span>
                 </li>
               ))}
            </ul>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary-container/10 p-6 space-y-3">
            <Star className="text-primary fill-primary" size={24} />
            <h4 className="text-lg font-bold text-primary">{t.go_pro}</h4>
            <p className="text-sm text-on-surface-variant">{t.pro_desc}</p>
            <button className="mt-2 w-full rounded-lg bg-primary py-2 text-sm font-bold text-on-primary shadow-lg transition-all active:scale-95">
              {t.upgrade}
            </button>
          </div>
        </aside>

        <div className="col-span-12 lg:col-span-9 space-y-6">
           <div className="flex items-center justify-between">
             <h3 className="text-2xl font-bold">{t.top_results} <span className="ml-2 text-sm font-normal text-on-surface-variant opacity-50">{t.x_matches.replace('{x}', '124')}</span></h3>
             <div className="flex gap-3">
                <button className="flex items-center gap-1 rounded-full border border-outline-variant/30 bg-surface-container px-4 py-1.5 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-highest">
                  <Filter size={14} /> {t.filter}
                </button>
                <button className="flex items-center gap-1 rounded-full border border-outline-variant/30 bg-surface-container px-4 py-1.5 text-xs font-bold text-on-surface-variant transition-colors hover:bg-surface-container-highest">
                  <SortAsc size={14} /> {t.newest}
                </button>
             </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {[
                { title: 'Neon Horizon', year: '2024', genre: 'Sci-Fi / Drama', type: t.movie, langs: ['English', 'Spanish', 'French'], img: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?w=400&auto=format&fit=crop' },
                { title: 'Shadow Protocol', year: '2023', genre: 'Season 2', type: t.tv_show, langs: ['English', 'German', 'Italian'], img: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=400&auto=format&fit=crop' },
                { title: 'The Last Glacier', year: '2022', genre: 'Nature', type: 'Doc', langs: ['English', 'Japanese'], img: 'https://images.unsplash.com/photo-1547234935-80c7145ec969?w=400&auto=format&fit=crop' },
              ].map((card, i) => (
                <div key={i} className="group ghost-border flex flex-col overflow-hidden rounded-xl bg-surface-container-low transition-all hover:border-primary/50 shadow-md">
                   <div className="relative aspect-[2/3] overflow-hidden">
                      <img 
                        src={card.img} 
                        alt={card.title} 
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" 
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute left-3 top-3">
                        <span className="rounded border border-white/10 bg-black/60 px-2 py-1 text-[10px] font-bold uppercase text-white backdrop-blur-md">
                          {card.type}
                        </span>
                      </div>
                   </div>
                   <div className="flex flex-grow flex-col justify-between p-4">
                      <div className="space-y-1">
                        <h4 className="truncate text-lg font-bold group-hover:text-primary transition-colors">{card.title}</h4>
                        <p className="text-xs text-on-surface-variant">{card.year} • {card.genre}</p>
                        <div className="mt-3 flex flex-wrap gap-1">
                          {card.langs.map(lang => (
                             <span key={lang} className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
                               {lang}
                             </span>
                          ))}
                        </div>
                      </div>
                      <button className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-surface-variant py-2 text-xs font-bold transition-all hover:bg-primary-container hover:text-on-primary-container">
                        <Download size={14} /> {t.download}
                      </button>
                   </div>
                </div>
              ))}
           </div>

           <div className="flex justify-center pt-8">
             <button className="rounded-lg border border-outline-variant/50 bg-surface-container px-8 py-3 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-high">
               {t.load_more}
             </button>
           </div>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-6 border-t border-outline-variant/30 pt-12 md:grid-cols-3">
        {[
          { icon: Languages, title: t.lang_52, desc: t.lang_desc },
          { icon: Wifi, title: t.instant_sync, desc: t.sync_feature_desc },
          { icon: CheckCircle, title: t.verified_only, desc: t.verified_desc },
        ].map((feat, i) => (
          <div key={i} className="ghost-border flex flex-col gap-2 rounded-xl bg-surface-container p-6">
            <feat.icon className="text-primary" size={24} />
            <h5 className="text-lg font-bold">{feat.title}</h5>
            <p className="text-sm text-on-surface-variant leading-relaxed">{feat.desc}</p>
          </div>
        ))}
      </section>
    </div>
  );
}

function SettingsView({ t }: { language: Language, t: any }) {
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="mb-8">
        <h2 className="text-3xl font-bold">{t.system_settings}</h2>
        <p className="mt-1 text-on-surface-variant">{t.settings_desc}</p>
      </header>

      <div className="space-y-8">
        {/* General Section */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <SettingsIcon className="text-primary" size={20} />
            <h3 className="text-lg font-bold">{t.general}</h3>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t.save_path}</label>
              <input 
                type="text" 
                defaultValue="/mnt/media/subtitles" 
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t.lang_priority}</label>
              <div className="relative">
                <select className="w-full appearance-none rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm focus:border-primary focus:outline-none pr-10">
                  <option>English, Spanish, French</option>
                  <option>English Only</option>
                  <option>All Languages</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <ChevronDown size={16} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Jellyfin Integration */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center justify-between border-b border-outline-variant/20 pb-2">
            <div className="flex items-center gap-2">
              <SyncIcon className="text-tertiary" size={20} />
              <h3 className="text-lg font-bold">{t.jellyfin_integration}</h3>
            </div>
            <span className="rounded-full bg-tertiary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-tertiary">{t.connected}</span>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t.server_url}</label>
              <input 
                type="text" 
                placeholder="https://jellyfin.local:8096" 
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">{t.api_key}</label>
              <input 
                type="password" 
                defaultValue="••••••••••••••••••••••••" 
                className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-3 text-sm focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        </section>

        {/* Subtitle Sources */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <ExternalLink className="text-secondary" size={20} />
            <h3 className="text-lg font-bold">{t.subtitle_sources}</h3>
          </div>
          <div className="space-y-4">
            <div className="ghost-border flex items-center justify-between rounded-lg bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-white/10">
                  <div className="h-6 w-6 rounded-sm bg-primary/40" />
                </div>
                <div>
                  <p className="text-sm font-bold">OpenSubtitles.com</p>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Active • VIP Account</p>
                </div>
              </div>
              <button className="rounded-lg border border-outline-variant px-4 py-2 text-xs font-bold transition-colors hover:bg-surface-container-high">{t.configure}</button>
            </div>
            <div className="ghost-border flex items-center justify-between rounded-lg bg-surface-container-low p-4 transition-colors hover:bg-surface-container">
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded bg-white/10">
                  <div className="h-6 w-6 rounded-sm bg-secondary/40" />
                </div>
                <div>
                  <p className="text-sm font-bold">Addic7ed</p>
                  <p className="text-[10px] font-bold uppercase text-on-surface-variant">Login Required</p>
                </div>
              </div>
              <button className="rounded-lg bg-primary-container px-4 py-2 text-xs font-bold text-white transition-all hover:brightness-110">{t.connect}</button>
            </div>
          </div>
        </section>

        {/* Automation */}
        <section className="ghost-border rounded-xl bg-surface-container p-6">
          <div className="mb-6 flex items-center gap-2 border-b border-outline-variant/20 pb-2">
            <ScannerIcon className="text-primary" size={20} />
            <h3 className="text-lg font-bold">{t.automation}</h3>
          </div>
          <div className="grid grid-cols-1 gap-x-12 gap-y-8 md:grid-cols-2">
            {[
              { id: 'scan', label: t.auto_scan, desc: t.auto_scan_desc, active: true },
              { id: 'download', label: t.auto_download, desc: t.auto_download_desc, active: false },
              { id: 'cleanup', label: t.cleanup_orphans, desc: t.cleanup_desc, active: true },
              { id: 'notify', label: t.notify_success, desc: t.notify_desc, active: true },
            ].map((item) => (
              <div key={item.id} className="flex items-center justify-between group">
                <div className="pr-4">
                  <p className="text-sm font-bold group-hover:text-primary transition-colors">{item.label}</p>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">{item.desc}</p>
                </div>
                <div className={`relative h-6 w-12 cursor-pointer flex-shrink-0 transition-all duration-300 rounded-full ${item.active ? 'bg-primary-container' : 'bg-surface-variant'}`}>
                  <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-all duration-300 ${item.active ? 'right-1' : 'left-1'}`} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-4 pt-4">
          <button className="rounded-lg border border-outline px-8 py-3 text-sm font-bold transition-all hover:bg-surface-container-high active:scale-95">{t.reset_defaults}</button>
          <button className="rounded-lg bg-primary-container px-8 py-3 text-sm font-bold text-white transition-all shadow-[0_0_20px_rgba(0,164,220,0.3)] hover:brightness-110 active:scale-95">{t.save_changes}</button>
        </div>
      </div>
    </div>
  );
}

