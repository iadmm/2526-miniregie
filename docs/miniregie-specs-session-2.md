# MiniRégie TV — Specs Complémentaires Session 2
> IAD Louvain-la-Neuve · JAM Multimédia 48h · Mars 2026

Amende et complète les fichiers de la session 1. Ce document fait autorité sur tout ce qu'il couvre — les sections correspondantes des fichiers précédents sont caduques.

---

## 1. Pool Manager — modèle FIFO

### 1.1 Principe

Le système de scoring (formule, `freshnessScore`, `displayCount`, `skippedCount`, `priority`) est **supprimé**. Il est remplacé par deux queues positionnelles simples.

**Ce qui disparaît :**
- Formule de score et tous ses paramètres
- Champs `priority` et `pinned` sur `MediaItem`
- `pin()` et son comportement post-diffusion
- Cooldown 5 min par item
- `pool.nextItem()` et `pool.getQueue()` avec scoring
- `MediaEvent` de type `pinned`

### 1.2 Les deux queues

```
QUEUE PRINCIPALE                    QUEUE PLAYED
┌──────────────────────┐            ┌──────────────────────┐
│  1. photo   Léa      │            │  youtube  Marie      │
│  2. note    Karim    │   ──────►  │  photo    Thomas     │
│  3. youtube José     │  diffusion │  note     Sarah      │
│  4. clip    Thomas   │            └──────────────────────┘
│  5. photo   Sarah    │                      │
└──────────────────────┘                      │ admin renvoie
          ▲                                   │ en fin de queue
          └── admin réordonne ────────────────┘
```

**Queue principale** — `queue.main`
- Les items `ready` en attente de diffusion, dans l'ordre de passage
- Nouvelle soumission → ajoutée en fin (FIFO strict)
- Les interviews (`interview`) sont également ajoutées en fin — leur priorité éditoriale est gérée manuellement par l'admin via le réordonnancement
- `jam-mode` consomme toujours `queue.main[0]`

**Queue played** — `queue.played`
- Les items qui ont été affichés au moins une fois
- Ordre d'entrée : chronologique (le plus récemment diffusé en tête)
- L'admin peut renvoyer n'importe quel item en fin de `queue.main`
- `evict` supprime définitivement l'item des deux queues

### 1.3 Modèle MediaItem — version finale

```javascript
MediaItem {
  id            : uuid
  type          : 'photo' | 'gif' | 'note' | 'clip' | 'link' | 'youtube'
                | 'interview' | 'ticker'
  content       : { … }          // selon le type, voir section 1.4
  status        : 'pending' | 'ready' | 'evicted'
  queuePosition : number | null  // position dans queue.main, null si dans played ou evicted
  submittedAt   : timestamp
  author        : {
    participantId : string        // ref Participant.id — remplace fingerprint
    displayName   : string        // snapshot à la soumission
    team          : string
    role          : string
  }
}
```

`priority`, `pinned`, `displayCount`, `skippedCount`, `lastDisplayedAt` sont **supprimés**.

Les identifiants réservés `'system:admin'` et `'system:narrator'` restent valides comme `participantId`.

### 1.4 MediaItem.content — par type

```javascript
// photo, gif
{ url: string, caption: string | null }              // caption ≤ 120 car.

// clip
{ url: string, duration: number, mimeType: string, caption: string | null }

// note
{ text: string }                                     // ≤ 280 car.

// link
{ url: string, title: string | null, description: string | null,
  thumbnail: string | null, siteName: string | null, caption: string | null }

// youtube (après Enrich)
{ url: string, youtubeId: string, title: string,
  duration: number, thumbnail: string, caption: string | null }

// interview
{
  segments: [{
    question  : string,
    video     : string | null,    // chemin local ≤ 60s
    duration  : number | null,
    textOnly  : string | null,    // ≤ 280 car.
    photos    : string[],         // 0–3 chemins locaux
  }],                             // 1 à 5 segments
  subject: {
    type          : 'self' | 'participant' | 'manual',
    participantId : string | null,
    displayName   : string,
    team          : string,
    role          : string,
  }
}

// ticker
{ text: string, label: string | null }   // label null → "▸ JOSÉ", sinon override
```

### 1.5 MediaEvent — version finale

Le `MediaEvent` reste le journal d'audit. Il ne sert plus au scoring.

```javascript
MediaEvent {
  id        : uuid
  itemId    : ref MediaItem
  type      : 'displayed' | 'skipped' | 'held' | 'evicted' | 'enriched' | 'replayed'
  appId     : string | null
  payload   : object | null
  createdAt : timestamp
}
```

| Type | Payload | Déclencheur |
|---|---|---|
| `displayed` | `{ appId }` | Item diffusé, passe dans played |
| `skipped` | `{ appId }` | Skip admin pendant diffusion |
| `held` | `{ duration: ms }` | Sortie du régime hold |
| `evicted` | `{ reason: 'manual' \| 'unresolvable', adminId? }` | Suppression définitive |
| `enriched` | `{ rule: string, originalData: object }` | Règle Enrich déclenchée |
| `replayed` | `{ adminId }` | Renvoi depuis played vers main |

`'post-pin'` disparaît des raisons d'éviction — le pin n'existe plus.

### 1.6 API Pool — version finale

```javascript
// Ingestion
pool.addItem(raw)                    → MediaItem | Error
  // SANITIZE → GUARD → 'pending' → fin de queue.main à status 'ready'

// Lecture positionnelle
pool.getMain(filters?)               → MediaItem[]
  // Retourne queue.main dans l'ordre, filtre optionnel par type
  // Lecture non-destructive

pool.getPlayed(filters?)             → MediaItem[]
  // Retourne queue.played, le plus récent en premier

pool.getItems(filters)               → MediaItem[]
  // Liste filtrée sur l'ensemble ready (main + played), tri configurable
  // Usage : micro-trottoir, admin journal
  // filters { types?, submittedAfter?, sort?: 'submittedAt ASC' | 'DESC' }

// Signalement diffusion
pool.markDisplayed(id, appId)        → void
  // Écrit MediaEvent 'displayed', déplace item : main → played

pool.markSkipped(id, appId)          → void
  // Écrit MediaEvent 'skipped', déplace item : main → played

pool.markHeld(id, appId, ms)         → void
  // Écrit MediaEvent 'held'

// Actions admin
pool.reorder(ids)                    → void
  // Réordonne queue.main selon le tableau d'ids fourni
  // ids doit contenir exactement les mêmes ids que queue.main

pool.replay(id)                      → void
  // Déplace item : played → fin de queue.main
  // Écrit MediaEvent 'replayed'

pool.evict(id, reason)               → void
  // status → 'evicted', suppression des deux queues
  // Écrit MediaEvent 'evicted'
```

`pool.nextItem()`, `pool.pin()`, `pool.getQueue()` sont **supprimés**.

### 1.7 Sélection dans jam-mode

Sans scoring, `jam-mode` lit la queue positionnellement :

```javascript
// Primary : premier item de queue.main (hors ticker)
primary = pool.getMain({ excludeTypes: ['ticker'] })[0]

// Companion : premier item compatible dans le reste de queue.main
// non-destructif — l'item reste à sa position, il est juste réservé
companion = pool.getMain({ excludeTypes: ['ticker'] })
              .slice(1)
              .find(item => COMPANION_TYPES[primary.type].includes(item.type))
```

Le companion est **réservé** visuellement mais pas consommé tant qu'il n'est pas effectivement affiché. `markDisplayed` le déplace dans played.

### 1.8 Règles Enrich — version finale

| Règle | Déclencheur | Action |
|---|---|---|
| `enrich-youtube` | Domaine `youtube.com` ou `youtu.be` | Appel API YouTube, récupère titre/durée/thumbnail. Si inaccessible → éviction. Reclassifie `link` → `youtube` |
| `enrich-giphy` | Domaine `giphy.com` ou `gph.is` | Télécharge GIF ≤ 10 MB. Si échec → éviction. Reclassifie `link` → `gif` |
| `gims-replacement` | `youtubeId` correspond à une vidéo de Gims | Remplace le `youtubeId` par l'épisode de Chasse et Pêche. Données originales dans le `payload` du `MediaEvent` |
| `enrich-link-dedup` | Même `content.url` déjà dans queue.main ou queue.played | Déplace l'item en fin de queue plutôt qu'en position FIFO normale |

`youtube-dedup` (dégradation de `priority`) est **supprimé** — remplacé par `enrich-link-dedup`.

### 1.9 GlobalState pool — version finale

```javascript
pool: {
  total         : COUNT(status = 'ready')          // main + played
  mainCount     : COUNT(queue.main)
  playedCount   : COUNT(queue.played)
  fresh         : COUNT(main AND submittedAt > now - 15min)
  queueSnapshot : queue.main.slice(0, 5)           // top 5 positionnels
}
```

---

## 2. Architecture des couches — jam-mode

### 2.1 Stack de layers

Inspiré de Resolume et TouchDesigner. Chaque layer est un `div` frère direct du `body`, canal de rendu indépendant. Le `SceneCompositor` est le seul à avoir une vue globale — les layers ne se connaissent pas entre eux.

```
<body>
  <div id="panic-layer">        z-index max, display:none nominal
  <div id="identity-layer">     QR code — fixe, jamais touché
  <div id="clock-layer">        countdown JAM — piloté par ClockEngine
  <div id="lower-third-layer">  attribution + ticker — piloté par LowerThirdEngine
  <div id="scene-layer">        scènes — piloté par SceneEngine
</body>
```

```
╔══════════════════════════════════════════════════════════╗
║  [00:00:00]                          [LOGO]  [QR]       ║  ← clock + identity
║                                                         ║
║                                                         ║
║              [ scène active ]                           ║  ← scene-layer
║                                                         ║
║                                                         ║
║  ┌─────────────────────────────────────────────────┐   ║
║  │  "Titre YouTube" · Marie Dupont · Équipe 7      │   ║  ← attribution band
║  ├─────────────────────────────────────────────────┤   ║
║  │ ▸ JOSÉ  Le compilateur de l'équipe 4 a demand…  │   ║  ← ticker band
║  └─────────────────────────────────────────────────┘   ║
╚══════════════════════════════════════════════════════════╝
```

### 2.2 SceneCompositor

Orchestre les trois engines. Ne rend rien — émet des commandes.

```
SceneCompositor
  ├── SceneEngine       → commande scene-layer
  ├── LowerThirdEngine  → commande lower-third-layer
  └── ClockEngine       → commande clock-layer
```

**Événements entrants :**

```javascript
compositor.onPoolUpdate()          // queue.main a changé
compositor.onSceneEnd()            // primary a terminé
compositor.onCompanionEnd()        // companion a terminé
compositor.onAdminSkip(itemId)     // skip admin
compositor.onTimeUpdate(remaining) // tick 1s depuis GlobalState
```

**Commandes sortantes :**

```javascript
sceneEngine.loadScene(scene)             // nouvelle scène complète
sceneEngine.recompose(companion | null)  // companion change, primary intact
lowerThird.showAttribution(primary)      // déclenché par loadScene uniquement
lowerThird.pushTicker(tickerItem)        // déclenché par TickerEngine
clockEngine.update(remaining)            // tick 1s
```

---

## 3. SceneEngine — primary / companion

### 3.1 Structure d'une scène

```javascript
Scene {
  primary    : MediaItem         // ancre — détermine la durée de la scène
  companion  : MediaItem | null  // item secondaire, timer indépendant
  layout     : LayoutName        // sélectionné par best-fit
  duration   : number | null     // ms — null si durée intrinsèque (youtube)
}
```

### 3.2 Deux timers indépendants

```
SCENE TIMER (primary)
───────────────────────────────────────────────────────────────────►
│  youtube : durée intrinsèque                                      │
│  photo / gif / clip / note : DURATIONS[type].normal               │
                                                                   ↓
                                                          onSceneEnd()
                                               markDisplayed(primary) → played
                                                       composeNextScene()

COMPANION TIMER (indépendant, tourne dans le scene timer)
──────────┬──────────┬──────────┬──────────────────────────────────►
          │          │          │
       arrive      expire     arrive
      layout      layout     layout
   MEDIA_WITH_   MEDIA_FULL MEDIA_WITH_
   VISUAL                   CAPTION
```

**Companion interrompu par `onSceneEnd()`** : pas de `markDisplayed`. Il reste à sa position dans `queue.main`, score intact — il sera primary au prochain tour.

### 3.3 Recomposition CSS

Le primary est ancré dans le DOM pour toute la durée de la scène. Seul le layout flex autour de lui change. Pour YouTube : même instance player, jamais détruite.

```
MEDIA_FULL          →   MEDIA_WITH_VISUAL      →   MEDIA_WITH_CAPTION
(companion = null)       (photo arrive)              (photo → played, note arrive)

╔══════════╗            ╔══════╦═══════╗            ╔══════════════════╗
║          ║            ║      ║       ║            ║                  ║
║  ▶  YT   ║  ──────►  ║  ▶YT ║ photo ║  ──────►  ║  ▶  YT           ║
║  100%    ║            ║  60% ║  40%  ║            ║                  ║
║          ║            ║      ║       ║            ╠══════════════════╣
╚══════════╝            ╚══════╩═══════╝            ║  "note en bas"   ║
                                                    ╚══════════════════╝
  vidéo continue          vidéo continue              vidéo continue
```

Transition : animation CSS sur les ratios flex, 300ms `ease-in-out`.

### 3.4 Algorithme best-fit

```javascript
// Primary : premier item de queue.main (hors ticker)
primary = pool.getMain({ excludeTypes: ['ticker'] })[0]

// Companion : premier item compatible dans le reste de queue.main
companion = pool.getMain({ excludeTypes: ['ticker'] })
              .slice(1)
              .find(item => COMPANION_TYPES[primary.type].includes(item.type))
```

Règles de compatibilité companion :

```
primary = youtube              → companion : photo | gif | clip | note
primary = photo | gif | clip   → companion : note
primary = note                 → companion : aucun (NOTE_CARD seule)
```

### 3.5 Layouts best-fit

```
primary              companion          → layout
────────────────────────────────────────────────────────────
(queue.main vide)    —                  → IDLE
youtube              null               → MEDIA_FULL
youtube              photo | gif | clip → MEDIA_WITH_VISUAL
youtube              note               → MEDIA_WITH_CAPTION
photo | gif | clip   null               → VISUAL_FULL
photo | gif | clip   note               → VISUAL_WITH_CAPTION
note                 —                  → NOTE_CARD
```

### 3.6 Représentation ASCII des layouts

```
IDLE
╔══════════════════════════════════════════════════════╗
║  [00:00:00]                               [QR]       ║
║                                                      ║
║              ┌─────────────────────┐                 ║
║              │   00:00:00          │                 ║
║              │   TEMPS RESTANT     │                 ║
║              └─────────────────────┘                 ║
╚══════════════════════════════════════════════════════╝

MEDIA_FULL                             [00:00:00] [QR]
╔══════════════════════════════════════════════════════╗
║                                                      ║
║              ▶  YouTube                              ║
║                                                      ║
╠══════════════════════════════════════════════════════╣
║  "Titre de la vidéo"  ·  Marie D.  ·  Équipe 7      ║  ← attribution (6s)
╠══════════════════════════════════════════════════════╣
║ ▸ JOSÉ  texte qui défile                            ║
╚══════════════════════════════════════════════════════╝

MEDIA_WITH_VISUAL                      [00:00:00] [QR]
╔══════════════════════════════════════════════════════╗
║                       │                             ║
║    ▶  YouTube         │   [ photo / gif / clip ]    ║
║       60%             │          40%                ║
║                       │  "Caption"  Thomas R. ▐    ║  ← inline companion
╠══════════════════════════════════════════════════════╣
║  "Titre vidéo"  ·  Marie D.  ·  Équipe 7            ║  ← attribution (6s)
╠══════════════════════════════════════════════════════╣
║ ▸ JOSÉ  texte qui défile                            ║
╚══════════════════════════════════════════════════════╝

MEDIA_WITH_CAPTION                     [00:00:00] [QR]
╔══════════════════════════════════════════════════════╗
║                                                      ║
║              ▶  YouTube                              ║
║                                                      ║
║  ──────────────────────────────────────────────────  ║
║  "La note en bande basse."    — Sarah · Équipe 2    ║  ← inline companion
╠══════════════════════════════════════════════════════╣
║  "Titre vidéo"  ·  Marie D.  ·  Équipe 7            ║  ← attribution (6s)
╠══════════════════════════════════════════════════════╣
║ ▸ JOSÉ  texte qui défile                            ║
╚══════════════════════════════════════════════════════╝

VISUAL_FULL                            [00:00:00] [QR]
╔══════════════════════════════════════════════════════╗
║                                                      ║
║           [ photo / gif / clip ]                     ║
║                                                      ║
║  "Caption optionnel"                                 ║
║  Thomas R.  ·  Équipe 3               ◀ inline       ║
╠══════════════════════════════════════════════════════╣
║  Thomas R.  ·  Équipe 3  ·  Statut : fonctionnel    ║  ← attribution (6s)
╠══════════════════════════════════════════════════════╣
║ ▸ JOSÉ  texte qui défile                            ║
╚══════════════════════════════════════════════════════╝

VISUAL_WITH_CAPTION                    [00:00:00] [QR]
╔══════════════════════════════════════════════════════╗
║           [ photo / gif / clip ]                     ║
║  Thomas R.  ·  Équipe 3               ◀ inline       ║
║  ──────────────────────────────────────────────────  ║
║  "La note en bande basse."    — Sarah · Équipe 2    ║  ← inline companion
╠══════════════════════════════════════════════════════╣
║  Thomas R.  ·  Équipe 3  ·  Statut : fonctionnel    ║  ← attribution (6s)
╠══════════════════════════════════════════════════════╣
║ ▸ JOSÉ  texte qui défile                            ║
╚══════════════════════════════════════════════════════╝

NOTE_CARD                              [00:00:00] [QR]
╔══════════════════════════════════════════════════════╗
║                                                      ║
║   ┌──────────────────────────────────────────────┐  ║
║   │  "Texte de la note en typo large,            │  ║
║   │   centré sur fond coloré."                   │  ║
║   │                     — Sarah · Équipe 2       │◀ inline
║   └──────────────────────────────────────────────┘  ║
╠══════════════════════════════════════════════════════╣
║  Sarah M.  ·  Équipe 2  ·  Dort debout depuis 23h  ║  ← attribution (6s)
╠══════════════════════════════════════════════════════╣
║ ▸ JOSÉ  texte qui défile                            ║
╚══════════════════════════════════════════════════════╝
```

---

## 4. LowerThirdEngine

### 4.1 Deux bandes indépendantes

```
lower-third-layer
┌─────────────────────────────────────────────────────────┐
│  ATTRIBUTION BAND    ~10% hauteur écran                  │
│  slide in → hold 6s → slide out                          │
├─────────────────────────────────────────────────────────┤
│  TICKER BAND         ~8% hauteur écran                   │
│  présent en continu si items ticker dans queue.main      │
└─────────────────────────────────────────────────────────┘
```

Les deux bandes s'animent indépendamment. Le `SceneCompositor` les pilote via deux commandes séparées — elles ne se connaissent pas.

### 4.2 Attribution band

**Règle fondamentale** : l'attribution suit le **primary uniquement**. Un changement de companion ne déclenche aucune attribution.

Contenu selon le type du primary :

```javascript
showAttribution(primary) {
  if (primary.type === 'youtube') {
    line1 = truncate(primary.content.title, 60)           // titre de la vidéo
    line2 = `${primary.author.displayName} · ${primary.author.team}`
  } else {
    line1 = `${primary.author.displayName} · ${primary.author.team}`
    line2 = primary.author.role                           // rôle du onboarding
  }
}
```

Exemples :

```
PRIMARY = youtube
┌─────────────────────────────────────────────────────┐
│  "Never Gonna Give You Up (Official Music Video)"   │
│  Marie Dupont · Équipe 7                            │
└─────────────────────────────────────────────────────┘

PRIMARY = photo / gif / clip / note
┌─────────────────────────────────────────────────────┐
│  Thomas Renard · Équipe 3                           │
│  Architecte de solutions temporaires                │
└─────────────────────────────────────────────────────┘
```

### 4.3 Attribution inline — companions

Les companions portent leur identité dans leur propre frame. Rien dans le lower third.

| Type companion | Attribution inline |
|---|---|
| `photo`, `gif`, `clip` | `content.caption` si présent + `nom · équipe` en coin bas-droit, fond semi-transparent |
| `note` | `— displayName · team` aligné à droite, en fin de citation |

Si l'auteur du companion est identique au primary, l'attribution inline est omise.

### 4.4 Ticker band

Round-robin sur `queue.main` filtré par type `ticker`, sans cooldown. Disparaît si la liste est vide. Scroll CSS pur de droite à gauche.

**Mode breaking news** — si `content.label` est non-null :

```
ÉTAT NORMAL (~8% hauteur)
╠══════════════════════════════════════════════════════╣
║ ▸ JOSÉ  message normal qui défile doucement         ║

ÉTAT BREAKING (~15% hauteur, animation d'entrée)
╠══════════════════════════════════════════════════════╣
║  ██  URGENT  ██  Le pool vient de passer 100 items. ║
╠══════════════════════════════════════════════════════╣
```

La scène active n'est pas touchée.

---

## 5. ClockEngine

Piloté uniquement par `GlobalState.jam.timeRemaining`. Aucune connaissance de la scène active.

```
> T−2h    → compact, coin supérieur droit
  T−2h    → grossit progressivement — transition CSS
  T−1h    → dominant, ~30% de l'écran, Commit Mono
  T−10min → plein écran, rouge #dc2626
             clock-layer passe au-dessus du scene-layer
             scene-layer à opacity: 0.15 — perceptible mais dominated
```

---

## 6. Régimes de durée

### 6.1 Régime normal

```
scène chargée → sceneTimer NORMAL
sceneTimer expiré → queue.main disponible ?
  ├── OUI → markDisplayed(primary), composeNextScene()
  └── NON → REGIME HOLD
```

### 6.2 Régime hold

```
REGIME HOLD
  sceneTimer EXTENDED démarré
  expiré → queue.main disponible ?
    ├── OUI → composeNextScene() + retour NORMAL
    └── NON → reboucle HOLD (durée fixe, pas élastique)
  interrupt → onPoolUpdate() → sortie immédiate
```

Le hold est du remplissage. `markHeld(primary, appId, ms)` écrit un `MediaEvent 'held'` à la sortie. Un item en hold n'est pas pénalisé — il n'a pas été diffusé, il tient l'écran.

### 6.3 Buffer slot (respiration)

Toutes les N scènes visuelles, on vide le companion. Le YouTube continue.

```javascript
onVisualEnd() {
  visualCount++
  if (visualCount % BUFFER_EVERY === 0) {
    bufferActive = true
    sceneEngine.recompose(null)
    setTimeout(BUFFER_DURATION, () => {
      bufferActive = false
      fetchNextCompanion()
    })
  }
}
```

---

## 7. Anti-thrashing

### 7.1 Grace period
```javascript
onCompanionSlotEmpty() {
  pendingCollapse = setTimeout(commitLayoutChange, GRACE_PERIOD)  // 800ms
}
onNewCompanion(item) { clearTimeout(pendingCollapse) }
```

### 7.2 Pre-fetch
```javascript
// PREFETCH_LEAD ms avant la fin, on identifie le companion suivant
prefetchTimer = setTimeout(() => {
  nextCompanionCandidate = pool.getMain({ excludeTypes: ['ticker'] })
    .slice(1).find(compatible)
}, COMPANION_DURATION - PREFETCH_LEAD)   // PREFETCH_LEAD : 2000ms
```

### 7.3 Durée minimum de scène
```javascript
MIN_SCENE_DURATION = 4_000   // ms — s'applique au primary uniquement
canChangeScene() { return Date.now() - sceneStartedAt >= MIN_SCENE_DURATION }
```

---

## 8. Configuration

```javascript
ENGINE_CONFIG = {
  // Durées de scène par type de primary (ms)
  DURATIONS: {
    photo : { normal: 20_000, extended: 45_000 },
    gif   : { normal: 20_000, extended: 45_000 },
    clip  : { normal: 20_000, extended: 45_000 },  // plancher: max(content.duration × 1000, 10_000)
    note  : { normal: 12_000, extended: 30_000 },
    // youtube : durée intrinsèque — pas de timer
  },

  // Durées companion (ms)
  COMPANION_DURATIONS: {
    photo : 20_000,
    gif   : 20_000,
    clip  : 20_000,
    note  : 12_000,
  },

  // Rythme
  BUFFER_EVERY    : 5,        // toutes les N scènes visuelles
  BUFFER_DURATION : 12_000,

  // Anti-thrashing
  GRACE_PERIOD       : 800,
  PREFETCH_LEAD      : 2_000,
  MIN_SCENE_DURATION : 4_000,

  // Attribution
  ATTRIBUTION_HOLD : 6_000,
}
```

---

## 9. Interface admin

### 9.1 Vue coup d'œil — téléphone, 3h du matin

Cinq indicateurs binaires. Vert ou rouge. Aucun détail.

```
╔══════════════════════════════════╗
║  MiniRégie  ●  RUNNING  H+14:23 ║
╠══════════════════════════════════╣
║  ● Écrans TV connectés    2 / 2  ║
║  ● App active          jam-mode  ║
║  ● Queue principale      47 items║
║  ● Dernière soumission    3 min  ║
║  ● Disque                   41%  ║
╚══════════════════════════════════╝
```

| Indicateur | Rouge si |
|---|---|
| Écrans TV | < 1 connecté |
| App active | `panicState = true` |
| Queue principale | < 3 items |
| Dernière soumission | > 30 min |
| Disque | > 80% |

### 9.2 Vue surveillance active — tablette en régie

```
╔══════════════════════════════════════════════════════════╗
║  RUNNING  H+14:23:07          T−33:36:53     ● 2 écrans ║
╠══════════════════════════════════════════════════════════╣
║  EN COURS                                               ║
║  ┌─────────────────────────────────────────────────┐   ║
║  │  PRIMARY   youtube  "Never Gonna Give You Up"   │   ║
║  │            Marie D. · Équipe 7  · il y a 2 min  │   ║
║  │  COMPANION photo    Thomas R.   · Équipe 3      │   ║
║  │  LAYOUT    MEDIA_WITH_VISUAL                    │   ║
║  │  RÉGIME    normal                               │   ║
║  └─────────────────────────────────────────────────┘   ║
║                                          [Skip] [Evict] ║
╠══════════════════════════════════════════════════════════╣
║  QUEUE PRINCIPALE  (47 items · 12 frais)                ║
║  ┌────────────────────────────────────────────────────┐ ║
║  │ #1  photo   Léa M.    Équipe 4   il y a 2 min  ⠿  │ ║  ← drag
║  │ #2  note    Karim B.  Équipe 1   il y a 8 min  ⠿  │ ║
║  │ #3  youtube           Équipe 6   il y a 14 min ⠿  │ ║
║  │ #4  photo   Sarah T.  Équipe 2   il y a 22 min ⠿  │ ║
║  └────────────────────────────────────────────────────┘ ║
║  QUEUE PLAYED  (12 items)                               ║
║  ┌────────────────────────────────────────────────────┐ ║
║  │  youtube  Marie D.    il y a 8 min    [Remettre]   │ ║
║  │  photo    Thomas R.   il y a 15 min   [Remettre]   │ ║
║  └────────────────────────────────────────────────────┘ ║
╠══════════════════════════════════════════════════════════╣
║  [Panic → jam-mode]  [micro-trottoir]  [Skip scène]    ║
╚══════════════════════════════════════════════════════════╝
```

### 9.3 Vue journal — diagnostic post-incident

```
╔══════════════════════════════════════════════════════════╗
║  JOURNAL  (dernières 2h)                    [Filtrer ▾] ║
╠══════════════════════════════════════════════════════════╣
║  14:23:07  transition        jam-mode (skip admin)      ║
║  14:21:44  displayed         youtube  "Never Gonna…"    ║
║  14:18:02  transition        micro-trottoir → jam-mode  ║
║  14:17:58  lifecycle_timeout signalReady  jam-mode  2s  ║  ← orange
║  13:45:00  panic_activated   app_error   jam-mode       ║  ← rouge
║  13:45:03  panic_cleared     resumed: jam-mode          ║
╚══════════════════════════════════════════════════════════╝
```

### 9.4 Actions admin disponibles

**Sur la scène active :**
- `Skip scène` — `markSkipped(primary)`, companion abandonné sans pénalité, scène suivante
- `Skip companion` — retire le companion, layout redescend ou nouveau companion fetché
- `Evict item` — suppression définitive depuis n'importe quelle queue

**Sur les queues :**
- `Réordonner` — drag & drop sur `queue.main`, appel `pool.reorder(ids)`
- `Remettre` — renvoie un item de `queue.played` en fin de `queue.main`
- `Upload interview` — injecté directement en fin de `queue.main`, exempté du Guard
- `Ajouter ticker` — injecté dans `queue.main` de type `ticker`, label optionnel

**Sur la JAM :**
- `JAM_START` — démarre la JAM, ouvre les soumissions, déclenche `countdown-to-jam`
- `JAM_END` — termine la JAM, ferme les soumissions, déclenche `end-of-countdown`
- `Déclencher app` — market trigger vers n'importe quelle app du registre
- `Panic → jam-mode` — retour immédiat, raccourci `Escape`

**Sur les participants :**
- `Ban` — soumissions futures rejetées silencieusement, items existants non touchés
- `Unban` — rétablit les soumissions

---

## 10. Flux de contrôle complet — jam-mode

```
DÉMARRAGE (load)
  │
  ├─ SceneCompositor.init()
  ├─ SceneEngine.init()
  ├─ LowerThirdEngine.init()
  ├─ ClockEngine.init()
  ├─ TickerEngine.init()
  └─ composeNextScene()

BOUCLE PRINCIPALE
  │
  ├─ composeNextScene()
  │    ├─ primary = queue.main[0] (hors ticker)
  │    ├─ companion = premier compatible dans queue.main.slice(1)
  │    ├─ layout = best-fit(primary, companion)
  │    ├─ sceneEngine.loadScene(scene)
  │    ├─ lowerThird.showAttribution(primary)
  │    └─ sceneTimer.start() si pas youtube
  │
  ├─ sceneTimer expiré
  │    ├─ prefetch disponible ? → markDisplayed(primary), composeNextScene()
  │    └─ non → REGIME HOLD → sceneTimer EXTENDED
  │
  ├─ youtube ended
  │    └─ markDisplayed(primary), composeNextScene()
  │
  ├─ companionTimer expiré
  │    ├─ markDisplayed(companion)
  │    ├─ bufferSlot si visualCount % BUFFER_EVERY === 0
  │    └─ sinon → fetchNextCompanion() → recompose ou redescendre
  │
  ├─ onPoolUpdate()
  │    ├─ si REGIME HOLD → sortie immédiate, composeNextScene()
  │    └─ si companion slot vide → fetchNextCompanion()
  │
  ├─ onTimeUpdate(remaining) → clockEngine.update(remaining)
  │
  ├─ tickerEngine tick → lowerThird.pushTicker(item)
  │
  ├─ admin skip primary → markSkipped(primary), composeNextScene()
  ├─ admin skip companion → markSkipped(companion), fetchNextCompanion()
  │
  └─ UNMOUNT
       ├─ sceneTimer.cancel(), companionTimer.cancel()
       ├─ markHeld(primary, 'jam-mode', elapsed) si REGIME HOLD
       └─ companion en cours → pas de markDisplayed (reste dans queue.main)
```

---

## 11. Ce qui reste inchangé

Les éléments suivants ne sont pas modifiés par cette session :

- Pipeline d'ingestion SANITIZE → GUARD → RESOLVE → ENRICH (structure et comportement)
- Modèle `Participant` et API participants
- Contrat d'interface des apps (`load`, `play`, `stop`, `remove`, `onPoolUpdate`)
- Double couche de sécurité BroadcastManager (AbortController + DOM wipe)
- Machine à états JAM (`idle` → `running` → `ended`)
- Triggers Market / Limit et planning `schedule.json`
- Persistance `state.json` et comportement au redémarrage
- `BroadcastEvent` et journal d'audit
- Interface `/go` — workflow soumission et interview
- `micro-trottoir` — structure de séquence et sélection des items
- `NarratorEngine` — modes scheduled, reactive, méta-système, behavioral
- Surveillance disque (80% alerte, 95% éviction)

---

*Session 2 — Mars 2026*
*Fichiers précédents amendés : `pool-manager-requirements.md`, `jam-mode-design.md`*
