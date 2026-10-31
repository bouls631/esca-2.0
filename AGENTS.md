# AGENTS.md — Guide pour la prochaine session agent (OpenCode)

## Qu'est-ce que ce repo

**Coach Voie** — PWA coach préventif/adaptatif pour un grimpeur 6a-6b → 7a (voie, 2 séances/sem).
Calendrier fixe : **mardi = intensité/voie max**, **jeudi = volume/endurance**.
Matos : club = mur 36 relais (max 5-6 voies, max 2× 6c) ; maison = poutre verticale, anneaux, corde à sauter, PAS de campus.

## Commandes

```bash
npm install       # installe (warning allow-scripts esbuild normal ; le build se fait quand même)
npm run dev       # localhost:5173
npm test          # 23 tests vitest (logique métier pure dans src/lib/)
npm run build     # tsc --noEmit && vite build (strict, zéro erreur exigée)
npm run icons     # regénère public/icons/*.png si un jour on change le logo (script sans dépendance)
```

## Déploiement (fragile — à connaître absolument)

- Déploiement = **GitHub Pages via le workflow `.github/workflows/pages.yml`** (build + 23 tests + deploy-pages).
- ⚠ **Settings → Pages → Source doit rester "GitHub Actions"**. Si l'utilisateur repasse en "Deploy from a branch",
  GitHub sert à nouveau le repo brut (index.html source non transpilé, page blanche, pas de SW).
  Symptôme : https://bouls631.github.io/esca-2.0/ sert `<script src="/src/main.tsx">`.
- En CI, `vite.base` devient automatiquement `/esca-2.0/` grâce à `process.env.GITHUB_ACTIONS` dans vite.config.ts.
  Ne pas mettre le base en dur ; en local il est déjà `/`.
- Tester après deploy : `GET /esca-2.0/manifest.webmanifest` doit répondre 200 et `GET /esca-2.0/assets/index-*.js` aussi.

## Structure & règles métier (ne pas bifurquer)

- `src/lib/types.ts` = source de vérité des unions + libellés FR (UI n'invente pas de libellés).
- Logique métier **100 % pure** dans `src/lib/` (surmenage, readiness, generator, analyse-causes, cycles) → tests dans `tests/lib.test.ts`. Pas d'algo caché dans les composants.
- Données : Dexie (`src/db.ts`), tables `profile / checkins / seances / voies / readiness`. Tout local, export JSON dans Stats.
- Séance "mardi intense" = essais 6c/7a loggés → calibre le volume du jeudi (4 voies, pas de 6c).
- Porte 7a : 3 tops 6c le mardi en 4 semaines + readiness stable + pas de blocage 14 j.
- Readiness : baisse >20 % vs moyenne des 4 tests précédents → intensité −20 %.
- Override « J'assume le risque » : toujours possible, **majudra** noté (`checkin.override: true`, marqué ⚠ dans Stats).

## Pièges découverts (à ne PAS re-casser)

1. **Sentinelle -Infinity** : latest-activity dans surmenage.ts utilise `Math.max` avec `-Infinity`. `Math.max(Infinity, x)` renverrait Infinity (bug existant pendant 1 session).
2. **dexie-react-hooks v1.1.7** : appeler `useLiveQuery<AppData, null>(querier, [], null)` (2 generics sinon union `{} | undefined` qui ne narrow pas).
3. **TS strict + `verbatimModuleSyntax`** : imports de types obligatoirement `import type`. `AppData` vit dans `App.tsx` (import type-only circulaire OK).
4. **passé d'essais dans tests** : le helper `voie(..., seanceId)` avale un `undefined` explicite (default s'applique) → passer un vrai id de fixture `seance()` (= objet avec `id: ++sid`).
5. **JSX et `>`** : jamais `>20%` en texte JSX brut → TS1382. Écrire `≥20%` ou `{'>'}`.
6. ** Αν ανθρώπος write/overwrite accidentels** : plusieurs write ont écrasé des fichiers entiers (analyse-causes.ts). Après un doute, relire le fichier avant de continuer.
7. restDelta : il faut **≥3 voies par séance d'intensité** (2 intervalles) pour déclencher l'alerte récupération — sinon silent (by design).
8. Règle douleurs = **3 derniers check-ins** avec douleur (pas 3 jours calendaires : le check-in n'existe que mardi/jeudi) — documenté dans README.
9. Testé pour Windows : `git push` écrit son progrès sur stderr → PowerShell affiche "NativeCommandError" alors que le push a réussi (`.. .. main -> main`). Vérifier le ref, pas le code de sortie.

## Backlog « on verra avec le temps »

- Import JSON (rétro-complément de l'export) — pour changer de téléphone.
- Mini check douleur quotidien (1 champ) pour exactifier la règle « 3 jours de suite ».
- Guided warmup : chaînage auto des blocs avec timer prérempli du restMin du bloc suivant.
- Notifications locales optionnelles mardi/jeudi (refusées en V1 du user).
- Catalogue des 36 relais si l'utilisateur y tient un jour (refusé en V1 : suggestions par profil seulement).
- Mode bêta : basculer mardi/jeudi (refusé en V1 : calendrier fixe assumé).

## État au 31/10/2026

- App 100 % fonctionnelle en ligne : https://bouls631.github.io/esca-2.0/
- Dernier commit utile : `e47229e` (fonctionnel complet) + `273e474` (re-déploiement, vide).
- Aucune donnée utilisateur à préserver côté repo (données 100 % IndexedDB sur le téléphone).
