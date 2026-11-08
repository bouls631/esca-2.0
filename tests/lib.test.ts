import { describe, expect, it } from 'vitest';
import { evaluateSurmenage, lastMardiIntense } from '../src/lib/surmenage';
import { generateSeance, maisonSeriesFor } from '../src/lib/generator';
import { rotationFor } from '../src/lib/cycles';
import { readinessAssessment, ready7a } from '../src/lib/readiness';
import { analyses, gauges, microWorkout } from '../src/lib/analyse-causes';
import type { Checkin, ReadinessTest, Seance, Voie } from '../src/db';

const MIN = 60_000;
const HOUR = 60 * MIN;
const now = new Date('2026-06-09T19:00:00'); // mardi

const checkin = (partial: Partial<Checkin> = {}): Checkin => ({
  date: '2026-06-09', type: 'intensite', location: 'club', energy: 3, pains: ['aucune'],
  feel: 'moyen', intent: 'standard', override: false, createdAt: now.getTime(),
  ...partial,
});
const voie = (atMs: number, niveau: Voie['niveau'], chute: Voie['chute'], cause?: Voie['cause'], seanceId = 1): Voie => ({
  seanceId, date: now.getTime() + atMs, createdAt: now.getTime() + atMs, niveau, chute, cause, essai: 1, profil: 'devers',
});
const seance = (type: Seance['type'], createdAt: number): Seance => ({ id: ++sid, date: '2026-06-02', type, blocs: [], createdAt });
let sid = 100;
const rd = (deadhangS: number, tractions: number, atMs: number): ReadinessTest => ({
  date: '2026-05-31', holdLabel: 'réglette 2 doigts', deadhangS, tractions, ressenti: 7, createdAt: atMs,
});
const U = (checkins: Checkin[] = [], seances: Seance[] = [], voies: Voie[] = []) => ({ checkins, seances, voies });

describe('rotation anti-spécialisation', () => {
  const tuesdays = [0, 1, 2, 3].map((i) => new Date(2026, 0, 6 + i * 7)); // 4 mardis consécutifs
  it('couvre les 4 profils sur 4 semaines', () => {
    const nos = tuesdays.map((d) => rotationFor(d).no);
    expect(new Set(nos)).toEqual(new Set([1, 2, 3, 4]));
  });
  it('la semaine 4 est libre', () => {
    const free = tuesdays.map(rotationFor).find((r) => r.liberation);
    expect(free?.mardi).toBeNull();
  });
});

describe('détection de surmenage (14 j glissants)', () => {
  it('3 derniers check-ins avec douleur → bloque', () => {
    const v = evaluateSurmenage(U([
      checkin({ pains: ['doigts'], createdAt: now.getTime() - 20 * HOUR }),
      checkin({ pains: ['doigts'], createdAt: now.getTime() - 44 * HOUR }),
      checkin({ pains: ['avant_bras'], createdAt: now.getTime() - 68 * HOUR }),
    ]), now);
    expect(v.state).toBe('bloque');
    expect(v.alerts.some((a) => a.id === 'pains3')).toBe(true);
  });

  it('2 échecs 6c consécutifs le mardi → attention + fail6c', () => {
    const ses = [seance('intensite', now.getTime() - 7 * 24 * HOUR)];
    const vs = [voie(-8 * MIN, '6c', 'fin', 'force', ses[0].id), voie(-1 * MIN, '6c', 'milieu', 'force', ses[0].id)];
    const v = evaluateSurmenage(U([checkin()], ses, vs), now);
    expect(v.state).toBe('attention');
    expect(v.alerts.some((a) => a.id === 'fail6c')).toBe(true);
  });

  it('récupération entre voies +8 min la semaine dernière → bloque', () => {
    const s1 = seance('intensite', now.getTime() - 14 * 24 * HOUR);
    const s2 = seance('intensite', now.getTime() - 7 * 24 * HOUR);
    const v14 = [
      voie(0, '6b', 'top', undefined, s1.id),
      voie(10 * MIN, '6b', 'top', undefined, s1.id),
      voie(20 * MIN, '6b', 'top', undefined, s1.id),
      voie(-40 * MIN, '6b', 'top', undefined, s2.id),
      voie(-22 * MIN, '6b', 'fin', 'souffle', s2.id), // 18 min d'écart
      voie(-4 * MIN, '6b', 'top', undefined, s2.id),
    ];
    const v = evaluateSurmenage(U([checkin()], [s1, s2], v14), now);
    expect(v.alerts.some((a) => a.id === 'restDelta')).toBe(true);
    expect(v.state).toBe('bloque');
  });

  it('énergie épuisée + séance < 48h → repos actif', () => {
    const ses = [seance('volume', now.getTime() - 20 * HOUR)];
    const v = evaluateSurmenage(U([checkin({ energy: 1 })], ses, []), now);
    expect(v.state).toBe('repos_actif');
  });

  it('rien à signaler → ok', () => {
    const v = evaluateSurmenage(U([checkin()], [], []), now);
    expect(v.state).toBe('ok');
  });
});

describe('readiness', () => {
  it('baisse >20% → drop', () => {
    const ra = readinessAssessment([rd(100, 20, -4 * 7 * 24 * HOUR), rd(100, 20, -3 * 7 * 24 * HOUR), rd(80, 14, now.getTime())]);
    expect(ra.drop).toBe(true);
  });
  it('stabilité → nominal', () => {
    const ra = readinessAssessment([rd(100, 20, -4 * 7 * 24 * HOUR), rd(100, 20, -3 * 7 * 24 * HOUR), rd(97, 19, now.getTime())]);
    expect(ra.drop).toBe(false);
  });
  it('porte 7a : 3 tops 6c le mardi en 4 semaines + stable', () => {
    const ses = new Array(3).fill(null).map((_, i) => seance('intensite', now.getTime() - (i + 1) * 7 * 24 * HOUR));
    const vs = ses.map((s, i) => voie(-(i + 1) * 7 * 24 * HOUR, '6c', 'top', undefined, s.id));
    const gpt = {
      seances: ses, voies: vs,
      readiness: [rd(100, 20, -4 * 7 * 24 * HOUR), rd(100, 20, -3 * 7 * 24 * HOUR), rd(97, 19, now.getTime())],
    };
    const g = ready7a(gpt, now, evaluateSurmenage(U([checkin()], ses, vs), now));
    expect(g.ready).toBe(true);
    // 2 tops seulement → pas prêt
    expect(ready7a({ ...gpt, voies: vs.slice(0, 2) }, now, evaluateSurmenage(U([], ses, vs.slice(0, 2)), now)).ready).toBe(false);
  });
});

describe('générateur de séances', () => {
  const ctx = (over: Partial<Parameters<typeof generateSeance>[0]> = {}) => ({
    type: 'intensite' as const, location: 'club' as const, energy: 3 as const, intent: 'standard' as const,
    readinessDrop: false, fail6c: false, mardiIntense: false, focus: 'devers' as const,
    focusAutre: 'dalle' as const, liberation: false, gate7a: false, maisonSeries: 3, ...over,
  });

  it('mardi fort + porte 7a + énergie 4 → projet 7a', () => {
    const g = generateSeance(ctx({ energy: 4, gate7a: true, intent: 'renforcer' }));
    expect(g.type).toBe('intensite');
    expect(g.blocs.some((b) => b.niveau === '7a')).toBe(true);
  });
  it('mardi énergie 3 → 6c + 6b+', () => {
    const g = generateSeance(ctx());
    expect(g.blocs.some((b) => b.niveau === '6c')).toBe(true);
    expect(g.blocs.some((b) => b.niveau === '6b+')).toBe(true);
  });
  it('readiness en baisse → intensité −20% (1 seul essai chrono + volume facile)', () => {
    const g = generateSeance(ctx({ readinessDrop: true }));
    expect(g.note).toContain('20%');
    expect(g.blocs.filter((b) => b.niveau === '6c').length).toBe(1);
  });
  it('2 échecs 6c consécutifs → bascule volume 6b, plus aucun 6c/7a', () => {
    const g = generateSeance(ctx({ fail6c: true }));
    expect(g.type).toBe('volume');
    expect(g.blocs.some((b) => b.niveau === '6c' || b.niveau === '7a')).toBe(false);
  });
  it('forme épuisée (energy ≤ 2) → mode volume', () => {
    const g = generateSeance(ctx({ energy: 1 }));
    expect(g.type).toBe('volume');
    expect(g.note).toContain('volume');
  });
  it('mardi intense → jeudi limité à 7 voies, pas de 6c', () => {
    const g = generateSeance(ctx({ type: 'volume', mardiIntense: true }));
    expect(g.blocs.some((b) => b.niveau === '6c')).toBe(false);
    expect(g.note).toContain('Mardi était intense');
    expect(g.note).toContain('7 voies');
  });
  it('mardi facile → 9 voies + 6c test fatigue', () => {
    const g = generateSeance(ctx({ type: 'volume' }));
    expect(g.blocs.some((b) => b.niveau === '6c')).toBe(true);
    expect(g.note).toContain('9 voies');
  });
  it('maison → plan poutre/anneaux, club → 2h mur', () => {
    expect(generateSeance(ctx({ location: 'maison' })).blocs.some((b) => b.titre.toLowerCase().includes('anneaux'))).toBe(true);
    expect(generateSeance(ctx({ location: 'repos_force' })).note).toContain('mobilité');
  });
  it('maison : séries du jour = maisonSeriesFor', () => {
    const g = generateSeance(ctx({ location: 'maison', maisonSeries: 2 }));
    expect(g.blocs.some((b) => b.detail.includes('2 × 8 tractions'))).toBe(true);
    expect(g.note).toContain('on allège');
  });
});

describe('ressenti des exos maison → séries suivantes', () => {
  const blocs = (ressentis: Array<'facile' | 'moyen' | 'dur'>) =>
    ressentis.map((ressenti, i) => ({ id: `b${i}`, titre: 'exo', detail: '', restMin: 0, done: true, ressenti }));
  const maison = (ressentis: Array<'facile' | 'moyen' | 'dur'>, createdAt: number) => {
    const ck = checkin({ id: ++sid, location: 'maison', createdAt });
    return { ck, s: { id: ++sid, date: '2026-06-04', type: 'volume' as const, checkinId: ck.id, blocs: blocs(ressentis), createdAt } };
  };

  it('2 exos durs → 2 séries', () => {
    const { s } = maison(['dur', 'dur', 'moyen'], now.getTime() - HOUR);
    expect(maisonSeriesFor([s], [checkin({ id: s.checkinId, location: 'maison' })])).toBe(2);
  });
  it('2 exos faciles sans dur → 4 séries', () => {
    const { s, ck } = maison(['facile', 'facile', 'moyen'], now.getTime() - HOUR);
    expect(maisonSeriesFor([s], [ck])).toBe(4);
  });
  it('pas de séance maison / rien de noté → 3 séries', () => {
    expect(maisonSeriesFor([], [])).toBe(3);
    const ck = checkin({ id: ++sid, location: 'club' });
    const s = { id: ++sid, date: '2026-06-04', type: 'volume' as const, checkinId: ck.id, blocs: blocs(['dur', 'dur']), createdAt: now.getTime() };
    expect(maisonSeriesFor([s], [ck])).toBe(3);
  });
  it('seule la dernière séance maison compte', () => {
    const old = maison(['dur', 'dur'], now.getTime() - 3 * 24 * HOUR);
    const recent = maison(['facile', 'facile'], now.getTime() - HOUR);
    expect(maisonSeriesFor([old.s, recent.s], [old.ck, recent.ck])).toBe(4);
  });
});

describe('analyse des causes', () => {
  it('jauges : les échecs souffle tirent l\'endurance vers le bas', () => {
    const g = gauges([voie(0, '6b', 'fin', 'souffle'), voie(1, '6b', 'fin', 'souffle'), voie(2, '6b', 'fin', 'force'), voie(3, '6b', 'top')]);
    expect(g.endurance.score).toBeLessThan(g.force.score!);
  });
  it('3 chutes en fin de voie → prescription endurance', () => {
    const vs = new Array(3).fill(null).map(() => voie(0, '6b', 'fin', 'souffle'));
    expect(analyses(vs).some((p) => p.deficit === 'endurance')).toBe(true);
  });
  it('2 chutes en milieu sur dévers → lock-off', () => {
    const vs = [voie(0, '6b', 'milieu', 'force'), voie(1, '6b', 'milieu', 'doigts')];
    expect(analyses(vs).some((p) => p.deficit === 'lockoff')).toBe(true);
  });
  it('micro-workouts prescrits par cause', () => {
    const txt = (c: Parameters<typeof microWorkout>[0]) => microWorkout(c).map((b) => b.titre + ' ' + b.detail).join(' ');
    expect(txt('force')).toContain('Lock-offs');
    expect(txt('technique')).toContain('silent');
    expect(txt('mental')).toContain('4-7-8');
    expect(txt('souffle')).toContain('Corde');
  });
  it('lastMardiIntense : détection essais 6c sur séance intensité', () => {
    const ses = [seance('intensite', now.getTime() - 2 * HOUR)]; // mardi même jour
    const vs = [voie(-10 * MIN, '6c', 'fin', 'force', ses[0].id)];
    expect(lastMardiIntense(U([checkin()], ses, vs), now)).toBe(true);
    expect(lastMardiIntense(U([checkin()], ses, []), now)).toBe(false);
  });
});
