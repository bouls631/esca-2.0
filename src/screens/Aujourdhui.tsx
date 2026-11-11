import { useState } from 'react';
import { format } from 'date-fns';
import type { AppData, Tab } from '../App';
import { db, CAUSE_LABELS, COULEURS_BLOC, OBJECTIFS, PROFIL_LABELS, type CouleurBloc, type Objectif } from '../db';
import { Btn, Card, Chip, Tag, TimerCard } from '../components/ui';
import { SeqTimerCard } from '../components/SeqTimerCard';
import { rotationFor } from '../lib/cycles';
import { evaluateSurmenage } from '../lib/surmenage';
import { ready7a } from '../lib/readiness';
import { grade } from '../lib/generator';
import { lastFailCause, microWorkout } from '../lib/analyse-causes';
import { coachLevelVerdict, cycleInfo, fingerBestByHold, fingerSpec, homeSpec, HOLD_LABELS, levelConfig, mobiliteSpec, profileSuccessStats, renfoSpec } from '../lib/plan';
import { ReadinessSheet } from './ReadinessSheet';

export default function Aujourdhui({ data, now, go }: { data: AppData; now: Date; go: (t: Tab) => void }) {
  const [readinessOpen, setReadinessOpen] = useState(false);
  const [fingerKg, setFingerKg] = useState<string>('0');
  const dayN = now.getDay();
  const key = format(now, 'yyyy-MM-dd');
  const checkedToday = data.checkins.some((c) => c.date === key);
  const lastReadiness = [...data.readiness].sort((a, b) => b.createdAt - a.createdAt)[0];
  const readinessStale = !lastReadiness || now.getTime() - lastReadiness.createdAt > 9 * 24 * 3600 * 1000;
  const verdict = evaluateSurmenage(data, now);
  const gate7a = ready7a({ seances: data.seances, voies: data.voies, readiness: data.readiness }, now, verdict);
  const rotation = rotationFor(now);
  const recentFails = data.voies.filter((v) => v.chute !== 'top' && v.date >= now.getTime() - 7 * 24 * 3600 * 1000);
  const fail = lastFailCause(recentFails);
  const isSessionDay = dayN === 2 || dayN === 4;

  const cfg = levelConfig(data.profile.level ?? 5);
  const objectif: Objectif = data.profile.objectif ?? '6c';
  const objectifBloc: CouleurBloc = data.profile.objectifBloc ?? 'rouge';
  const cyc = cycleInfo(now, data.profile.cycleStart, data.profile.weekOffset);
  const fSpec = fingerSpec(cfg, cyc);
  const hSpec = homeSpec(cfg, cyc);
  const mSpec = mobiliteSpec(cfg);
  const rSpec = renfoSpec(cfg, cyc);
  const fBest = fingerBestByHold(data.finger);
  const pStats = profileSuccessStats(data.voies);
  const cVerdict = coachLevelVerdict(data.voies, cfg.grade, now);

  async function setLevel(lv: number) {
    const clamped = Math.max(1, Math.min(9, lv));
    await db.profile.put({ ...data.profile, id: 'me', level: clamped });
  }

  async function setObjectif(o: Objectif) {
    await db.profile.put({ ...data.profile, id: 'me', objectif: o });
  }

  async function setObjectifBloc(c: CouleurBloc) {
    await db.profile.put({ ...data.profile, id: 'me', objectifBloc: c });
  }

  async function nudgeWeek(delta: number) {
    const nextOff = (data.profile.weekOffset ?? 0) + delta;
    await db.profile.put({ ...data.profile, id: 'me', cycleStart: cyc.startIso, weekOffset: nextOff });
  }

  async function resetCycle(bump = 0) {
    const nextLv = Math.max(1, Math.min(9, cfg.level + bump));
    await db.profile.put({ ...data.profile, id: 'me', level: nextLv, cycleStart: key, weekOffset: 0 });
  }

  async function logFingerSession() {
    const kg = Math.max(0, parseFloat(fingerKg) || 0);
    await db.finger.add({
      date: key,
      hold: cfg.hold,
      kg,
      sets: fSpec.sets,
      work: fSpec.work,
      week: cyc.week,
      createdAt: Date.now(),
    });
  }

  const dayLabel =
    dayN === 1 ? 'Lundi — Force de doigts (poutre)' :
    dayN === 2 ? 'Mardi — Intensité / Voie max' :
    dayN === 4 ? 'Jeudi — Volume / Endurance' :
    dayN === 5 ? 'Vendredi — Force maison (anneaux)' :
    dayN === 0 ? 'Dimanche — Readiness (5 min)' :
    dayN === 3 ? 'Mercredi — Mobilité' :
    'Samedi — Renforcement';

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between">
          <p className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-200">{dayLabel}</p>
          <Tag tone={dayN === 2 ? 'amber' : dayN === 4 ? 'sky' : 'zinc'}>
            {dayN === 2 ? 'INTENSITÉ' : dayN === 4 ? 'VOLUME' : `S${cyc.week}/12`}
          </Tag>
        </div>
        <p className="mt-2 font-mono text-xs text-zinc-400">
          Rotation anti-spécialisation · semaine {rotation.no}/4 :{' '}
          {rotation.liberation
            ? 'SEMAINE LIBRE — profils au choix (ou récupération)'
            : `mardi : ${rotation.mardi} · jeudi : ${rotation.jeudi}`}
          {pStats.weak && ` · profil faible : ${PROFIL_LABELS[pStats.weak.profil]} (${pStats.weak.pct}% top)`}
        </p>
      </Card>

      {verdict.state !== 'ok' && (
        <Card className={verdict.state === 'bloque' ? 'border-red-600 bg-red-950/30' : 'border-amber-600 bg-amber-950/20'}>
          {verdict.alerts.map((a) => (
            <div key={a.id} className="mb-2 last:mb-0">
              <p className={`font-mono text-sm font-bold ${a.sev === 'rouge' ? 'text-red-200' : 'text-amber-200'}`}>{a.title}</p>
              <p className="font-mono text-xs text-zinc-300">{a.message}</p>
            </div>
          ))}
        </Card>
      )}

      {isSessionDay && (
        <Card>
          {checkedToday ? (
            <>
              <p className="font-mono text-sm text-zinc-300">Check-in fait ✓ — plan généré.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Btn size="lg" onClick={() => go('seance')}>Ma séance</Btn>
                <Btn size="lg" variant="ghost" onClick={() => go('salle')}>Roue RAPPEL</Btn>
              </div>
            </>
          ) : (
            <>
              <p className="font-mono text-sm text-zinc-300">30 secondes de check-in avant d'attaquer : j'évalue le surmenage et je génère ton plan.</p>
              <Btn size="lg" className="mt-3" onClick={() => go('seance')}>Commencer le check-in</Btn>
            </>
          )}
        </Card>
      )}

      {dayN === 5 && (
        <Card>
          <p className="font-mono text-sm font-bold uppercase text-zinc-200">Micro-workout maison (10 min)</p>
          {fail?.cause ? (
            <>
              <p className="mt-1 font-mono text-xs text-zinc-400">
                Prescrit pour ta dernière chute du {format(fail.date, 'd MMM', { locale: undefined })} : « {fail.cause ? CAUSE_LABELS[fail.cause] : ''} ».
              </p>
              <div className="mt-2 space-y-1">
                {microWorkout(fail.cause).map((b) => (
                  <p key={b.id} className="font-mono text-xs text-zinc-300">
                    • <span className="font-bold text-emerald-300">{b.titre}</span> — {b.detail}
                  </p>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-1 font-mono text-xs text-zinc-400">Aucune chute récente enregistrée → mobilité complète 10 min (épaules, hanches, colonne).</p>
          )}
          <Btn size="lg" className="mt-3" onClick={() => go('seance')}>Détails & timer</Btn>
        </Card>
      )}

      {dayN === 1 && (
        <SeqTimerCard
          title="Chrono · Force de doigts (lundi)"
          badge={cfg.hold}
          seq={fSpec.seq}
          meta={[
            { label: 'Séries', val: String(fSpec.sets) },
            { label: 'Travail', val: `${fSpec.work}s` },
            { label: 'Repos', val: `${fSpec.rest}s` },
            { label: 'Prépa', val: `${fSpec.setup}s` },
          ]}
          onComplete={() => void logFingerSession()}
        >
          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={0.5}
              value={fingerKg}
              onChange={(e) => setFingerKg(e.target.value)}
              placeholder="Lest en kg (0 = PDC)"
              className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-100"
            />
            <Chip onClick={() => void logFingerSession()}>Noter {fingerKg || 0} kg</Chip>
          </div>
          {Object.keys(fBest).length > 0 && (
            <p className="mt-2 font-mono text-[11px] text-zinc-400">
              Records :{' '}
              {Object.entries(fBest)
                .map(([h, kg]) => `${HOLD_LABELS[h] ?? h} (${kg > 0 ? `+${kg}kg` : 'PDC'})`)
                .join(' · ')}
            </p>
          )}
        </SeqTimerCard>
      )}

      {dayN === 5 && (
        <SeqTimerCard
          title="Chrono · Force maison aux anneaux (vendredi)"
          badge={`${hSpec.sets} séries`}
          seq={hSpec.seq}
        >
          <div className="mt-2 space-y-1">
            {hSpec.items.map((it) => (
              <p key={it.titre} className="font-mono text-xs text-zinc-400">
                • <span className="font-bold text-zinc-200">{it.titre}</span> : {it.sets} × {it.reps} (repos {Math.floor(it.rest / 60)}:{String(it.rest % 60).padStart(2, '0')})
              </p>
            ))}
          </div>
        </SeqTimerCard>
      )}

      {dayN === 3 && (
        <SeqTimerCard
          title="Chrono · Mobilité (mercredi)"
          badge={`Niveau ${cfg.grade}`}
          seq={mSpec.seq}
          meta={[
            { label: 'Durée', val: `~${mSpec.minutes} min` },
            { label: 'Tenue', val: `${mSpec.hold}s` },
            { label: 'Tours', val: String(mSpec.rounds) },
          ]}
        >
          <div className="mt-2 space-y-1">
            {mSpec.items.map((it) => (
              <p key={it.titre} className="font-mono text-xs text-zinc-400">
                • <span className="font-bold text-zinc-200">{it.titre}</span> : {it.detail}
              </p>
            ))}
          </div>
        </SeqTimerCard>
      )}

      {dayN === 6 && (
        <SeqTimerCard
          title="Chrono · Renforcement (samedi)"
          badge={`Niveau ${cfg.grade} · ${rSpec.sets} séries`}
          seq={rSpec.seq}
        >
          <div className="mt-2 space-y-1">
            {rSpec.items.map((it) => (
              <p key={it.titre} className="font-mono text-xs text-zinc-400">
                • <span className="font-bold text-zinc-200">{it.titre}</span> : {it.reps}
              </p>
            ))}
          </div>
        </SeqTimerCard>
      )}

      {(dayN === 0 || readinessStale) && (
        <Card>
          <p className="font-mono text-sm font-bold uppercase text-zinc-200">Readiness hebdo</p>
          <p className="mt-1 font-mono text-xs text-zinc-400">
            {lastReadiness && dayN !== 0
              ? `Dernier test le ${format(lastReadiness.createdAt, 'd MMM', { locale: undefined })} — plus de 9 jours.`
              : 'Dimanche soir : 5 min pour calibrer la semaine (deadhang poutre + tractions + ressenti).'}
          </p>
          <Btn size="lg" className="mt-3" onClick={() => setReadinessOpen(true)}>Faire le test</Btn>
        </Card>
      )}

      {gate7a.ready && (
        <Card className="border-emerald-500 bg-emerald-950/30">
          <p className="font-mono text-sm font-bold text-emerald-300">🔓 PRÊT POUR LE 7a</p>
          <p className="font-mono text-xs text-zinc-300">
            3 tops 6c le mardi en 4 semaines + readiness stable + aucun blocage. Le mardi passe automatiquement en mode projet 7a (3 essais).
          </p>
        </Card>
      )}

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">
            Cycle 12 sem · {cyc.phaseName}
          </p>
          <Tag tone={cyc.deload ? 'amber' : 'emerald'}>
            Semaine {cyc.week}/12 {cyc.deload ? '· décharge' : ''}
          </Tag>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">Objectif projet :</span>
          {OBJECTIFS.map((o) => (
            <Chip key={o} selected={objectif === o} onClick={() => void setObjectif(o)} className="px-2.5 py-1 text-xs">{o}</Chip>
          ))}
        </div>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">
          Intensité : échauffement {grade(objectif, -3)} → projet {objectif} (2 essais ×2) → technique {grade(objectif, -1)}.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs text-zinc-400">Objectif bloc :</span>
          {COULEURS_BLOC.map((c) => (
            <Chip key={c} selected={objectifBloc === c} onClick={() => void setObjectifBloc(c)} className="px-2.5 py-1 text-xs">{c}</Chip>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Chip onClick={() => void setLevel(cfg.level - 1)}>−</Chip>
          <div className="flex-1 text-center">
            <p className="font-mono text-xs text-zinc-400">
              Cible <span className="text-base font-black text-emerald-400">{cfg.grade}</span> · rythme {cfg.cruise} · échau {cfg.easy}
            </p>
            <p className="font-mono text-[11px] text-zinc-500">
              Doigts {cfg.hold} ({cfg.lest}) · charge {cfg.charge}
            </p>
          </div>
          <Chip onClick={() => void setLevel(cfg.level + 1)}>+</Chip>
        </div>

        <p className="mt-2 font-mono text-xs text-zinc-300">
          {cVerdict.need !== undefined
            ? `Avis coach (${cfg.grade}) : besoin de 5 voies sur 3 jours (actuel : ${cVerdict.need}).`
            : cVerdict.delta === 1
              ? `🔥 ${Math.round((cVerdict.rate ?? 0) * 100)}% de réussite sur ${cVerdict.n} voies à ${cfg.grade} → prêt à monter d'un cran.`
              : cVerdict.delta === -1
                ? `⚠ ${Math.round((cVerdict.rate ?? 0) * 100)}% sur ${cVerdict.n} voies à ${cfg.grade} → consolide un cran en dessous.`
                : `✓ ${Math.round((cVerdict.rate ?? 0) * 100)}% sur ${cVerdict.n} voies à ${cfg.grade} → niveau adapté, on consolide.`}
        </p>
        {cVerdict.delta !== undefined && cVerdict.delta !== 0 && (
          <Btn className="mt-2 w-full" onClick={() => void setLevel(cfg.level + cVerdict.delta!)}>
            Appliquer le conseil ({cVerdict.delta > 0 ? '+1 cran' : '−1 cran'})
          </Btn>
        )}

        <div className="mt-3 flex items-center justify-between border-t border-zinc-800 pt-2">
          <div className="flex gap-1.5">
            <Chip className="px-2.5 py-1 text-xs" onClick={() => void nudgeWeek(-1)}>◀ S−1</Chip>
            <Chip className="px-2.5 py-1 text-xs" onClick={() => void nudgeWeek(1)}>S+1 ▶</Chip>
          </div>
          {cyc.week >= 12 ? (
            <Chip selected onClick={() => void resetCycle(cVerdict.delta === 1 ? 1 : 0)}>
              🎓 Nouveau cycle
            </Chip>
          ) : (
            <Chip className="px-2.5 py-1 text-xs" onClick={() => void resetCycle(0)}>Relancer S1</Chip>
          )}
        </div>
      </Card>

      <TimerCard />
      <ReadinessSheet open={readinessOpen} onClose={() => setReadinessOpen(false)} profile={data.profile} existing={data.readiness} />
    </div>
  );
}
