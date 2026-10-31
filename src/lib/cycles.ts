import { getISOWeek } from 'date-fns';
import type { Profil } from './types';

// Rotation anti-spécialisation sur 4 semaines (cycle ISO).
// Semaine 4 = libération/récupération (profils au choix).
export interface Rotation {
  no: 1 | 2 | 3 | 4;
  mardi: Profil | null;
  jeudi: Profil | null;
  liberation: boolean;
}

const ROTATIONS: Record<number, Rotation> = {
  1: { no: 1, mardi: 'devers', jeudi: 'dalle', liberation: false },
  2: { no: 2, mardi: 'toit', jeudi: 'arete', liberation: false },
  3: { no: 3, mardi: 'diedre', jeudi: 'devers', liberation: false },
  4: { no: 4, mardi: null, jeudi: null, liberation: true },
};

export function rotationFor(d: Date): Rotation {
  const no = ((getISOWeek(d) - 1) % 4) + 1;
  return ROTATIONS[no];
}
