import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { db, PAIN_LABELS, type Pain, type Profile, type ReadinessTest } from '../db';
import { Btn, Card, Chip, Tag } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { readinessAssessment } from '../lib/readiness';

const HOLDS = ['réglette 1 doigt', 'réglette 2 doigts', 'arête', 'barre'];
const PAINS: Pain[] = ['doigts', 'avant_bras', 'epaules', 'dos'];

/** Test de readiness hebdo (dimanche soir, 5 min) : deadhang poutre + tractions + ressenti. */
export function ReadinessSheet({ open, onClose, profile, existing }: { open: boolean; onClose: () => void; profile: Profile; existing: ReadinessTest[] }) {
  const [hold, setHold] = useState(profile.holdLabel ?? 'réglette 2 doigts');
  const [deadhangS, setDeadhangS] = useState(60);
  const [tractions, setTractions] = useState(10);
  const [ressenti, setRessenti] = useState(7);
  const [pains, setPains] = useState<Pain[]>([]);

  const saved = [...existing].sort((a, b) => b.createdAt - a.createdAt);
  const ra = readinessAssessment(existing);

  async function save() {
    const now = new Date();
    const test: ReadinessTest = {
      date: format(now, 'yyyy-MM-dd'),
      holdLabel: hold,
      deadhangS,
      tractions,
      ressenti,
      pains,
      createdAt: now.getTime(),
    };
    await db.transaction('rw', db.readiness, db.profile, async () => {
      await db.readiness.add(test);
      if (profile.holdLabel !== hold) await db.profile.put({ ...profile, holdLabel: hold });
    });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Readiness du dimanche">
      <p className="font-mono text-xs text-zinc-400">5 minutes. Ce test calibre la semaine : baisse ≥20% → intensité −20% (moins d'essais projet, plus de volume facile).</p>

      {saved.length > 0 && (
        <Card className="mt-3 border-zinc-700">
          <p className="font-mono text-xs text-zinc-300">
            Dernier test : {format(saved[0].createdAt, 'd MMM', { locale: fr })} — {saved[0].deadhangS}s ({saved[0].holdLabel}), {saved[0].tractions} tractions, ressenti {saved[0].ressenti}/10.
          </p>
          {ra.enoughTests && (
            <p className={`mt-1 font-mono text-xs font-bold ${ra.drop ? 'text-amber-300' : 'text-emerald-300'}`}>
              {ra.drop
                ? `−${Math.round((1 - ra.pct) * 100)}% vs moyenne 4 semaines → la prochaine semaine est allégée automatiquement.`
                : `Stable (${Math.round(ra.pct * 100)}%) → intensité nominale.`}
            </p>
          )}
        </Card>
      )}

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Prise de référence</p>
          <div className="flex flex-wrap gap-2">
            {HOLDS.map((h) => <Chip key={h} selected={hold === h} onClick={() => setHold(h)}>{h}</Chip>)}
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Deadhang sec — secondes</p>
          <div className="flex items-center gap-3">
            <Chip onClick={() => setDeadhangS((s) => Math.max(5, s - 5))}>−5s</Chip>
            <p className="flex-1 text-center font-mono text-3xl font-black tabular-nums text-emerald-400">{deadhangS}s</p>
            <Chip onClick={() => setDeadhangS((s) => s + 5)}>+5s</Chip>
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Tractions (anneaux, jusqu'à l'échec)</p>
          <div className="flex items-center gap-3">
            <Chip onClick={() => setTractions((t) => Math.max(1, t - 1))}>−1</Chip>
            <p className="flex-1 text-center font-mono text-3xl font-black tabular-nums text-emerald-400">{tractions}</p>
            <Chip onClick={() => setTractions((t) => t + 1)}>+1</Chip>
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Ressenti global</p>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <Chip key={n} selected={ressenti === n} onClick={() => setRessenti(n)} className="px-2.5">{n}</Chip>
            ))}
          </div>
          <p className="mt-1 font-mono text-[10px] text-zinc-500">1 = dans le caniveau · 10 = machine</p>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Douleurs maintenant (vide = aucune)</p>
          <div className="flex flex-wrap gap-2">
            {PAINS.map((p) => (
              <Chip key={p} selected={pains.includes(p)} onClick={() => setPains(pains.includes(p) ? pains.filter((x) => x !== p) : [...pains, p])}>{PAIN_LABELS[p]}</Chip>
            ))}
          </div>
        </div>

        <Btn size="lg" onClick={() => void save()}>Enregistrer le test</Btn>
        <p className="text-center font-mono text-[10px] text-zinc-600">
          <Tag tone={ra.drop ? 'amber' : 'emerald'}>{ra.drop ? 'baisse' : 'stable'}</Tag> — suivi automatique dans Stats.
        </p>
      </div>
    </Sheet>
  );
}
