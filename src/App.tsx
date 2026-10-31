import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Checkin, type Profile, type ReadinessTest, type Seance, type Voie } from './db';
import { cx } from './components/ui';
import Aujourdhui from './screens/Aujourdhui';
import SeanceScreen from './screens/Seance';
import Stats from './screens/Stats';

export interface AppData {
  checkins: Checkin[];
  seances: Seance[];
  voies: Voie[];
  readiness: ReadinessTest[];
  profile: Profile;
}

export type Tab = 'today' | 'seance' | 'stats';

const TABS: { id: Tab; label: string }[] = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'seance', label: 'Séance' },
  { id: 'stats', label: 'Stats' },
];

export default function App() {
  const [tab, setTab] = useState<Tab>('today');
  const now = new Date();

  const data = useLiveQuery<AppData, null>(() =>
    (async () => {
      const [checkins, seances, voies, readiness, profile] = await Promise.all([
        db.checkins.toArray(),
        db.seances.toArray(),
        db.voies.toArray(),
        db.readiness.toArray(),
        db.profile.get('me'),
      ]);
      return { checkins, seances, voies, readiness, profile: profile ?? { id: 'me' } };
    })(), [], null);

  if (data === null) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-950 font-mono text-zinc-500">
        Chargement…
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col bg-zinc-950 text-zinc-100">
      <header className="safe-top sticky top-0 z-20 border-b border-zinc-800 bg-zinc-950/90 px-4 py-3 backdrop-blur">
        <h1 className="font-mono text-lg font-black uppercase tracking-widest text-emerald-400">Coach Voie <span className="text-zinc-500">→ 7a</span></h1>
        <p className="font-mono text-xs text-zinc-500">{format(now, "EEEE d MMMM", { locale: fr })}</p>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 space-y-3 px-3 pt-3" style={{ minHeight: 'calc(100vh - 120px)' }}>
        {tab === 'today' && <Aujourdhui data={data} now={now} go={setTab} />}
        {tab === 'seance' && <SeanceScreen data={data} now={now} />}
        {tab === 'stats' && <Stats data={data} now={now} />}
      </main>
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-20 mx-auto flex max-w-md gap-2 border-t border-zinc-800 bg-zinc-950/95 px-3 py-2 backdrop-blur">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cx(
              'min-h-12 flex-1 rounded-xl font-mono text-sm font-bold uppercase tracking-wide',
              tab === t.id ? 'bg-emerald-500/15 text-emerald-300' : 'text-zinc-500 hover:text-zinc-300',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
