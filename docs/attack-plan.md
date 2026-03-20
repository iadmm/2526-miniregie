# MiniRégie TV — Plan d'attaque

> Référence : `docs/miniregie-specs-session-2.md` fait autorité sur tout ce qu'il couvre.
> Mémoire projet : `/Users/julienmoreau/.claude/projects/-Users-julienmoreau-code-iad-miniregie-scaffold/memory/MEMORY.md`

---

## Étape 1 — Alignement types & schéma DB

**Objectif :** Mettre `shared/types.ts` et `db/schema.ts` en accord avec session 2, sans toucher à l'architecture author FK.

**Fichiers à modifier :**

- `shared/types.ts`
  - Ajouter `queuePosition: number | null` sur `MediaItem`
  - Ajouter `'replayed'` dans `MediaEventType`
  - `MediaStatus` : vérifier que `'played'` existe (items diffusés)
  - Supprimer `priority`, `pinned`, `displayCount`, `skippedCount`, `lastDisplayedAt` si présents sur l'interface `MediaItem` (les garder en DB pour l'ordre de la queue, mais pas dans l'interface publique)

- `db/schema.ts`
  - Ajouter colonne `queue_position INTEGER` sur `media_items`

- `db/queries.ts`
  - Mettre à jour les queries qui lisent `media_items` pour inclure `queue_position`
  - Vérifier que le JOIN author fonctionne bien partout

- Générer + appliquer la migration Drizzle : `npm run db:generate && npm run db:migrate`

**Contraintes :**
- Author reste FK → participants (pas de snapshot)

---

## Étape 2 — Pool API session 2

**Objectif :** Ajouter les nouvelles méthodes pool + règle enrich-link-dedup. TDD obligatoire.

**Fichiers à créer/modifier :**

- `server/src/pool/index.ts` — Ajouter :
  - `pool.getMain(filters?)` → `MediaItem[]` : items `status='ready'` avec `queue_position IS NOT NULL`, triés par position. Filtre optionnel `{ excludeTypes?, types? }`
  - `pool.getPlayed(filters?)` → `MediaItem[]` : items `status='played'`, triés par `lastDisplayedAt DESC` (ou `submittedAt DESC`)
  - `pool.getItems(filters)` → `MediaItem[]` : union ready (main + played), filtre `{ types?, submittedAfter?, sort? }`
  - `pool.reorder(ids: string[])` → `void` : réassigne `queue_position` selon l'ordre du tableau. `ids` doit contenir exactement les ids de queue.main.
  - `pool.replay(id: string)` → `void` : déplace item `played → fin de queue.main`, écrit `MediaEvent 'replayed'`

- `server/src/db/queries.ts` — Queries correspondantes pour getMain, getPlayed, reorder, replay

- `server/src/pool/enrich.ts` (ou dans resolve.ts) — Règle `enrich-link-dedup` :
  - Si même `content.url` déjà dans queue.main ou queue.played → placer l'item en fin de queue plutôt qu'en position FIFO normale

- `server/src/pool/pool.test.ts` (nouveau) — Tests Vitest pour chaque nouvelle méthode

**Contraintes :**
- `getMain()` lecture non-destructive
- `reorder()` : rejeter si ids ne correspond pas exactement à queue.main
- `replay()` : ajoute en fin (dernière position)
- `pool.nextItem()` (pas supprimés — décision projet)

---

## Étape 3 — Routes API admin (pool actions)

**Objectif :** Exposer les nouvelles méthodes pool via HTTP.

**Fichiers à modifier :**

- `server/src/routes/api.ts` — Ajouter :
  - `GET  /api/queue/main` → `pool.getMain()`
  - `GET  /api/queue/played` → `pool.getPlayed()`
  - `POST /api/queue/reorder` body `{ ids: string[] }` → `pool.reorder(ids)`
  - `POST /api/queue/:id/replay` → `pool.replay(id)`

- Tests de routes (fichier existant ou nouveau `queue.test.ts`)

**Contraintes :**
- Routes protégées par middleware auth admin
- Répondre 400 si `ids` malformé pour reorder

---

## Étape 4 — jam-mode client refactor

**Objectif :** Implémenter l'architecture session 2 côté broadcast client (vanilla JS, BEM, zero framework).

**Référence :** `docs/miniregie-specs-session-2.md` sections 2 à 10.

**Architecture cible :**

```
<body>
  <div id="panic-layer">        z-index max, display:none nominal
  <div id="identity-layer">     QR code — fixe
  <div id="clock-layer">        ClockEngine
  <div id="lower-third-layer">  LowerThirdEngine
  <div id="scene-layer">        SceneEngine
</body>
```

**Fichiers à créer/réécrire :**

- `client/broadcast/src/apps/jam-mode/scene-compositor.ts`
  - Orchestre SceneEngine + LowerThirdEngine + ClockEngine
  - Gère `onPoolUpdate`, `onSceneEnd`, `onCompanionEnd`, `onAdminSkip`, `onTimeUpdate`
  - Implémente `composeNextScene()`, régimes normal/hold, buffer slot

- `client/broadcast/src/apps/jam-mode/scene-engine.ts`
  - Deux timers indépendants : sceneTimer (primary) + companionTimer
  - best-fit layout selon section 3.4
  - Recomposition CSS flex ratio (300ms ease-in-out)
  - YouTube singleton (jamais détruit)
  - Anti-thrashing : grace period 800ms, prefetch 2000ms avant fin

- `client/broadcast/src/apps/jam-mode/lower-third-engine.ts`
  - Attribution band : slide-in → hold 6s → slide-out, primary uniquement
  - Ticker band : round-robin sur items `ticker` de queue.main
  - Breaking news mode si `content.label` non-null (hauteur ~15%)

- `client/broadcast/src/apps/jam-mode/clock-engine.ts`
  - Piloté par `GlobalState.jam.timeRemaining`
  - T>2h : compact coin haut-droit
  - T≤2h : grossit progressivement
  - T≤1h : dominant ~30% écran, Commit Mono
  - T≤10min : plein écran rouge #dc2626, clock-layer au-dessus de scene-layer

- `client/broadcast/src/apps/jam-mode/engine-config.ts`
  ```javascript
  ENGINE_CONFIG = {
    DURATIONS: {
      photo:  { normal: 20_000, extended: 45_000 },
      gif:    { normal: 20_000, extended: 45_000 },
      clip:   { normal: 20_000, extended: 45_000 },
      note:   { normal: 12_000, extended: 30_000 },
    },
    COMPANION_DURATIONS: { photo: 20_000, gif: 20_000, clip: 20_000, note: 12_000 },
    BUFFER_EVERY: 5,
    BUFFER_DURATION: 12_000,
    GRACE_PERIOD: 800,
    PREFETCH_LEAD: 2_000,
    MIN_SCENE_DURATION: 4_000,
    ATTRIBUTION_HOLD: 6_000,
  }
  ```

- `client/broadcast/src/apps/jam-mode.ts` — Point d'entrée, monte les engines, délègue tout au SceneCompositor

**Layouts à rendre (CSS BEM) :**
- `IDLE` — countdown centré, pas de scène
- `MEDIA_FULL` — youtube 100%
- `MEDIA_WITH_VISUAL` — youtube 60% + photo/gif/clip 40%
- `MEDIA_WITH_CAPTION` — youtube + note en bande basse
- `VISUAL_FULL` — photo/gif/clip 100%
- `VISUAL_WITH_CAPTION` — photo/gif/clip + note en bande basse
- `NOTE_CARD` — note centré sur fond coloré, typo large

**Contraintes :**
- Vanilla JS uniquement, BEM, zero framework
- YouTube : même instance player, jamais détruite entre scènes
- Companion interrompu par sceneEnd → reste dans queue.main, pas de markDisplayed
- `fetchNext()` null → toujours `setTimeout(fetchNext, 2000)`, jamais dead end
- Flag `mounted` pour couper les callbacks async après unmount

---

## Étape 5 — Admin UI session 2

**Objectif :** Donner à l'admin la visibilité et les actions définies en section 9.

**Référence :** `docs/miniregie-specs-session-2.md` section 9.

**Fichiers à modifier (Svelte 5) :**

- `client/admin/src/components/QueuePanel.svelte` (existant)
  - Vue **Queue principale** : liste positionnelle avec drag & drop → `POST /api/queue/reorder`
  - Vue **Queue played** : liste avec bouton `[Remettre]` → `POST /api/queue/:id/replay`
  - Onglets Main / Played

- `client/admin/src/components/` — Nouveau composant ou panel **En cours** :
  - Affiche : PRIMARY (type, titre, auteur, équipe, temps), COMPANION, LAYOUT, RÉGIME
  - Boutons : `[Skip scène]` → `markSkipped(primary)`, `[Evict]`
  - Source : `GlobalState.broadcast.activeItemIds + regime`

- `client/admin/src/components/` — Vue **Coup d'œil** (téléphone) :
  - 5 indicateurs binaires vert/rouge (écrans connectés, app active, queue <3, soumission >30min, disque >80%)
  - Responsive, lisible à 3h du matin

- `client/admin/src/lib/api.ts` — Ajouter appels reorder et replay

**Contraintes :**
- Drag & drop natif HTML5 ou bibliothèque légère compatible Svelte 5
- Sync temps réel : les queues se mettent à jour via Socket.io `state`
- Pas de confirmation modale pour replay — action directe

---

## Étape 6 — CSS broadcast polish

**Objectif :** Qualité TV réelle. Référence visuelle : Blackmagic Design / DaVinci Resolve.

**Fichiers à modifier :**

- `client/broadcast/src/css/` — Lightning CSS, BEM strict

  - Layouts : transitions flex ratio 300ms ease-in-out
  - Attribution band : slide-in depuis le bas, hold, slide-out vers le bas
  - Ticker : scroll CSS pur droite → gauche, vitesse configurable
  - Breaking news : animation d'entrée, hauteur ~15%
  - Clock : transition CSS sur font-size et position, rouge #dc2626 à T-10min
  - NOTE_CARD : fond coloré (palette à définir), Commit Mono, centré
  - Companion inline attribution : fond semi-transparent, coin bas-droit

- `client/admin/src/` — Svelte styles cohérents (dark, tons neutres, accents verts/rouges)

**Contraintes :**
- Pas de gradients bon marché, pas d'opacity stacking, pas de box-shadow décoratifs
- Une seule couleur explicite pour les états inactifs
- Commit Mono pour countdown et clock

---

## Étape 7 — NarratorEngine *(si temps)*

**Référence :** `docs/narrator-layer.md`

- `server/src/narrator/index.ts`
- Modes : scheduled, reactive, behavioral
- `participantId: 'system:narrator'`
- Injection items dans queue.main via `pool.addDirectItem()`

---

## Étape 8 — Tests E2E Playwright *(si temps)*

- Flux soumission participant → item dans queue → diffusion
- Transitions JAM (idle → running → ended)
- Panic button (synchrone)
- Drag & drop reorder admin
