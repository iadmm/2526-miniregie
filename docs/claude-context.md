# MiniRégie TV — Contexte projet pour Claude Code

> À fournir en début de session. Ce document remplace tout briefing verbal.

---

## Ce qu'est ce projet

**MiniRégie TV** est un système de broadcast overlay pour **JAM Multimédia**, un événement étudiant 48h à l'IAD Louvain-la-Neuve. Le système simule une chaîne TV en direct : il orchestre les soumissions des participants (photos, notes, vidéos YouTube) et les affiche sur des écrans pendant l'événement.

Trois clients distincts :
- **Broadcast SPA** — l'écran TV, affiché en continu sur des moniteurs en kiosk mode Chrome
- **Admin** — interface de contrôle pour l'organisateur
- **`/go`** — formulaire smartphone pour les participants

Le système doit tourner **sans surveillance pendant 48h**. La fiabilité prime sur tout.

---

## Stack technique — décisions finales

```
Runtime         Node.js 22+ (ESM natif, --experimental-strip-types en dev)
Serveur         Express + Socket.io
Base de données better-sqlite3 (synchrone, WAL mode, zéro process externe)
Auth            OAuth Google — vanilla fetch, aucune lib OAuth
Uploads         multer → filesystem local
Session         cookie signé avec crypto.createHmac (Node natif)
Build serveur   esbuild
Build broadcast esbuild + lightningcss (vanilla JS, BEM)
Build admin     Vite + Svelte 5
Build /go       Vite + Svelte 5 + vite-plugin-pwa
Tests unitaires Vitest 4
Tests E2E       Playwright
Lint/Format     Biome 2 (remplace ESLint + Prettier)
TypeScript      strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
```

**Ce qui n'existe pas dans ce projet :**
- Pas de PocketBase, pas de Knex, pas de Passport, pas d'ORM
- Pas de workspaces npm — un seul `package.json` à la racine
- Pas de framework côté broadcast SPA (vanilla JS uniquement, sans exception)
- Pas de CommonJS — ESM partout
- Pas de Microsoft OAuth, pas de Vercel, pas de IBM Plex

---

## Structure des fichiers

```
package.json          ← unique, à la racine
tsconfig.json         ← root, strict ESM
biome.json            ← lint + format
vitest.config.ts      ← node (server) + jsdom (clients)
playwright.config.ts  ← E2E, port 3000

server/
  tsconfig.json       ← hérite du root
  src/
    index.ts          ← entry point Express + Socket.io
    pool/             ← PoolManager
    broadcast/        ← BroadcastManager
    apps/             ← une app par fichier (pre-jam-idle, jam-mode, etc.)
    narrator/         ← NarratorEngine
    routes/           ← Express routes (/api, /auth, /go)
    db/               ← schema.sql + queries.ts + migrations
    scheduler/        ← évaluation LimitTriggers

client/
  broadcast/          ← SPA vanilla JS
    src/main.ts       ← entry point esbuild
    css/main.css      ← entry point lightningcss
    scripts/
      build.js        ← script esbuild (run depuis la racine)
      css.js          ← script lightningcss (run depuis la racine)
    dist/
      index.html      ← shell HTML statique
  admin/
    vite.config.ts
    src/              ← composants Svelte
  go/
    vite.config.ts    ← inclut PWA manifest
    src/              ← composants Svelte

shared/
  types.ts            ← TOUTES les interfaces TypeScript partagées

config/
  schedule.json       ← planning d'apps (versionné)
  roles.json          ← rôles onboarding /go (versionné)

e2e/                  ← tests Playwright

state.json            ← runtime, gitignore, persisté toutes les 30s
```

---

## Scripts npm disponibles

```bash
npm run dev              # lance tout en parallèle (concurrently)
npm run dev:server       # node --watch server/src/index.ts
npm run dev:broadcast    # esbuild + lightningcss en watch
npm run dev:admin        # vite port 3001
npm run dev:go           # vite port 3002

npm test                 # vitest run
npm run test:watch       # vitest
npm run test:e2e         # playwright

npm run check            # biome check
npm run format           # biome format --write
```

Ports en dev : `3000` (serveur + broadcast), `3001` (admin), `3002` (/go).

---

## Interfaces TypeScript — `shared/types.ts`

Ce fichier est la source de vérité de tout le projet. Toute modification d'une interface se fait ici, nulle part ailleurs.

Interfaces principales :
- `MediaItem` — contenu soumis par un participant
- `MediaContent` — union type par `MediaType`
- `MediaEvent` — journal exhaustif (displayed, skipped, held, pinned, evicted, enriched)
- `Participant` — utilisateur OAuth Google
- `GlobalState` — état broadcasté via Socket.io à tous les clients
- `App` — contrat d'interface de toutes les apps broadcast
- `MarketTrigger` / `LimitTrigger` — déclencheurs du scheduler
- `BroadcastEvent` — caisse noire persistée en SQLite

---

## Architecture — principes fondamentaux

### Pool Manager (`server/src/pool/`)
Source de vérité unique pour le contenu. Il ne sait pas ce qui s'affiche.

- Le score n'est **jamais stocké** — calculé à la volée à chaque `nextItem()`
- Formule : `priority + freshnessScore - (displayedCount × 40) - (skippedCount × 120)`
- Cooldown 5min : filtre dur dans `nextItem()`, pas un malus dans le score
- Pipeline ingestion : SANITIZE → GUARD → `pending` (synchrone, répond immédiatement) → RESOLVE → ENRICH → `ready` (asynchrone)
- Items `ticker` exclus de `nextItem()` par défaut

### Broadcast Manager (`server/src/broadcast/`)
Chef d'orchestre. Ne connaît pas le contenu des apps.

- Deux slots DOM : `#slot-fg` (visible) et `#slot-bg` (invisible, chargement)
- Cycle de vie app : `load(signal)` → `signalReady()` → `play()` → `stop()` → `remove()`
- Double couche de sécurité destruction : AbortController + `innerHTML = ''` synchrone
- Bloc `try/finally` : `remove()` → `controller.abort()` → `slot.innerHTML = ''` → `slot = null`
- Timeouts : 2s pour `signalReady()`, 1s pour `stop()` — force la transition après expiration
- Panic state : `panic-layer` en `display: block` synchrone, aucune animation

### Apps (`server/src/apps/`)
Toutes les apps implémentent l'interface `App` de `shared/types.ts`.

```typescript
interface App {
  readonly id: string
  readonly outroMode: 'sequential' | 'concurrent' | 'none'
  load(signal: AbortSignal): void
  play(): void
  stop(): Promise<void>
  remove(): void
  onPoolUpdate(item: MediaItem): void
}
```

**Règle absolue** : tout `addEventListener` dans `load()` porte `{ signal }`. Tout `setTimeout`/`setInterval` est annulé dans `remove()`.

### Broadcast SPA (`client/broadcast/`)
Vanilla JS uniquement — aucun framework, sans exception. Le BroadcastManager a besoin d'un contrôle synchrone du DOM incompatible avec tout cycle de rendu.

Trois couches DOM racines, jamais modifiées après `DOMContentLoaded` :
```html
<div id="app-layer">         <!-- #slot-fg + #slot-bg -->
<div id="persistent-layer">  <!-- QR code, countdown JAM -->
<div id="panic-layer">       <!-- display:none par défaut -->
```

Watchdog heartbeat — protection contre freeze silencieux :
```javascript
// Serveur émet 'ping' toutes les 10s
// Client reload si pas de ping depuis 30s
```

### GlobalState — Socket.io
Émis à chaque mutation. `timeRemaining` seul est émis en continu toutes les secondes.
À chaque connexion Socket.io, le serveur émet immédiatement le GlobalState complet.

---

## Risques prioritaires — protections non négociables

**Freeze écran :**
- Timeout 1s sur `stop()` — force la transition, jamais bloqué en `in_progress`
- Tout `catch` dans la boucle principale de `jam-mode` appelle `broadcast.panic()`
- Watchdog heartbeat côté client broadcast — reload après 30s sans ping

**Contenu qui ne s'affiche pas :**
- YouTube : watchdog 8s après activation — si pas `PLAYING` → `markSkipped()` + `fetchNext()`
- `fetchNext()` retournant `null` → toujours `setTimeout(fetchNext, 2000)`, jamais de dead end
- Pool vide → régime hold (item courant reste à l'écran), interrompu dès `onPoolUpdate()`

**DOM instable sur 48h :**
- Après chaque `innerHTML = ''` : `slot.removeAttribute('style')` + `slot.className = ''`
- Toute classe posée hors du slot dans `play()` doit être retirée dans `remove()`

**Double audio YouTube :**
- Player YouTube = singleton dans `jam-mode`, jamais recréé entre deux layouts
- Séquence `remove()` : `mounted = false` → `stopVideo()` → `iframe.src = 'about:blank'` → `destroy()` → `null`
- Flag `mounted` coupe tous les callbacks `onStateChange` asynchrones après destruction
- Aucun YouTube ne démarre dans `load()` — uniquement dans `play()`

---

## Base de données — SQLite

Quatre tables : `media_items`, `media_events`, `broadcast_events`, `participants`.

```typescript
// db/index.ts
const db = new Database('miniregie.db')
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
applyMigrations(db)  // schema.sql versionné
export default db
```

Requêtes dans `db/queries.ts` — SQL explicite, jamais d'ORM.
`displayedCount` et `skippedCount` sont calculés à la volée depuis `media_events`, jamais stockés sur `media_items`.

---

## Auth OAuth Google — vanilla fetch

Quatre étapes, ~60 lignes, dans `server/src/routes/auth.ts` :
1. `GET /auth/google` → génère `state` CSRF (`crypto.randomUUID()`), redirige vers Google
2. `GET /auth/google/callback` → échange `code` contre access token
3. Appel `userinfo` → email, displayName, avatarUrl
4. `participants.upsert()` → cookie signé `crypto.createHmac`, session 48h

Identifiants système réservés : `system:admin`, `system:narrator` (exemptés du Guard JAM et du rate limit).

---

## Approche TDD

**Red → Green → Refactor.** Tests écrits avant le code. On teste inputs/outputs, jamais les détails d'implémentation.

Modules prioritaires pour TDD (Vitest) :
- `server/src/pool/scoring.test.ts` — formule de score, cas limites freshnessScore
- `server/src/pool/sanitize.test.ts` — validation par type, cas d'erreur
- `server/src/pool/guard.test.ts` — rate limit, statut JAM, exemptions admin
- `server/src/broadcast/jam-state.test.ts` — transitions autorisées/interdites
- `server/src/broadcast/triggers.test.ts` — résolution H+, T-, absolute
- `server/src/apps/jam-mode/layout-engine.test.ts` — 9 combinaisons activeItems → LayoutName

Tests E2E Playwright (`e2e/`) : walking skeleton, flow soumission /go, watchdog heartbeat.

---

## Planning d'apps — `config/schedule.json`

```json
[
  { "at": "JAM_START",            "app": "countdown-to-jam" },
  { "at": "H+00:10:00",           "app": "jam-mode" },
  { "at": "H+12:00:00",           "app": "micro-trottoir" },
  { "at": "H+30:00:00",           "app": "micro-trottoir" },
  { "at": "T-04:00:00",           "app": "micro-trottoir" },
  { "at": "T-01:00:00",           "trigger": "warning" },
  { "at": "JAM_END",              "app": "end-of-countdown" },
  { "at": "H+00:05:00_after_end", "app": "post-jam-idle" }
]
```

---

## Ce qui est dans le scope MVP

Apps : `pre-jam-idle`, `countdown-to-jam`, `jam-mode`, `end-of-countdown`, `post-jam-idle`, `micro-trottoir`

Types media : `photo`, `gif`, `note`, `clip`, `link`, `youtube`, `interview`, `ticker`

Règles Enrich : `enrich-youtube`, `enrich-giphy`, `gims-replacement`, `youtube-dedup`

NarratorEngine : Scheduled + Reactive (couches T1 uniquement pour le MVP)

## Ce qui est hors scope MVP

Transcodage/resize, modération préalable, proof of play, réconciliation OAuth cross-provider, reprise d'upload interrompue, notification participant après diffusion.
