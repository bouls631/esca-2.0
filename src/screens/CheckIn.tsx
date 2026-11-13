import { useState } from 'react';
import { format } from 'date-fns';
import { db, ENERGY_LABELS, FEEL_LABELS, INTENT_LABELS, LOCATION_LABELS, PAIN_LABELS, PRATIQUE_LABELS, SESSION_LABELS, type Checkin, type Energy, type Pratique, type SessionType } from '../db';
import type { AppData } from '../App';
import { Btn, Card, Chip } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { rotationFor } from '../lib/cycles';
import { evaluateSurmenage, lastMardiIntense } from '../lib/surmenage';
import { readinessAssessment, ready7a } from '../lib/readiness';
import { generateSeance, maisonSeriesFor } from '../lib/generator';
import type { Intent, Location, Pain } from '../lib/types';

const PAINS: Pain[] = ['doigts', 'avant_bras', 'epaules', 'dos', 'aucune'];
const ENERGY: Energy[] = [1, 2, 3, 4];
const FEELS = ['facile', 'moyen', 'dur', 'echec'] as const;
const INTENTS: Intent[] = ['standard', 'alleger', 'renforcer', 'reporter'];

/** Check-in 30 secondes avant séance → détecteur de surmenage + plan adaptatif. */
export function CheckInSheet({ open, onClose, data, now, onDone }: {
  open: boolean;
  onClose: () => void;
  data: AppData;
  now: Date;
  onDone: () => void;
}) {
  const day = now.getDay();
  const scheduledType: SessionType | null = day === 2 ? 'intensite' : day === 4 ? 'volume' : null;
  const [location, setLocation] = useState<Location>('club');
  const [pratique, setPratique] = useState<Pratique>('voie');
  const [energy, setEnergy] = useState<Energy>(3);
  const [pains, setPains] = useState<Pain[]>(['aucune']);
  const [feel, setFeel] = useState<(typeof FEELS)[number]>('moyen');
  const [intent, setIntent] = useState<Intent>('standard');
  const [pick, setPick] = useState<SessionType>('volume'); // si jour hors calendrier
  const [override, setOverride] = useState(false);

  const verdict = evaluateSurmenage(data, now);
  const rotation = rotationFor(now);
  const type: SessionType = scheduledType ?? pick;
  const offPlan = location !== 'repos_force' && !override;
  const hardBlocked = verdict.state === 'bloque' && offPlan;
  const reposActif = verdict.state === 'repos_actif' && offPlan;

  function togglePain(p: Pain) {
    if (p === 'aucune') { setPains(['aucune']); return; }
    const pain = pains.filter((x) => x !== 'aucune');
    if (pain.includes(p)) {
      const rest = pain.filter((x) => x !== p);
      setPains(rest.length ? rest : ['aucune']);
      return;
    }
    setPains([...pain, p]);
  }

  async function save(forceLocation?: Location) {
    const loc = forceLocation ?? location;
    const key = format(now, 'yyyy-MM-dd');
    const focus = type === 'intensite' ? rotation.mardi : rotation.jeudi;
    const focusAutre = type === 'intensite' ? rotation.jeudi : rotation.mardi;
    const ra = readinessAssessment(data.readiness);
    const gate = ready7a({ seances: data.seances, voies: data.voies, readiness: data.readiness }, now, verdict).ready;
    // "J'assume le risque" est noté : l'app garde la trace de la décision.
    const overridden = verdict.state === 'bloque' && loc !== 'repos_force' && (override || forceLocation === undefined);
    const gen = generateSeance({
      type, location: loc, energy, intent,
      readinessDrop: ra.drop,
      mardiIntense: type === 'volume' && lastMardiIntense(data, now),
      focus, focusAutre, liberation: rotation.liberation, gate7a: gate,
      maisonSeries: maisonSeriesFor(data.seances, data.checkins),
      objectif: data.profile.objectif ?? '6c',
      pratique,
      objectifBloc: data.profile.objectifBloc ?? 'rouge',
    });
    const ck: Checkin = {
      date: key,
      type: gen.type,
      location: loc,
      energy,
      pains,
      feel,
      intent: loc === 'repos_force' ? 'alleger' : intent,
      override: overridden,
      pratique,
      createdAt: now.getTime(),
    };
    await db.transaction('rw', db.checkins, db.seances, async () => {
      const existingCk = await db.checkins.where('date').equals(key).first();
      const ckId = await db.checkins.put({ ...ck, id: existingCk?.id });
      const existingS = await db.seances.where('date').equals(key).first();
      await db.seances.put({
        date: key, type: gen.type, note: gen.note, blocs: gen.blocs, checkinId: ckId,
        createdAt: existingS?.createdAt ?? now.getTime(), id: existingS?.id,
      });
    });
    onDone();
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Check-in — ${SESSION_LABELS[type]}`}>
      {verdict.state === 'bloque' && offPlan && (
        <Card className="mb-3 border-red-600 bg-red-950/30">
          {verdict.alerts.map((a) => (
            <p key={a.id} className="mb-1 font-mono text-xs text-red-200 last:mb-0">🛑 {a.title} — {a.message}</p>
          ))}
          {!override && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Btn variant="ghost" onClick={() => void save('repos_force')}>Repos forcé</Btn>
              <Btn variant="danger" onClick={() => setOverride(true)}>J'assume le risque</Btn>
            </div>
          )}
        </Card>
      )}
      {reposActif && (
        <Card className="mb-3 border-amber-600 bg-amber-950/20">
          {verdict.alerts.map((a) => (
            <p key={a.id} className="mb-1 font-mono text-xs text-amber-200 last:mb-0">⚠ {a.title} — {a.message}</p>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Btn variant="warn" onClick={() => void save('repos_force')}>Mobilité 20 min</Btn>
            <Btn variant="ghost" onClick={() => setOverride(true)}>J'assume le risque</Btn>
          </div>
        </Card>
      )}

      {!scheduledType && (
        <Card className="mb-3 border-amber-700 bg-amber-950/10">
          <p className="font-mono text-xs text-amber-300">Jour hors calendrier (le plan officiel = mardi intensité / jeudi volume). Type forcé :</p>
          <div className="mt-2 flex gap-2">
            <Chip selected={pick === 'intensite'} onClick={() => setPick('intensite')}>Intensité</Chip>
            <Chip selected={pick === 'volume'} onClick={() => setPick('volume')}>Volume</Chip>
          </div>
        </Card>
      )}

      <div className="space-y-4">
        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Localisation</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(LOCATION_LABELS) as [Location, string][]).map(([k, lbl]) => (
              <Chip key={k} selected={location === k} onClick={() => setLocation(k)}>{lbl}</Chip>
            ))}
          </div>
        </div>

        {location === 'club' && (
          <div>
            <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Pratique</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(PRATIQUE_LABELS) as [Pratique, string][]).map(([k, lbl]) => (
                <Chip key={k} selected={pratique === k} onClick={() => setPratique(k)}>{lbl}</Chip>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Énergie</p>
          <div className="grid grid-cols-4 gap-2">
            {ENERGY.map((e) => (
              <Chip key={e} selected={energy === e} onClick={() => setEnergy(e)} className="min-h-12">{ENERGY_LABELS[e]}</Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Douleurs</p>
          <div className="flex flex-wrap gap-2">
            {PAINS.map((p) => (
              <Chip key={p} selected={pains.includes(p)} onClick={() => togglePain(p)}>{PAIN_LABELS[p]}</Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Ressenti dernière séance</p>
          <div className="grid grid-cols-4 gap-2">
            {FEELS.map((f) => (
              <Chip key={f} selected={feel === f} onClick={() => setFeel(f)} className="min-h-12">{FEEL_LABELS[f]}</Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Objectif ajustement</p>
          <div className="grid grid-cols-4 gap-2">
            {INTENTS.map((i) => (
              <Chip key={i} selected={intent === i} onClick={() => setIntent(i)} className="min-h-12">{INTENT_LABELS[i]}</Chip>
            ))}
          </div>
        </div>

        {(hardBlocked || reposActif) && (
          <p className="text-center font-mono text-[11px] text-zinc-500">Choisis ci-dessus : repos forcé / mobilité, ou J'assume le risque.</p>
        )}
        <Btn size="lg" disabled={hardBlocked || reposActif} onClick={() => void save()}>
          {location === 'repos_force' ? 'Enregistrer le repos' : 'Générer ma séance'}
        </Btn>
      </div>
    </Sheet>
  );
}
