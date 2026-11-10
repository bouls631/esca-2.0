import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import type { AppData } from '../App';
import { Btn, Card, Chip, Tag } from '../components/ui';
import { cotationToNiveau, filterRoutes, RAPPEL_ROUTES, relaisToProfil, uniqueGrades, type OblykRoute } from '../lib/routes';
import { JournalVoie } from './JournalVoie';

const GRADES = uniqueGrades(RAPPEL_ROUTES);
const SECTEURS = Array.from(new Set(RAPPEL_ROUTES.map((r) => r.secteur).filter((s): s is string => Boolean(s))));

export default function Salle({ data, now }: { data: AppData; now: Date }) {
  const defaultMin = GRADES.find((g) => g.cotation === '6a')?.val ?? GRADES[0].val;
  const defaultMax = GRADES.find((g) => g.cotation === '6c+')?.val ?? GRADES[GRADES.length - 1].val;

  const [minVal, setMinVal] = useState<number>(defaultMin);
  const [maxVal, setMaxVal] = useState<number>(defaultMax);
  const [secteur, setSecteur] = useState<string>('');
  const [spinning, setSpinning] = useState(false);
  const [reel, setReel] = useState<{ relais: string; cotation: string; secteur: string }>({
    relais: '—',
    cotation: '—',
    secteur: '—',
  });
  const [picked, setPicked] = useState<OblykRoute | null>(null);
  const [logRoute, setLogRoute] = useState<OblykRoute | null>(null);

  const todayKey = format(now, 'yyyy-MM-dd');
  const todaySeance = data.seances.filter((s) => s.date === todayKey).sort((a, b) => b.createdAt - a.createdAt)[0];

  const pool = useMemo(() => filterRoutes(minVal, maxVal, secteur || undefined), [minVal, maxVal, secteur]);

  // Historique par oblykId ou par relais+cotation
  const statsByRoute = useMemo(() => {
    const map = new Map<number, { tops: number; fails: number }>();
    for (const r of RAPPEL_ROUTES) {
      const matching = data.voies.filter(
        (v) => v.oblykId === r.id || (v.relais !== undefined && v.relais === r.relais && v.niveau === cotationToNiveau(r.cotation)),
      );
      if (matching.length > 0) {
        map.set(r.id, {
          tops: matching.filter((v) => v.chute === 'top').length,
          fails: matching.filter((v) => v.chute !== 'top').length,
        });
      }
    }
    return map;
  }, [data.voies]);

  function spin() {
    if (spinning || pool.length === 0) return;
    setSpinning(true);
    setPicked(null);
    const rand = () => pool[Math.floor(Math.random() * pool.length)];
    const timer = setInterval(() => {
      const tmp = rand();
      setReel({
        relais: String(tmp.relais ?? '?'),
        cotation: tmp.cotation ?? '?',
        secteur: (tmp.secteur ?? '?').split(' ')[0],
      });
    }, 85);

    setTimeout(() => {
      clearInterval(timer);
      const win = rand();
      setReel({
        relais: String(win.relais ?? '—'),
        cotation: win.cotation ?? '—',
        secteur: win.secteur ?? '—',
      });
      setPicked(win);
      setSpinning(false);
    }, 1000);
  }

  return (
    <div className="space-y-3">
      <Card className="border-emerald-700/60">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-100">Roue des voies · RAPPEL Riom</p>
            <p className="font-mono text-xs text-zinc-400">{RAPPEL_ROUTES.length} voies montées (36 relais · Oblyk)</p>
          </div>
          <Tag tone="emerald">{pool.length} voies</Tag>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <label className="font-mono text-xs text-zinc-400">
            Cotation min
            <select
              value={minVal}
              onChange={(e) => setMinVal(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm font-bold text-zinc-100"
            >
              {GRADES.map((g) => (
                <option key={g.val} value={g.val}>{g.cotation}</option>
              ))}
            </select>
          </label>
          <label className="font-mono text-xs text-zinc-400">
            Cotation max
            <select
              value={maxVal}
              onChange={(e) => setMaxVal(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm font-bold text-zinc-100"
            >
              {GRADES.map((g) => (
                <option key={g.val} value={g.val}>{g.cotation}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          <Chip selected={secteur === ''} onClick={() => setSecteur('')} className="px-2.5 py-1 text-xs">Tous secteurs</Chip>
          {SECTEURS.map((s) => (
            <Chip key={s} selected={secteur === s} onClick={() => setSecteur(s)} className="px-2.5 py-1 text-xs">{s}</Chip>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-zinc-800 bg-zinc-950 p-3 text-center">
          <div>
            <p className="font-mono text-[10px] uppercase text-zinc-500">Relais</p>
            <p className="font-mono text-2xl font-black text-amber-400">{reel.relais}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase text-zinc-500">Cotation</p>
            <p className="font-mono text-2xl font-black text-emerald-400">{reel.cotation}</p>
          </div>
          <div>
            <p className="font-mono text-[10px] uppercase text-zinc-500">Secteur</p>
            <p className="truncate font-mono text-sm font-bold text-zinc-200 mt-1.5">{reel.secteur}</p>
          </div>
        </div>

        <Btn size="lg" className="mt-3" disabled={spinning || pool.length === 0} onClick={spin}>
          {spinning ? 'Tirage…' : picked ? 'Rejouer la roue' : 'Lancer la roue'}
        </Btn>

        {picked && (
          <div className="mt-3 rounded-xl border border-emerald-500/50 bg-emerald-950/20 p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-4 w-4 rounded-full border border-white/40"
                  style={{ background: picked.couleur ?? '#999' }}
                />
                <span className="font-mono text-sm font-black text-zinc-100">Relais {picked.relais ?? '—'}</span>
                <Tag tone="emerald">{picked.cotation}</Tag>
              </div>
              <a
                href={picked.lien}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-sky-400 underline"
              >
                Oblyk ↗
              </a>
            </div>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {picked.secteur} · {picked.hauteur ?? 13} m · ouverte le {picked.ouverte_le ?? '?'}
            </p>
            <Btn className="mt-2 w-full" onClick={() => setLogRoute(picked)}>
              Noter cette voie dans le journal
            </Btn>
          </div>
        )}
      </Card>

      <Card>
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
          Catalogue filtré ({pool.length} voies)
        </p>
        <div className="mt-2 max-h-96 space-y-1.5 overflow-y-auto pr-1">
          {pool.length === 0 && (
            <p className="font-mono text-xs text-zinc-500">Aucune voie dans cette plage — élargis min/max.</p>
          )}
          {pool.map((r) => {
            const st = statsByRoute.get(r.id);
            return (
              <div
                key={r.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-zinc-800 bg-zinc-950/70 px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="inline-block h-3.5 w-3.5 shrink-0 rounded-full border border-white/30"
                    style={{ background: r.couleur ?? '#999' }}
                  />
                  <span className="font-mono text-xs font-black text-emerald-400 w-8">{r.cotation}</span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs font-bold text-zinc-200">
                      Relais {r.relais ?? '—'} · <span className="font-normal text-zinc-400">{r.secteur}</span>
                    </p>
                    {st && (
                      <p className="font-mono text-[10px] text-zinc-400">
                        {st.tops > 0 && <span className="text-emerald-400">✓ {st.tops} top(s) </span>}
                        {st.fails > 0 && <span className="text-amber-400">· {st.fails} essai(s)</span>}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <a
                    href={r.lien}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-zinc-800 px-2 py-1 font-mono text-[10px] text-zinc-400 hover:text-zinc-200"
                  >
                    Oblyk
                  </a>
                  <Chip className="px-2.5 py-1 text-xs" onClick={() => setLogRoute(r)}>
                    Noter
                  </Chip>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <JournalVoie
        open={logRoute !== null}
        onClose={() => setLogRoute(null)}
        seanceId={todaySeance?.id}
        defaultNiveau={logRoute ? cotationToNiveau(logRoute.cotation) : undefined}
        defaultProfil={logRoute ? relaisToProfil(logRoute.relais) : undefined}
        defaultRelais={logRoute?.relais ?? undefined}
        defaultSecteur={logRoute?.secteur ?? undefined}
        defaultCouleur={logRoute?.couleur ?? undefined}
        defaultOblykId={logRoute?.id}
      />
    </div>
  );
}
