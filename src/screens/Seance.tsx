import { useState } from 'react';
import { format } from 'date-fns';
import type { AppData, Tab } from '../App';
import { db, FEEL_LABELS, NIVEAU_LABELS, PROFIL_LABELS, SESSION_LABELS, type Bloc, type Niveau, type Profil, type Ressenti } from '../db';
import { Btn, Card, Chip, Tag, TimerCard, cx, useTimer } from '../components/ui';
import { CheckInSheet } from './CheckIn';
import { JournalVoie } from './JournalVoie';
import { evaluateSurmenage } from '../lib/surmenage';
import { rotationFor } from '../lib/cycles';
import { useSwipe } from '../lib/useSwipe';
import { timer } from '../lib/timer';
import { cotationToNiveau, relaisToProfil, suggestRoutesFor, type OblykRoute } from '../lib/routes';

interface JournalTarget {
  seanceId?: number;
  blocId?: string;
  niveau?: Niveau;
  profil?: Profil;
  relais?: number;
  secteur?: string;
  couleur?: string;
  oblykId?: number;
}

const RESSENTIS: Ressenti[] = ['facile', 'moyen', 'dur'];

export default function Seance({ data, now, go }: { data: AppData; now: Date; go?: (t: Tab) => void }) {
  const key = format(now, 'yyyy-MM-dd');
  const seance = data.seances.filter((s) => s.date === key).sort((a, b) => b.createdAt - a.createdAt)[0];
  const ck = data.checkins.filter((c) => c.date === key).sort((a, b) => b.createdAt - a.createdAt)[0];
  const verdict = evaluateSurmenage(data, now);
  const rotation = rotationFor(now);
  const dayN = now.getDay();
  const focus = dayN === 2 ? rotation.mardi : rotation.jeudi;

  const [checkinOpen, setCheckinOpen] = useState(false);
  const [journal, setJournal] = useState<JournalTarget | null>(null);

  const voiesToday = seance?.id !== undefined ? data.voies.filter((v) => v.seanceId === seance.id) : [];
  const hardBlocked = seance !== undefined && verdict.state === 'bloque' && !(ck?.override ?? false);

  async function skipBloc(blocId: string, skipped: boolean) {
    if (!seance?.id) return;
    await db.seances.update(seance.id, { blocs: seance.blocs.map((b) => (b.id === blocId ? { ...b, skipped, done: skipped ? false : b.done } : b)) });
  }

  /** Exercice (pas une voie) : cocher sans journal. */
  async function toggleDone(blocId: string) {
    if (!seance?.id) return;
    await db.seances.update(seance.id, { blocs: seance.blocs.map((b) => (b.id === blocId ? { ...b, done: !b.done, skipped: false } : b)) });
  }

  async function setRessenti(blocId: string, r: Ressenti) {
    if (!seance?.id) return;
    await db.seances.update(seance.id, { blocs: seance.blocs.map((b) => (b.id === blocId ? { ...b, done: true, skipped: false, ressenti: b.ressenti === r ? undefined : r } : b)) });
  }

  async function overrideRisk() {
    if (!ck?.id) return;
    await db.checkins.update(ck.id, { override: true });
  }

  return (
    <div className="space-y-3">
      {!seance ? (
        <>
          <Card className={dayN === 2 || dayN === 4 ? 'border-emerald-700' : undefined}>
            <p className="font-mono text-sm font-bold uppercase text-zinc-200">
              {dayN === 2 ? 'Séance du mardi — pas encore de check-in' : dayN === 4 ? 'Séance du jeudi — pas encore de check-in' : 'Pas de séance programmée aujourd\'hui'}
            </p>
            <p className="mt-1 font-mono text-xs text-zinc-400">
              {dayN === 2 ? `Focus rotation : ${focus ? PROFIL_LABELS[focus] : 'au choix'}` :
                dayN === 4 ? `Focus rotation : ${focus ? PROFIL_LABELS[focus] : 'au choix'}` :
                `Prochaine séance officielle : ${dayN < 2 ? 'mardi' : 'jeudi'} (${dayN < 2 ? 'intensité' : 'volume'}).`}
            </p>
            <Btn size="lg" className="mt-3" onClick={() => setCheckinOpen(true)}>Check-in (30 s)</Btn>
          </Card>
          <TimerCard />
        </>
      ) : (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <p className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-200">
                Séance — {SESSION_LABELS[seance.type]}
              </p>
              {ck && (
                <Tag tone={ck.energy >= 3 ? 'emerald' : ck.energy === 2 ? 'amber' : 'red'}>
                  énergie {ck.energy}/4 {ck.location === 'maison' ? '· maison' : ck.location === 'repos_force' ? '· repos' : ''}
                </Tag>
              )}
            </div>
            {seance.note && <p className="mt-2 font-mono text-xs leading-relaxed text-amber-200">{seance.note}</p>}
            {verdict.state === 'bloque' && !(ck?.override ?? false) && (
              <Card className="mt-3 border-red-600 bg-red-950/40">
                <p className="font-mono text-xs font-bold text-red-200">Séance bloquée par le détecteur de surmenage</p>
                {verdict.alerts.map((a) => (
                  <p key={a.id} className="mt-1 font-mono text-[11px] text-red-100">{a.title} — {a.message}</p>
                ))}
                {ck?.id !== undefined && (
                  <Btn variant="danger" className="mt-3" onClick={() => void overrideRisk()}>J'assume le risque</Btn>
                )}
              </Card>
            )}
            {verdict.state === 'repos_actif' && !(ck?.override ?? false) && (
              <Card className="mt-3 border-amber-600 bg-amber-950/30">
                <p className="font-mono text-xs text-amber-200">⚠ Repos actif conseillé — 20 min de mobilité plutôt que le plan affiché. Ne force pas.</p>
              </Card>
            )}
          </Card>

          {!hardBlocked && (
            <div className="space-y-2">
              {seance.blocs.map((b) => {
                const grimpable = b.niveau !== undefined;
                const suggested = grimpable ? suggestRoutesFor(b.niveau!, focus) : [];
                return (
                  <BlocCard
                    key={b.id}
                    bloc={b}
                    suggested={suggested}
                    onPickRoute={(r) => setJournal({
                      seanceId: seance.id,
                      blocId: b.id,
                      niveau: cotationToNiveau(r.cotation),
                      profil: relaisToProfil(r.relais),
                      relais: r.relais ?? undefined,
                      secteur: r.secteur ?? undefined,
                      couleur: r.couleur ?? undefined,
                      oblykId: r.id,
                    })}
                    onFait={() => (grimpable
                      ? setJournal({ seanceId: seance.id, blocId: b.id, niveau: b.niveau, profil: focus ?? 'dalle' })
                      : void toggleDone(b.id))}
                    onRepor={() => void skipBloc(b.id, !b.skipped)}
                    onModifie={() => setJournal({ seanceId: seance.id, profil: focus ?? 'dalle' })}
                    onRessenti={grimpable ? undefined : (r) => void setRessenti(b.id, r)}
                    canLog={grimpable}
                  />
                );
              })}
            </div>
          )}

          <TimerCard />

          {voiesToday.length > 0 && (
            <Card>
              <p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Voies de la séance ({voiesToday.length})</p>
              <div className="mt-2 space-y-1">
                {voiesToday.slice().sort((a, b) => a.date - b.date).map((v) => (
                  <p key={v.id} className="font-mono text-xs text-zinc-300">
                    <span className={v.chute === 'top' ? 'text-emerald-400' : 'text-zinc-400'}>
                      {v.essai}× {NIVEAU_LABELS[v.niveau]}{v.relais ? ` (Relais ${v.relais})` : ''} · {PROFIL_LABELS[v.profil]} · {v.chute === 'top' ? 'TOP ✓' : `${v.chute} — ${v.cause ?? ''}`}{v.note ? ` · "${v.note}"` : ''}
                    </span>
                  </p>
                ))}
              </div>
            </Card>
          )}

          {seance.blocs.some((b) => b.niveau !== undefined) && (
            <div className="grid grid-cols-2 gap-2">
              <Btn size="lg" variant="ghost" onClick={() => setJournal({ seanceId: seance.id, profil: focus ?? 'dalle' })}>+ Noter une voie</Btn>
              {go && <Btn size="lg" variant="ghost" onClick={() => go('salle')}>Roue RAPPEL</Btn>}
            </div>
          )}
        </>
      )}

      <CheckInSheet
        open={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        data={data}
        now={now}
        onDone={() => setCheckinOpen(false)}
      />
      <JournalVoie
        open={journal !== null}
        onClose={() => setJournal(null)}
        seanceId={journal?.seanceId}
        blocId={journal?.blocId}
        defaultNiveau={journal?.niveau}
        defaultProfil={journal?.profil}
        defaultRelais={journal?.relais}
        defaultSecteur={journal?.secteur}
        defaultCouleur={journal?.couleur}
        defaultOblykId={journal?.oblykId}
      />
    </div>
  );
}

/** Carte de bloc : swipe droite = Fait, gauche = Reporté, bas = Modifié (boutons en secours). */
function BlocCard({ bloc, suggested, onPickRoute, onFait, onRepor, onModifie, onRessenti, canLog }: {
  bloc: Bloc;
  suggested: OblykRoute[];
  onPickRoute: (r: OblykRoute) => void;
  onFait: () => void;
  onRepor: () => void;
  onModifie: () => void;
  onRessenti?: (r: Ressenti) => void;
  canLog: boolean;
}) {
  const swipe = useSwipe({ onRight: onFait, onLeft: onRepor, onDown: onModifie });
  const t = useTimer();
  return (
    <Card
      className={cx(
        'select-none',
        bloc.done && 'border-emerald-600 bg-emerald-950/20',
        bloc.skipped && 'opacity-40',
      )}
    >
      <div {...swipe} className="touch-pan-y">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-sm font-bold text-zinc-100">
            {bloc.done ? '✓ ' : ''}{bloc.titre}
          </p>
          {bloc.niveau && <Tag tone={bloc.niveau === '6c' || bloc.niveau === '7a' ? 'amber' : 'zinc'}>{NIVEAU_LABELS[bloc.niveau]}</Tag>}
        </div>
        <p className="mt-1 font-mono text-xs leading-relaxed text-zinc-400">{bloc.detail}</p>
      </div>
      {suggested.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase text-zinc-500">RAPPEL :</span>
          {suggested.map((r) => (
            <button
              key={r.id}
              onClick={() => onPickRoute(r)}
              className="inline-flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-300 hover:border-emerald-500"
            >
              <span className="h-2.5 w-2.5 rounded-full border border-white/30" style={{ background: r.couleur ?? '#999' }} />
              <span>R{r.relais} · {r.cotation}</span>
            </button>
          ))}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {bloc.restMin ? (
          <Chip onClick={() => timer.start(bloc.restMin!)} className={t.running ? 'text-amber-300' : undefined}>Repos {bloc.restMin}′</Chip>
        ) : null}
        <Chip selected={bloc.done} onClick={onFait}>Fait</Chip>
        {onRessenti && RESSENTIS.map((r) => (
          <Chip key={r} selected={bloc.ressenti === r} onClick={() => onRessenti(r)}>{FEEL_LABELS[r]}</Chip>
        ))}
        <Chip selected={bloc.skipped} onClick={onRepor}>{bloc.skipped ? 'Réactivé' : 'Reporté'}</Chip>
        {canLog && <Chip onClick={onModifie}>Noter</Chip>}
      </div>
    </Card>
  );
}
