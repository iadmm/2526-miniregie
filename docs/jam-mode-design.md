# jam-mode — Spécification technique
> MiniRégie TV · IAD Louvain-la-Neuve · JAM Multimédia 48h
> Version 2.0 · Mars 2026

---

## 1. Rôle et positionnement

`jam-mode` est l'app principale de la régie. Elle est active la majorité des 48h et orchestre simultanément trois responsabilités :

- Afficher le **flux de soumissions** des participants (photos, GIFs, notes, clips, liens, YouTube)
- Maintenir un **fond sonore continu** (YouTube)
- Afficher le **countdown** de la JAM en couche persistante

C'est la seule app qui consomme le pool en continu, qui gère plusieurs couches visuelles simultanées, et qui valide en conditions réelles l'ensemble du contrat système — scoring, cooldown, cycle de vie des items.

---

## 2. Architecture des couches

```
<body>
  <div id="app-layer">         ← jam-mode vit ici (slot foreground)
  <div id="persistent-layer">  ← countdown JAM + QR code + ticker
  <div id="panic-layer">       ← slate de panic, z-index maximal
</body>
```

`jam-mode` ne touche jamais au `persistent-layer`. Le countdown, le QR code et le ticker sont structurellement hors de portée de ses transitions.

---

## 3. Le LayoutEngine

### 3.1 Principe

Le LayoutEngine maintient une collection d'**items actifs** (`activeItems`) et émet un `LayoutState` à chaque changement. Le renderer est passif — il reçoit le payload et applique le CSS. Aucune décision éditoriale dans le renderer.

**Contrainte dure** : `activeItems` ne peut jamais contenir deux items avec de l'audio. Une seule source sonore à la fois.

```javascript
activeItems : MediaItem[]   // 0, 1 ou 2 items simultanément
                            // au maximum 1 de type 'youtube'
```

### 3.2 Les types dans le LayoutEngine

Le LayoutEngine traite les types selon leurs propriétés visuelles et sonores :

| Type | Catégorie LayoutEngine | Audio | Durée intrinsèque |
|---|---|---|---|
| `photo` | visuel | non | non — timer fixe |
| `gif` | visuel | non | non — timer fixe (joue en boucle) |
| `clip` | visuel | non | oui — `content.duration`, plancher 10s |
| `note` | texte | non | non — timer fixe |
| `youtube` | audio-visuel | oui | oui — durée vidéo |
| `link` | visuel ou texte | non | non — timer fixe (voir §3.3) |

### 3.3 Comportement des types `link` et `gif`

**`link`** — comportement conditionnel selon la qualité des métadonnées :
- `content.thumbnail` présent → traité comme `photo` dans le layout → `VISUAL_WITH_CAPTION` (titre + domaine en caption)
- `content.thumbnail` absent → traité comme `note` dans le layout → `NOTE_CARD` (titre + description + domaine, typo large)

**`gif`** — traité comme `photo`, joue en boucle automatique. Durée = timer fixe `photo` (l'animation boucle en continu pendant ce timer).

### 3.4 Le mécanisme `caption`

Si `content.caption` est renseigné sur un item de type `photo`, `gif`, `clip`, `link`, ou `youtube`, le layout bascule automatiquement vers la variante `*_WITH_CAPTION` correspondante.

Exemples :
- `[photo]` + caption → `VISUAL_WITH_CAPTION`
- `[youtube]` + caption → `MEDIA_WITH_CAPTION`
- `[youtube] + [photo]` + caption sur photo → `MEDIA_WITH_VISUAL_AND_CAPTION`

### 3.5 Les layouts

Le layout est une **fonction pure** de `activeItems` :

```
activeItems                              → layout
─────────────────────────────────────────────────────────────────
[]                                       → IDLE
[youtube]                                → MEDIA_FULL
[photo|gif|clip|link(thumb)]             → VISUAL_FULL
[note|link(no-thumb)]                    → NOTE_CARD
[youtube, photo|gif|clip|link(thumb)]    → MEDIA_WITH_VISUAL
[youtube, note|link(no-thumb)]           → MEDIA_WITH_CAPTION
[youtube, photo|gif|clip, note]          → MEDIA_WITH_VISUAL_AND_CAPTION
[photo|gif|clip|link(thumb), note]       → VISUAL_WITH_CAPTION
[photo|gif|clip|link(thumb), photo|gif]  → DUAL_VISUAL
```

### 3.6 Représentation ASCII des layouts

```
IDLE
╔══════════════════════════════════════════════════════╗
║                                                      ║
║              ┌─────────────────────┐                 ║
║              │   00:00:00          │                 ║
║              │   TEMPS RESTANT     │                 ║
║              └─────────────────────┘                 ║
║                                          [QR]        ║
╚══════════════════════════════════════════════════════╝

MEDIA_FULL                                 [00:00] [QR]
╔══════════════════════════════════════════════════════╗
║  │                                               │  ║
║  │              ▶  YouTube                       │  ║
║  │                                               │  ║
║  │_______________________________________________│  ║
╚══════════════════════════════════════════════════════╝

VISUAL_FULL                                [00:00] [QR]
╔══════════════════════════════════════════════════════╗
║  │                                               │  ║
║  │     [ photo / gif / clip / link(thumb) ]      │  ║
║  │                                               │  ║
║  │_______________________________________________│  ║
╚══════════════════════════════════════════════════════╝

NOTE_CARD                                  [00:00] [QR]
╔══════════════════════════════════════════════════════╗
║                                                      ║
║        ┌──────────────────────────────────┐          ║
║        │  "Texte de la note en typo       │          ║
║        │   large, centré sur fond         │          ║
║        │   coloré."          — @auteur    │          ║
║        └──────────────────────────────────┘          ║
╚══════════════════════════════════════════════════════╝
                                                        
NOTE_CARD (link sans thumbnail)            [00:00] [QR]
╔══════════════════════════════════════════════════════╗
║                                                      ║
║        ┌──────────────────────────────────┐          ║
║        │  Titre de l'article              │          ║
║        │  Description courte…            │          ║
║        │                   domaine.com    │          ║
║        └──────────────────────────────────┘          ║
╚══════════════════════════════════════════════════════╝

MEDIA_WITH_VISUAL                          [00:00] [QR]
╔══════════════════════════════════════════════════════╗
║  │                        │                     │  ║
║  │    ▶  YouTube          │   [ photo / gif /   │  ║
║  │       60%              │     clip / link ]   │  ║
║  │________________________│_____________________│  ║
╚══════════════════════════════════════════════════════╝

MEDIA_WITH_CAPTION                         [00:00] [QR]
╔══════════════════════════════════════════════════════╗
║  │                                               │  ║
║  │              ▶  YouTube                       │  ║
║  │                                               │  ║
║  ├───────────────────────────────────────────────┤  ║
║  │  "La note / caption en bas."  ~25% hauteur    │  ║
║  │_______________________________________________│  ║
╚══════════════════════════════════════════════════════╝

MEDIA_WITH_VISUAL_AND_CAPTION              [00:00] [QR]
╔══════════════════════════════════════════════════════╗
║  │                        │                     │  ║
║  │    ▶  YouTube          │   [ visuel ]        │  ║
║  │       60%              │        40%          │  ║
║  ├────────────────────────┴─────────────────────┤  ║
║  │  "Note pleine largeur en bas."  ~20% hauteur  │  ║
║  │_______________________________________________│  ║
╚══════════════════════════════════════════════════════╝

VISUAL_WITH_CAPTION                        [00:00] [QR]
╔══════════════════════════════════════════════════════╗
║  │                                               │  ║
║  │     [ photo / gif / clip / link(thumb) ]      │  ║
║  │                                               │  ║
║  ├───────────────────────────────────────────────┤  ║
║  │  "Caption / note."    ~25% hauteur            │  ║
║  │_______________________________________________│  ║
╚══════════════════════════════════════════════════════╝

DUAL_VISUAL                                [00:00] [QR]
╔══════════════════════════════════════════════════════╗
║  │                        │                     │  ║
║  │    [ visuel A ]        │    [ visuel B ]     │  ║
║  │         50%            │        50%          │  ║
║  │________________________│_____________________│  ║
╚══════════════════════════════════════════════════════╝
```

### 3.7 Le countdown — couche persistante

Le countdown évolue selon le temps restant. Il est affiché dans le `persistent-layer`, jamais dans `app-layer`.

```
> 2h    — compact, coin supérieur droit
T−2h    — grossit progressivement
T−1h    — dominant, 50% de l'écran
T−10min — plein écran, rouge, layout actif masqué
```

`countdownHint: 'full'` est émis uniquement pour IDLE et T−10min.

### 3.8 LayoutState émis

```javascript
LayoutState {
  layout        : LayoutName,
  items         : MediaItem[],      // [primaire, secondaire?, tertiaire?]
  regime        : 'normal' | 'hold',
  bufferActive  : boolean,
  countdownHint : 'full' | 'compact'
}
```

---

## 4. Règles de sélection des items

### 4.1 Quand activeItems est vide

Bonus audio appliqué pour favoriser la continuité sonore :

```javascript
score_effectif = score_pool + (item.type === 'youtube' ? AUDIO_AFFINITY_BONUS : 0)
// AUDIO_AFFINITY_BONUS : 150 (configurable)
```

Un YouTube moyen bat une photo équivalente. Un YouTube froid ne bat pas une photo fraîche.

### 4.2 Quand un YouTube est actif

Cherche uniquement des visuels pour le slot secondaire :

```javascript
pool.getQueue({ types: ['photo', 'gif', 'clip', 'link', 'note'] })[0]
```

Si le visuel se termine avant la vidéo :
- Pool a un nouveau visuel → rotation, layout se recompose
- Pool vide de visuels → layout redescend vers `MEDIA_FULL`

La vidéo continue sans interruption. Le changement est CSS uniquement.

### 4.3 Quand YouTube + visuel sont actifs

Une note disponible peut s'ajouter en bande basse sans recomposition majeure :

```
MEDIA_WITH_VISUAL → MEDIA_WITH_VISUAL_AND_CAPTION  (addition)
note expire
MEDIA_WITH_VISUAL_AND_CAPTION → MEDIA_WITH_VISUAL  (retrait)
```

---

## 5. Les deux régimes de durée

### 5.1 Régime normal

Items sans durée intrinsèque (`photo`, `gif`, `note`, `clip` court, `link`) — timer fixe par type.

```
item affiché → timer NORMAL
timer expiré → pool.getQueue() disponible ?
  ├── OUI → markDisplayed, rotation, régime normal maintenu
  └── NON → → → REGIME HOLD
```

### 5.2 Régime hold

```
REGIME_HOLD
  timer EXTENDED démarré
  expiré → pool.getQueue() disponible ?
    ├── OUI → rotation + retour REGIME_NORMAL
    └── NON → reboucle REGIME_HOLD (durée fixe, pas élastique)
  interrupt → onPoolUpdate() → sortie immédiate + retour REGIME_NORMAL
```

### 5.3 Traçabilité

Quand un item sort du régime hold :

```javascript
MediaEvent {
  type    : 'held',
  itemId  : ref,
  appId   : 'jam-mode',
  payload : { duration: number }  // ms effectivement passés en hold
}
```

`displayedCount` dans le scoring ne compte que les événements `displayed`. Les `held` sont invisibles à la formule de score.

---

## 6. Le buffer slot (respiration)

Toutes les N soumissions visuelles, on vide le slot visuel uniquement. Le YouTube continue.

```javascript
onVisualEnd() {
  visualCount++
  if (visualCount % BUFFER_EVERY === 0) {
    bufferActive = true
    setTimeout(BUFFER_DURATION, () => {
      bufferActive = false
      fetchNextVisual()
    })
  }
}
```

---

## 7. Anti-layout thrashing

### 7.1 Grace period

```javascript
onSlotEmpty(slot) {
  pendingCollapse[slot] = setTimeout(commitLayoutChange, GRACE_PERIOD)
}
onNewItem(slot, item) {
  clearTimeout(pendingCollapse[slot])
}
// GRACE_PERIOD : 800ms
```

### 7.2 Pre-fetch

```javascript
prefetchTimer = setTimeout(() => {
  nextCandidate = pool.getQueue({ types: [...] })[0]
}, DURATION - PREFETCH_LEAD)
// PREFETCH_LEAD : 2000ms
```

### 7.3 Durée minimum de layout

```javascript
MIN_LAYOUT_DURATION = 4_000

canChangeLayout() {
  return Date.now() - lastLayoutChange >= MIN_LAYOUT_DURATION
}
```

---

## 8. L'API Pool — getQueue(filters)

```javascript
pool.getQueue(filters?) → MediaItem[]
```

Lecture non-destructive. Plusieurs consommateurs peuvent appeler `getQueue()` avec des filtres différents sans se marcher dessus.

```javascript
filters {
  types?           : MediaItem['type'][]
  excludeTypes?    : MediaItem['type'][]
  submittedAfter?  : timestamp
  submittedBefore? : timestamp
  minPriority?     : number
  withCooldown?    : boolean   // défaut: true
  scoring?         : boolean   // défaut: true
}
```

**Usages :**

```javascript
// jam-mode — prochain visuel
pool.getQueue({ types: ['photo', 'gif', 'clip', 'link', 'note'] })[0]

// jam-mode — prochain item avec bonus audio
pool.getQueue()[0]  // + AUDIO_AFFINITY_BONUS appliqué en amont

// ticker — round-robin, sans cooldown ni scoring
pool.getQueue({ types: ['ticker'], withCooldown: false, scoring: false })[0]

// micro-trottoir — chronologique, fenêtre 4h
pool.getItems({ types: ['interview'], submittedAfter: now - 4 * 3_600_000, sort: 'submittedAt ASC' })

// admin snapshot — top 20 scorés, hors ticker
pool.getQueue({ excludeTypes: ['ticker'] }).slice(0, 20)

// GlobalState — top 5
pool.getQueue({ excludeTypes: ['ticker'] }).slice(0, 5)
```

---

## 9. Le ticker

### 9.1 Position architecturale

Le ticker vit dans le `persistent-layer`. Aucun layout ne sait qu'il existe. Aucune transition ne le touche.

```
╔══════════════════════════════════════════════════════╗
║  [ layout actif ]                       [00:00] [QR] ║
║ ████████████████████████████████████████████████████ ║
║ █  ▸ JOSÉ  █  texte qui défile de droite à gauche    █
║ ████████████████████████████████████████████████████ ║
╚══════════════════════════════════════════════════════╝
```

Bande fixe en bas, ~8% de hauteur d'écran. Label fixe à gauche, scroll CSS pur à droite.

### 9.2 TickerEngine

```javascript
pool.getQueue({ types: ['ticker'], withCooldown: false, scoring: false })
// → round-robin sur les items ticker actifs
// → reboucle en fin de liste
```

Les items `ticker` sont exclus de `nextItem()` général par filtre dur dans `getQueue()`.

---

## 10. Configuration

```javascript
ENGINE_CONFIG = {
  AUDIO_AFFINITY_BONUS : 150,

  DURATIONS: {
    photo : { normal: 20_000, extended: 45_000 },
    gif   : { normal: 20_000, extended: 45_000 },
    clip  : { normal: null,   extended: null    },  // durée = content.duration, plancher 10s
    note  : { normal: 12_000, extended: 30_000 },
    link  : { normal: 15_000, extended: 35_000 },   // si thumbnail présent : comme photo
  },

  BUFFER_EVERY    : 5,
  BUFFER_DURATION : 12_000,

  GRACE_PERIOD        : 800,
  PREFETCH_LEAD       : 2_000,
  MIN_LAYOUT_DURATION : 4_000,
}
```

---

## 11. Flux de contrôle complet

```
DÉMARRAGE jam-mode (mount)
  ├─ LayoutEngine.init()
  ├─ TickerEngine.init()
  ├─ activeItems = []
  ├─ fetchNext() ← avec AUDIO_AFFINITY_BONUS
  │
  └─ BOUCLE PRINCIPALE
       ├─ item reçu → activeItems.push()
       │              recalcul layout → emit LayoutState
       │              démarrer timer (si pas durée intrinsèque)
       │
       ├─ timer expiré → prefetch déjà fait ?
       │    ├── OUI → swap immédiat, markDisplayed, visualCount++
       │    └── NON → fetchNext() → si vide : HOLD
       │
       ├─ youtube ended → markDisplayed, audioItem = null
       │                  recalcul layout
       │                  fetchNext() avec AUDIO_AFFINITY_BONUS
       │
       ├─ onPoolUpdate(item) → si item en HOLD : sortie immédiate
       │                       si slot libre : fetchNext()
       │
       ├─ admin skip → markSkipped, item retiré, fetchNext()
       │
       └─ UNMOUNT
            → clearAll timers
            → markHeld() sur items en régime hold
            → activeItems = []
```

---

## 12. Références industrielles

| Pattern | Source | Application dans jam-mode |
|---|---|---|
| Gap filler | Broadcast TV/radio | Régime hold à durée fixe, reboucle |
| Hold on last frame | Systèmes de playout | Item tenu à l'écran plutôt que coupé au noir |
| Dwell time adaptatif | Digital signage | Durées `normal` vs `extended` selon état du pool |
| Message selector | JMS / ActiveMQ / RabbitMQ | `getQueue(filters)` — filtre côté consommateur |
| CQRS | Architecture enterprise | Séparation lecture pure / commandes avec effets |
| Priority Queue | Azure Service Bus | `AUDIO_AFFINITY_BONUS` sur la sélection |
