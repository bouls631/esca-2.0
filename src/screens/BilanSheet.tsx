import { useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { db, type Bilan } from '../db';
import { Btn, Card, Chip, Tag } from '../components/ui';
import { Sheet } from '../components/Sheet';
import { analyseBilan, LIMITE_LABELS, type BilanScores } from '../lib/bilan';

const DEFAUT: BilanScores = {
  flash: 50, doigtsMax: 5, doigtsRes: 8, bras: 10, gainage: 45,
  endurance: 10, mobiliteDouleur: false, recup: 4,
};

function Step({ label, value, step, min = 0, max = 100, suffix = '', aide, onChange }: {
  label: string; value: number; step: number; min?: number; max?: number; suffix?: string; aide: string; onChange: (v: number) => void;
}) {
  const [help, setHelp] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">{label}</p>
        <button
          type="button"
          onClick={() => setHelp((h) => !h)}
          aria-label="Voir le protocole du test"
          className="shrink-0 rounded border border-zinc-700 px-2 py-0.5 font-mono text-[10px] text-zinc-400"
        >
          ? protocole
        </button>
      </div>
      {help && (
        <p className="mb-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2 font-mono text-[11px] leading-relaxed text-zinc-300">{aide}</p>
      )}
      <div className="flex items-center gap-3">
        <Chip onClick={() => onChange(Math.max(min, value - step))}>−{step}</Chip>
        <p className="flex-1 text-center font-mono text-2xl font-black tabular-nums text-emerald-400">{value}{suffix}</p>
        <Chip onClick={() => onChange(Math.min(max, value + step))}>+{step}</Chip>
      </div>
    </div>
  );
}

/** Bilan initial : 8 tests avant le programme → facteur limitant injecté dans les séances. */
export function BilanSheet({ open, onClose, bilans }: { open: boolean; onClose: () => void; bilans: Bilan[] }) {
  const [s, setS] = useState<BilanScores>(DEFAUT);
  const saved = [...bilans].sort((a, b) => b.createdAt - a.createdAt);
  const verdict = analyseBilan(s);
  const set = <K extends keyof BilanScores>(k: K, v: BilanScores[K]) => setS((prev) => ({ ...prev, [k]: v }));

  async function save() {
    const now = new Date();
    await db.bilans.add({
      date: format(now, 'yyyy-MM-dd'),
      scores: s,
      limite: verdict.limite,
      createdAt: now.getTime(),
    });
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Bilan initial — 8 tests">
      <p className="font-mono text-xs text-zinc-400">
        48 h sans effort dur, peau intacte, 10 min d'échauffement. Note tes résultats : on en déduit le facteur limitant, priorité de toutes tes séances. Tu ne sais pas quoi faire ? Touche « ? protocole » sous chaque test.
      </p>

      {saved.length > 0 && (
        <Card className="mt-3 border-zinc-700">
          <p className="font-mono text-xs text-zinc-300">
            Dernier bilan du {format(saved[0].createdAt, 'd MMM', { locale: fr })} : <Tag tone="amber">{LIMITE_LABELS[saved[0].limite]}</Tag>
          </p>
        </Card>
      )}

      <div className="mt-4 space-y-4">
        <Step
          label="1 · Flash sur 8 voies (%)"
          value={s.flash} step={10} max={100} suffix="%"
          aide="8 voies à 6a/6a+, 2 par profil (dalle, dévers, toit, dièdre). Flash = topé du 1er essai, sans chute ni arrêt au milieu. 5/8 (63%) ou plus → technique ok ; 3/8 ou moins → technique prioritaire."
          onChange={(v) => set('flash', v)}
        />
        <Step
          label="2 · Charge max 7 s sur 20 mm (kg ajoutés, 0 = PDC)"
          value={s.doigtsMax} step={2.5} max={30} suffix=" kg"
          aide="Prise 20 mm, suspension 7 s avec le lest max que tu arrives à tenir. 3 essais, 2 min de repos entre chaque. Note le poids ajouté ; 0 si tu es au poids du corps."
          onChange={(v) => set('doigtsMax', v)}
        />
        <Step
          label="3 · Répétitions doigts 7 s / 3 s"
          value={s.doigtsRes} step={1} max={25}
          aide="20 mm au poids du corps : 7 s suspendu, 3 s relâché, et on recommence jusqu'à l'échec. Arrête après 2 échecs de suite."
          onChange={(v) => set('doigtsRes', v)}
        />
        <Step
          label="4 · Tractions strictes max"
          value={s.bras} step={1} max={30}
          aide="Aux anneaux ou à la barre : tractions strictes, menton au-dessus, sans élan, jusqu'à l'échec. Note le nombre maximum."
          onChange={(v) => set('bras', v)}
        />
        <Step
          label="5 · Gainage hollow (secondes)"
          value={s.gainage} step={5} max={180} suffix=" s"
          aide="Allongé sur le dos, bras tendus au-dessus de la tête, talons et omoplates décollés du sol. Tiens le plus longtemps possible. 2 essais, note le meilleur."
          onChange={(v) => set('gainage', v)}
        />
        <Step
          label="6 · 4×4 — voies réussies / 16"
          value={s.endurance} step={1} max={16}
          aide="4 séries de 4 voies à 5c/6a : 1 min de repos entre les voies, 5 min entre les séries. Compte les voies topées sur les 16 (chute = 0, on passe à la suivante sans rejouer). Moins de 10 = endurance faible."
          onChange={(v) => set('endurance', v)}
        />

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">7 · Douleur à la mobilité (épaule / hanche / cheville)</p>
          <div className="flex gap-2">
            <Chip selected={!s.mobiliteDouleur} onClick={() => set('mobiliteDouleur', false)}>Aucune</Chip>
            <Chip selected={s.mobiliteDouleur} onClick={() => set('mobiliteDouleur', true)}>Douleur</Chip>
          </div>
          <p className="mt-1 font-mono text-[10px] text-zinc-500">
            3 gestes : main dans le dos (épaule), fente profonde (hanche), genou au mur (cheville). Coche « Douleur » si l'un fait mal.
          </p>
        </div>

        <div>
          <p className="mb-1.5 font-mono text-xs uppercase tracking-widest text-zinc-500">8 · Sommeil / récupération cette semaine</p>
          <div className="flex flex-wrap gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Chip key={n} selected={s.recup === n} onClick={() => set('recup', n)} className="px-2.5">{n}</Chip>
            ))}
          </div>
          <p className="mt-1 font-mono text-[10px] text-zinc-500">1 = épuisé · 5 = je récupère bien (sommeil, énergie, alimentation)</p>
        </div>

        <Card className="border-emerald-600 bg-emerald-950/20">
          <p className="font-mono text-sm font-bold text-emerald-300">Facteur limitant : {LIMITE_LABELS[verdict.limite]} ({verdict.score}/100)</p>
          <div className="mt-2 space-y-1">
            {verdict.prescription.map((p) => (
              <p key={p} className="font-mono text-xs text-zinc-300">• {p}</p>
            ))}
          </div>
        </Card>

        <Btn size="lg" onClick={() => void save()}>Enregistrer le bilan</Btn>
        <p className="text-center font-mono text-[10px] text-zinc-600">
          Repères 6a→7a indicatifs. Une douleur persistante → avis médical.
        </p>
      </div>
    </Sheet>
  );
}
