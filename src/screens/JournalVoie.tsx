import { useEffect, useState } from 'react';
import { db, CHUTE_LABELS, CAUSE_LABELS, NIVEAU_LABELS, PROFIL_LABELS, NIVEAUX_ORDER, type Niveau, type Profil, type Chute, type Cause } from '../db';
import { Btn, Chip } from '../components/ui';
import { Sheet } from '../components/Sheet';

const CHUTES: Chute[] = ['depart', 'milieu', 'fin', 'top'];
const CAUSES: Cause[] = ['force', 'souffle', 'technique', 'mental', 'doigts'];
const PROFILS: Profil[] = ['dalle', 'devers', 'toit', 'diedre'];

/** Journal de voie post-essai : niveau, point de chute, cause, et relais Oblyk optionnel. */
export function JournalVoie({ open, onClose, seanceId, blocId, defaultNiveau, defaultProfil, defaultRelais, defaultSecteur, defaultCouleur, defaultOblykId, onSaved }: {
  open: boolean;
  onClose: () => void;
  seanceId?: number;
  blocId?: string;
  defaultNiveau?: Niveau;
  defaultProfil?: Profil;
  defaultRelais?: number;
  defaultSecteur?: string;
  defaultCouleur?: string;
  defaultOblykId?: number;
  onSaved?: () => void;
}) {
  const [niveau, setNiveau] = useState<Niveau>(defaultNiveau ?? '6b');
  const [profil, setProfil] = useState<Profil>(defaultProfil ?? 'dalle');
  const [chute, setChute] = useState<Chute>('fin');
  const [cause, setCause] = useState<Cause>('souffle');
  const [relais, setRelais] = useState<string>(defaultRelais ? String(defaultRelais) : '');
  const [note, setNote] = useState<string>('');
  const isTop = chute === 'top';

  useEffect(() => {
    if (!open) return;
    if (defaultNiveau) setNiveau(defaultNiveau);
    if (defaultProfil) setProfil(defaultProfil);
    setRelais(defaultRelais ? String(defaultRelais) : '');
    setNote('');
  }, [open, defaultNiveau, defaultProfil, defaultRelais]);

  async function save() {
    // n° d'essai = nb de voies déjà loggées sur ce niveau aujourd'hui (même séance) + 1
    const prev = seanceId !== undefined ? await db.voies.where('seanceId').equals(seanceId).count() : 0;
    const relNum = parseInt(relais, 10);
    await db.voies.add({
      seanceId,
      date: Date.now(),
      createdAt: Date.now(),
      niveau,
      profil,
      chute,
      cause: isTop ? undefined : cause,
      essai: prev + 1,
      relais: Number.isFinite(relNum) ? relNum : defaultRelais,
      secteur: defaultSecteur,
      couleur: defaultCouleur,
      oblykId: defaultOblykId,
      note: note.trim() || undefined,
    });
    if (blocId && seanceId !== undefined) {
      const s = await db.seances.get(seanceId);
      if (s) await db.seances.update(seanceId, { blocs: s.blocs.map((b) => (b.id === blocId ? { ...b, done: true } : b)) });
    }
    setNote('');
    onSaved?.();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Journal de voie">
      <div className="space-y-4">
        {(defaultRelais || defaultSecteur) && (
          <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300">
            {defaultCouleur && <span className="inline-block h-3.5 w-3.5 rounded-full border border-white/30" style={{ background: defaultCouleur }} />}
            <span className="font-bold text-emerald-300">Relais {defaultRelais ?? '—'}</span>
            {defaultSecteur && <span>· {defaultSecteur}</span>}
          </div>
        )}
        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Niveau</p>
          <div className="grid grid-cols-6 gap-1.5">
            {NIVEAUX_ORDER.map((n) => (
              <Chip key={n} selected={niveau === n} onClick={() => setNiveau(n)} className="min-h-12 px-1">{NIVEAU_LABELS[n]}</Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Profil du mur</p>
          <div className="grid grid-cols-5 gap-1.5">
            {PROFILS.map((p) => (
              <Chip key={p} selected={profil === p} onClick={() => setProfil(p)} className="min-h-12 px-1">{PROFIL_LABELS[p]}</Chip>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Point de chute</p>
          <div className="grid grid-cols-4 gap-1.5">
            {CHUTES.map((c) => (
              <Chip key={c} selected={chute === c} onClick={() => setChute(c)} className="min-h-12 px-1">{CHUTE_LABELS[c]}</Chip>
            ))}
          </div>
        </div>

        {!isTop && (
          <div>
            <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">Cause de la chute</p>
            <div className="space-y-1.5">
              {CAUSES.map((c) => (
                <Chip key={c} selected={cause === c} onClick={() => setCause(c)} className="w-full text-left min-h-12 px-3 py-2.5 text-left">{CAUSE_LABELS[c]}</Chip>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Relais #</p>
            <input
              type="number"
              min={1}
              max={40}
              value={relais}
              onChange={(e) => setRelais(e.target.value)}
              placeholder="1–36"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-emerald-400 focus:outline-none"
            />
          </div>
          <div className="col-span-2">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Note (crux, clip…)</p>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="ex: crux au 3e clip"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-sm text-zinc-100 focus:border-emerald-400 focus:outline-none"
            />
          </div>
        </div>

        <Btn size="lg" onClick={() => void save()}>Enregistrer ({isTop ? 'réussi ✓' : 'échec noté'})</Btn>
      </div>
    </Sheet>
  );
}
