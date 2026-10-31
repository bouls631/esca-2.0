import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { AppData } from '../App';
import { AXIS_LABELS, exportAll, type Axis, type Niveau } from '../db';
import { Bar, Btn, Card, Tag } from '../components/ui';
import { ReadinessSheet } from './ReadinessSheet';
import { evaluateSurmenage } from '../lib/surmenage';
import { ready7a, readinessAssessment } from '../lib/readiness';
import { analyses, gauges } from '../lib/analyse-causes';

const AXES: Axis[] = ['force', 'endurance', 'technique', 'mental'];

export default function Stats({ data, now }: { data: AppData; now: Date }) {
  const [readinessOpen, setReadinessOpen] = useState(false);
  const verdict = evaluateSurmenage(data, now);
  const gate = ready7a({ seances: data.seances, voies: data.voies, readiness: data.readiness }, now, verdict);
  const ra = readinessAssessment(data.readiness);

  const voies14 = data.voies.filter((v) => v.date >= subDays(now, 14).getTime());
  const g = gauges(voies14);
  const presc = analyses(voies14);

  const todayKey = format(now, 'yyyy-MM-dd');
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = subDays(now, 13 - i);
    const key = format(d, 'yyyy-MM-dd');
    return {
      d,
      isToday: key === todayKey,
      voies: data.voies.filter((v) => format(v.date, 'yyyy-MM-dd') === key).length,
      planned: data.seances.some((s) => s.date === key),
    };
  });

  const sessions = [...data.seances].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);

  async function doExport() {
    const all = await exportAll();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `coach-voie-${format(now, 'yyyy-MM-dd')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-3">
      <Card>
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">Porte 7a</p>
        <div className="mt-2 space-y-1">
          {gate.checks.map((c) => (
            <p key={c.label} className={`font-mono text-xs ${c.ok ? 'text-emerald-400' : 'text-zinc-400'}`}>
              {c.ok ? '✓' : '✗'} {c.label}
            </p>
          ))}
        </div>
        <p className={`mt-3 font-mono text-sm font-black uppercase ${gate.ready ? 'text-emerald-400' : 'text-zinc-500'}`}>
          {gate.ready ? '🔓 Prêt pour le 7a' : 'Pas encore prêt — les ✓ se construisent en grimpant le mardi'}
        </p>
      </Card>

      <Card>
        <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">Jauges (14 jours)</p>
        <div className="mt-3 space-y-3">
          {AXES.map((a) => <Bar key={a} label={AXIS_LABELS[a]} score={g[a].score} n={g[a].n} />)}
        </div>
        {presc.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-zinc-800 pt-3">
            {presc.map((p) => (
              <p key={p.deficit} className="font-mono text-[11px] text-zinc-300"><span className="font-bold text-sky-300">{p.titre}</span> — {p.detail}</p>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">Calendrier 14 jours</p>
          <Tag tone="zinc">{format(now, 'd MMM', { locale: fr })}</Tag>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {days.map(({ d, isToday, voies, planned }) => (
            <div key={d.getTime()} className={isToday ? 'rounded-lg border border-zinc-400 px-0.5 py-1.5 text-center' : 'rounded-lg border border-zinc-800 px-0.5 py-1.5 text-center'}>
              <p className="font-mono text-[9px] uppercase text-zinc-500">{format(d, 'EEE', { locale: fr }).slice(0, 2)}</p>
              <p className={`font-mono text-sm font-bold tabular-nums ${planned ? (voies > 0 ? 'text-emerald-400' : 'text-amber-400') : 'text-zinc-600'}`}>
                {voies > 0 ? voies : '·'}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 font-mono text-[10px] text-zinc-600">chiffre = voies loggées · vert = séance loggée · ambre = planifiée sans log</p>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">Historique</p>
          <Btn className="min-h-8 px-2 py-1 text-xs" onClick={() => void doExport()}>Export JSON</Btn>
        </div>
        <div className="mt-2 space-y-1.5">
          {sessions.length === 0 && <p className="font-mono text-xs text-zinc-500">Aucune séance enregistrée.</p>}
          {sessions.map((s) => {
            const vs = data.voies.filter((v) => v.seanceId === s.id);
            const tops = vs.filter((v) => v.chute === 'top').length;
            return (
              <p key={s.id} className="font-mono text-xs text-zinc-300">
                <span className="text-zinc-500">{format(s.date, 'EEE d MMM', { locale: fr }).slice(0, 8)}</span>{' '}
                <span className="font-bold">{s.type === 'intensite' ? 'INT' : 'VOL'}</span>{' '}
                {vs.length > 0
                  ? `— ${vs.length} voies, ${tops} tops${vs.some((v) => v.niveau === '6c' || v.niveau === '7a') ? ` (max ${maxNiveau(vs.map((v) => v.niveau))})` : ''}`
                  : '— pas de voie loggée'}
                {data.checkins.some((c) => c.date === s.date && c.override) && <span className="text-amber-400"> · ⚠ override</span>}
              </p>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-zinc-500">Readiness</p>
          <Btn className="min-h-8 px-2 py-1 text-xs" onClick={() => setReadinessOpen(true)}>Nouveau test</Btn>
        </div>
        {ra.last ? (
          <p className="mt-2 font-mono text-xs text-zinc-300">
            {format(ra.last.createdAt, 'd MMM', { locale: fr })} : {ra.last.deadhangS}s deadhang ({ra.last.holdLabel}), {ra.last.tractions} tractions, ressenti {ra.last.ressenti}/10.
            {ra.enoughTests && (ra.drop ? <span className="font-bold text-amber-300"> Baisse ≥20% → prochaines séances allégées.</span> : <span className="font-bold text-emerald-300"> Stable.</span>)}
          </p>
        ) : (
          <p className="mt-2 font-mono text-xs text-zinc-500">Aucun test enregistré.</p>
        )}
      </Card>

      <ReadinessSheet open={readinessOpen} onClose={() => setReadinessOpen(false)} profile={data.profile} existing={data.readiness} />
    </div>
  );
}

function maxNiveau(ns: Niveau[]): Niveau {
  const order: Niveau[] = ['5+', '6a', '6b', '6b+', '6c', '7a'];
  return ns.reduce((best, n) => (order.indexOf(n) > order.indexOf(best) ? n : best), order[0]);
}
