// Récupère les voies montées de la salle RAPPEL (gym 507, space 308)
// Source publique : https://api.oblyk.org/api/embedded/gyms/507/gym_routes.json
// Usage : node scripts/fetch-routes.mjs
import { writeFileSync, mkdirSync } from 'node:fs';

const GYM_ID = 507;
const SPACE_ID = 308;
const BASE = `https://api.oblyk.org/api/embedded/gyms/${GYM_ID}/gym_routes.json`;

async function fetchPage(page) {
  const url = `${BASE}?gym_space_id=${SPACE_ID}&page=${page}&sort=grade`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} page ${page}`);
  return res.json();
}

const all = [];
let page = 1;
for (;;) {
  const json = await fetchPage(page);
  const data = json.data ?? [];
  console.log(`page ${page}: ${data.length} voies`);
  if (data.length === 0) break;
  all.push(...data);
  page += 1;
  if (page > 20) break; // sécurité
}

// L'API embedded filtre déjà sur mounted, on re-vérifie par sécurité
const mounted = all.filter((r) => !r.attributes?.dismounted && !r.attributes?.dismounted_at);

const routes = mounted.map((r) => {
  const a = r.attributes;
  return {
    id: Number(r.id),
    relais: a.anchor_number ?? null,
    secteur: a.gym_sector_name ?? null,
    secteur_id: a.gym_sector_id ?? null,
    cotation: a.grade_to_s ?? a.sections?.[0]?.grade ?? null,
    cotation_val: a.grade_gap?.min_grade_value ?? a.sections?.[0]?.grade_value ?? null,
    couleur: a.hold_colors?.[0] ?? null,
    ouverte_le: a.opened_at ?? null,
    hauteur: a.height ?? null,
    lien: a.app_path ?? `https://oblyk.org/gyms/507/rappel/spaces/308/salle-de-voies?route=${r.id}`,
  };
});

// Tri par cotation croissante (demandé), puis relais
routes.sort((x, y) => (x.cotation_val ?? 999) - (y.cotation_val ?? 999) || (x.relais ?? 999) - (y.relais ?? 999));

mkdirSync('src/data', { recursive: true });
mkdirSync('public', { recursive: true });
writeFileSync('src/data/routes.json', JSON.stringify(routes, null, 2) + '\n');
writeFileSync('public/routes.json', JSON.stringify(routes, null, 2) + '\n');

const grades = [...new Set(routes.map((r) => `${r.cotation} (${r.cotation_val})`))];
console.log(`OK: ${routes.length} voies montees -> src/data/routes.json + public/routes.json`);
console.log('Cots:', grades.join(', '));
