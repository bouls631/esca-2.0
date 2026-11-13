import { db, COULEURS_BLOC, OBJECTIFS, type CouleurBloc, type Objectif } from '../db';
import type { AppData } from '../App';
import { Card, Chip } from '../components/ui';
import { grade } from '../lib/generator';

export default function Reglages({ data }: { data: AppData }) {
  const objectif: Objectif = data.profile.objectif ?? '6c';
  const objectifBloc: CouleurBloc = data.profile.objectifBloc ?? 'rouge';

  async function setObjectif(o: Objectif) {
    await db.profile.put({ ...data.profile, id: 'me', objectif: o });
  }

  async function setObjectifBloc(c: CouleurBloc) {
    await db.profile.put({ ...data.profile, id: 'me', objectifBloc: c });
  }

  return (
    <div className="space-y-3">
      <Card>
        <p className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-200">Objectif voie</p>
        <p className="mt-1 font-mono text-xs text-zinc-400">Ton projet : il pilote les cotations de la séance intensité (mardi).</p>
        <div className="mt-3 grid grid-cols-4 gap-2">
          {OBJECTIFS.map((o) => (
            <Chip key={o} selected={objectif === o} onClick={() => void setObjectif(o)} className="justify-center">{o}</Chip>
          ))}
        </div>
        <p className="mt-2 font-mono text-[11px] text-zinc-500">
          Échauffement {grade(objectif, -3)} → projet {objectif} (2 essais ×2) → technique {grade(objectif, -1)}.
        </p>
      </Card>

      <Card>
        <p className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-200">Objectif bloc</p>
        <p className="mt-1 font-mono text-xs text-zinc-400">Le bloc visé pilote la séance bloc.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {COULEURS_BLOC.map((c) => (
            <Chip key={c} selected={objectifBloc === c} onClick={() => void setObjectifBloc(c)}>{c}</Chip>
          ))}
        </div>
      </Card>
    </div>
  );
}
