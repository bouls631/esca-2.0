import { useState } from 'react';
import { format } from 'date-fns';
import type { AppData, Tab } from '../App';
import { Btn, Card, Tag, TimerCard } from '../components/ui';
import { rotationFor } from '../lib/cycles';
import { evaluateSurmenage } from '../lib/surmenage';
import { ready7a } from '../lib/readiness';
import { lastFailCause, microWorkout } from '../lib/analyse-causes';
import { CAUSE_LABELS } from '../lib/types';
import { ReadinessSheet } from './ReadinessSheet';

export default function Aujourdhui({ data, now, go }: { data: AppData; now: Date; go: (t: Tab) => void }) {
  const [readinessOpen, setReadinessOpen] = useState(false);
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

  const dayLabel =
    dayN === 2 ? 'Mardi — Intensité / Voie max' :
    dayN === 4 ? 'Jeudi — Volume / Endurance' :
    dayN === 0 ? 'Dimanche — Readiness (5 min)' :
    dayN === 3 || dayN === 5 ? 'Récupération · micro-workout maison' :
    'Jour off · rien à forcer';

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center justify-between">
          <p className="font-mono text-sm font-bold uppercase tracking-wider text-zinc-200">{dayLabel}</p>
          <Tag tone={dayN === 2 ? 'amber' : dayN === 4 ? 'sky' : 'zinc'}>{dayN === 2 ? 'INTENSITÉ' : dayN === 4 ? 'VOLUME' : 'OFF'}</Tag>
        </div>
        <p className="mt-2 font-mono text-xs text-zinc-400">
          Rotation anti-spécialisation · semaine {rotation.no}/4 :{' '}
          {rotation.liberation
            ? 'SEMAINE LIBRE — profils au choix (ou récupération)'
            : `mardi : ${rotation.mardi} · jeudi : ${rotation.jeudi}`}
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
              <Btn size="lg" className="mt-3" onClick={() => go('seance')}>Aller à la séance</Btn>
            </>
          ) : (
            <>
              <p className="font-mono text-sm text-zinc-300">30 secondes de check-in avant d'attaquer : j'évalue le surmenage et je génère ton plan.</p>
              <Btn size="lg" className="mt-3" onClick={() => go('seance')}>Commencer le check-in</Btn>
            </>
          )}
        </Card>
      )}

      {(dayN === 3 || dayN === 5) && (
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

      <TimerCard />
      <ReadinessSheet open={readinessOpen} onClose={() => setReadinessOpen(false)} profile={data.profile} existing={data.readiness} />
    </div>
  );
}
