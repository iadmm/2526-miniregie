# Broadcast Manager — Requirements
> MiniRégie TV · IAD Louvain-la-Neuve · JAM Multimédia 48h
> Version 2.1 · Mars 2026

---

## 1. Responsabilités et principes

Le Broadcast Manager est le **chef d'orchestre du broadcast**. Il maintient la machine à états de la JAM, pilote les transitions entre apps, évalue le planning de diffusion, et expose l'état global à tous les clients via Socket.io.

Il ne sait pas ce qu'affiche une app — il sait quelle app est active, quelle est la suivante, et comment coordonner leur cycle de vie.

Cinq principes fondamentaux :

**Toutes les apps sont égales.** Le BM ne connaît que le contrat d'interface d'une app. Il ne sait rien de son contenu ni de son comportement interne.

**Le cycle de vie du template et la transition de layer sont deux machines séparées.** Le template est responsable de ses propres animations (intro, outro). Le BM est responsable des layers et de leur coordination. Ils ne se mélangent pas — ils se coordonnent via des signaux.

**Le cut est la valeur par défaut.** Toute transition est un cut instantané sauf décision éditoriale explicite. Un effet non justifié est un défaut, pas une amélioration.

**Jamais de dead air.** Aucune transition, aucune erreur, aucun redémarrage ne produit un écran noir. En cas de défaillance, la slate de panic s'affiche immédiatement.

**L'app entrante est prête avant d'être visible.** Aucune app n'est révélée au spectateur avant d'avoir signalé son état `ready`. Ce principe, emprunté au modèle background/foreground de CasparCG, garantit que le spectateur ne voit jamais un état intermédiaire.

---

## 2. Architecture client — SPA avec couches séparées

Le broadcast client est une **Single Page Application** (SPA). La connexion Socket.io est établie une seule fois au démarrage et ne meurt jamais entre les transitions d'apps.

### 2.1 Structure DOM

```
<body>
  <div id="app-layer">         <!-- Slots foreground et background -->
  <div id="persistent-layer">  <!-- QR code, countdown JAM, ticker -->
  <div id="panic-layer">       <!-- Slate de panic, z-index maximal -->
</body>
```

**`app-layer`** contient deux slots permanents :
- `#slot-fg` : l'app active, visible à l'antenne
- `#slot-bg` : l'app en cours de chargement, invisible (`visibility: hidden`)

Les transitions View Transition API opèrent exclusivement à l'intérieur de `#app-layer`.

**`persistent-layer`** contient le QR code participant, le countdown JAM global et le ticker. Ce layer est structurellement hors de portée de `document.startViewTransition()`. Aucun de ses éléments ne possède de `view-transition-name`.

**`panic-layer`** est normalement `display: none`. Quand le panic state est activé, il passe au premier plan de façon synchrone — aucune animation, aucune frame intermédiaire.

### 2.2 Slots foreground / background

```
bgApp  : App | null   — app en cours de load(), dans #slot-bg
fgApp  : App          — app active, dans #slot-fg
```

---

## 3. Cycle de vie d'une App — modèle CasparCG

### 3.1 Les cinq méthodes

```javascript
App {
  id        : string
  outroMode : 'sequential' | 'concurrent' | 'none'

  load(signal: AbortSignal) : void
  // Appelé quand l'app entre dans #slot-bg (invisible).
  // Prépare état initial, charge données, construit DOM.
  // TOUS les event listeners sont enregistrés avec { signal }.
  // Appelle this.signalReady() quand prête.

  play() : void
  // Appelé quand l'app devient visible dans #slot-fg.
  // Joue animation d'intro onscreen.

  stop() : Promise<void>
  // Appelé quand le BM décide de quitter l'app.
  // Joue animation d'outro. Resolve quand outro terminée.

  remove() : void
  // Appelé avant le destroy du BM.
  // Cleanup : libère timers, intervalles, WebSocket, références pool.
  // Ne doit jamais lancer d'animation ni accéder au DOM.

  onPoolUpdate(item: MediaItem) : void
  // Notifié à chaque nouvel item ready dans le pool.
}
```

`signalReady()` est injectée par le BM dans l'instance au moment du `load()`. Appelée une seule fois.

### 3.2 outroMode

```
'sequential' : BM attend que stop() resolve avant la transition. Timeout : 1s.
'concurrent' : BM appelle stop() et déclenche la transition simultanément.
'none'       : BM ne appelle pas stop(). Transition immédiate.
```

### 3.3 Règles de cycle de vie

- `load()` est toujours appelé avant que l'app soit visible.
- `play()` est toujours appelé après que l'app est devenue visible.
- `remove()` est toujours appelé avant le destroy du BM.
- Si `load()` lève une exception → panic state immédiat.
- Si `stop()` lève une exception → log + force transition (équivalent timeout).
- Si `remove()` lève une exception → log + continue vers destroy (cleanup imposé s'exécute quoi qu'il arrive).

### 3.4 Chargement des apps

Toutes les apps sont **instanciées au démarrage du serveur**. Une app référencée dans `schedule.json` mais absente du registre produit un log d'avertissement au démarrage — pas d'erreur fatale.

---

## 4. Double couche de sécurité — destruction garantie

### 4.1 Première couche — AbortController

Au moment du `load()`, le BM crée un `AbortController` par app et injecte le `signal` dans `load(signal)`. **Tous** les event listeners doivent être enregistrés avec ce signal :

```javascript
element.addEventListener('click', handler, { signal })
```

`controller.abort()` détruit tous ces listeners atomiquement.

### 4.2 Deuxième couche — DOM wipe synchrone

```javascript
slot.innerHTML = ''   // synchrone — aucune frame intermédiaire
slot = null
```

### 4.3 Séquence de destroy — bloc finally

```javascript
try {
  app.remove()
} catch(e) {
  logBroadcastEvent('app_error', { appId, method: 'remove', error })
} finally {
  controller.abort()
  slot.innerHTML = ''
  slot = null
}
```

---

## 5. Séquences de transition complètes

### 5.1 Sequential

```
BM reçoit trigger
  ├─ BM crée AbortController pour l'app entrante
  ├─ BM appelle load(signal) sur l'app entrante [#slot-bg, invisible]
  │    App entrante appelle signalReady()         [timeout BM : 2s]
  ├─ BM appelle stop() sur l'app sortante
  │    App sortante resolve sa Promise            [timeout BM : 1s]
  ├─ BM déclenche startViewTransition() — swap slots
  ├─ BM appelle play() sur l'app entrante [#slot-fg, visible]
  ├─ BM met à jour GlobalState
  └─ BM détruit l'app sortante [try/finally]
```

### 5.2 Concurrent

```
BM reçoit trigger
  ├─ load(signal) sur l'app entrante [timeout : 2s]
  ├─ stop() sur l'app sortante [Promise ignorée après swap]
  ├─ startViewTransition() immédiat
  ├─ play() sur l'app entrante
  ├─ GlobalState mis à jour
  └─ destroy de l'app sortante [try/finally — après délai pour l'outro]
```

### 5.3 None

```
BM reçoit trigger
  ├─ load(signal) sur l'app entrante [timeout : 2s]
  ├─ startViewTransition() immédiat [pas de stop()]
  ├─ play() sur l'app entrante
  └─ destroy de l'app sortante [try/finally]
```

### 5.4 Panic

```
Événement panic
  ├─ panic-layer → display: block [synchrone]
  ├─ GlobalState : panicState = true
  ├─ Alerte admin via Socket.io
  └─ destroy de l'app courante [try/finally, best-effort]
```

---

## 6. Transitions visuelles

### 6.1 Principes

Le cut est la valeur par défaut. Durées calibrées sur les standards broadcast : 0.5 à 1.5 secondes maximum.

```javascript
appLayer.dataset.transition = 'jam-mode--micro-trottoir'
document.startViewTransition(() => swapSlots())
```

### 6.2 Catalogue de transitions

| Transition | Type | Durée | outroMode conseillé |
|---|---|---|---|
| Par défaut | Cut | 0 | `none` |
| `JAM_START` → `countdown-to-jam` | Wipe radial depuis le centre | 1–1.5s | `sequential` |
| `jam-mode` → `micro-trottoir` | Dissolve + wipe horizontal | 0.8s | `sequential` |
| `micro-trottoir` → `jam-mode` | Wipe horizontal inverse | 0.6s | `none` |
| `running` → `end-of-countdown` | Cut | 0 | `none` |
| `end-of-countdown` → `post-jam-idle` | Dissolve lent | 1.5s | `sequential` |
| Tout état → panic | Take immédiat | 0 | — |
| Panic → reprise | Cut | 0 | `none` |

### 6.3 Panic state — slate

Fond neutre configurable (noir exclu — dead air interdit). Countdown JAM depuis le `persistent-layer`. Aucune information technique exposée au spectateur.

---

## 7. Machine à états de la JAM

### 7.1 États

| État | Description | Soumissions |
|---|---|---|
| `idle` | JAM pas encore lancée | Refusées |
| `running` | JAM en cours | Acceptées |
| `ended` | JAM terminée | Refusées |

### 7.2 Transitions autorisées

```
idle    → running   JAM_START
running → ended     JAM_END
ended   → running   INTERDIT dans le MVP
idle    → ended     INTERDIT
```

La transition `ended → running` est explicitement bloquée. Un relancement nécessite un redémarrage serveur avec `state.json` modifié manuellement.

---

## 8. Triggers

### 8.1 Market — exécution immédiate

```javascript
MarketTrigger {
  type   : 'market'
  appId  : string
  source : 'admin' | 'system'
}
```

### 8.2 Limit — évalué toutes les secondes

```javascript
LimitTrigger {
  type      : 'limit'
  condition : TimeCondition
  appId     : string
  fired     : boolean
}

TimeCondition {
  at    : 'absolute' | 'H+' | 'T-'
  value : string | number
}
```

| Format | Référence | Exemple |
|---|---|---|
| `absolute` | Timestamp ISO | `2026-03-01T09:00:00` |
| `H+` | `jam.startedAt + value` | H+00:10:00 → 10 min après JAM_START |
| `T-` | `jam.endsAt - value` | T-01:00:00 → 1h avant JAM_END |

Un trigger `T-` dont `jam.endsAt` est `null` reste en attente sans erreur.

### 8.3 Idempotence

Un trigger déjà `fired` ne se redéclenche jamais. Un market trigger reçu pendant une transition `in_progress` est mis en file d'attente. Un double-envoi dans la même frame est dédupliqué.

---

## 9. Planning d'apps

Fichier `schedule.json` éditable avant la JAM. Lecture seule pendant la JAM.

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

## 10. GlobalState

```javascript
GlobalState {
  jam: {
    status        : 'idle' | 'running' | 'ended',
    startedAt     : timestamp | null,
    endsAt        : timestamp | null,
    timeRemaining : ms | null
  },
  broadcast: {
    activeApp     : AppId,
    transition    : 'idle' | 'in_progress',
    panicState    : boolean
  },
  pool: {
    total         : number,
    fresh         : number,
    queueSnapshot : MediaItem[]   // top 5 par score, hors ticker
  }
}
```

---

## 11. BroadcastEvent

Collection PocketBase `broadcast_events`.

```javascript
BroadcastEvent {
  id        : uuid
  type      : 'transition' | 'trigger_fired' | 'jam_state_change'
            | 'app_error' | 'panic_activated' | 'panic_cleared'
            | 'lifecycle_timeout'
  payload   : object | null
  createdAt : timestamp
}
```

| Type | Payload |
|---|---|
| `transition` | `{ fromApp, toApp, trigger, source?, duration_ms }` |
| `trigger_fired` | `{ trigger }` |
| `jam_state_change` | `{ from, to }` |
| `app_error` | `{ appId, method: 'load' \| 'stop' \| 'remove', error: string }` |
| `lifecycle_timeout` | `{ appId, method: 'signalReady' \| 'stop', timeout_ms }` |
| `panic_activated` | `{ reason: 'app_error' \| 'manual', appId? }` |
| `panic_cleared` | `{ resumedApp: AppId }` |

---

## 12. Persistance et recovery

### 12.1 state.json

Persisté toutes les 30 secondes.

```javascript
{
  jam       : GlobalState.jam,
  activeApp : GlobalState.broadcast.activeApp,
  schedule  : LimitTrigger[]
}
```

### 12.2 Comportement au redémarrage

1. Charge `state.json` si présent
2. Revalide `schedule.json` contre le registre
3. Restaure l'état `jam` — si `running`, recalcule `timeRemaining` depuis `startedAt`
4. Appelle `load()` puis `play()` sur l'app `activeApp` sans transition visuelle
5. Réévalue les triggers Limit non `fired` — ceux manqués se déclenchent dans l'ordre chronologique
6. Émet le GlobalState complet à chaque client à la connexion

Si `state.json` absent ou corrompu : démarrage en `idle` avec `pre-jam-idle`.

### 12.3 Reconnexion client

À chaque connexion Socket.io, le serveur émet immédiatement le GlobalState complet. Le client navigue vers l'app active sans animation.

---

## 13. API interne

```javascript
broadcast.dispatch(trigger)         // market trigger — file d'attente si transition in_progress
broadcast.getState()                // GlobalState courant, lecture seule
broadcast.registerApp(app)          // enregistre au démarrage — erreur si id dupliqué
broadcast.panic(reason, appId?)     // active panic state
broadcast.clearPanic(appId)         // désactive et déclenche market trigger vers appId
```

---

## 14. Surveillance

| Indicateur | Condition d'alerte |
|---|---|
| `broadcast.clients.tv` | = 0 → "aucun écran TV connecté" |
| `broadcast.panicState` | = true → alerte immédiate |
| `lifecycle_timeout` | tout timeout → log + alerte admin |
| `jam.timeRemaining` | < 10min et `running` → signal T−10min |
| Redémarrage PM2 | toujours → BroadcastEvent + alerte admin |

---

## 15. Hors périmètre Broadcast Manager

- Contenu affiché par les apps
- Sélection éditoriale des items du pool
- Gestion des fichiers médias
- Authentification de l'interface admin
- Proof of play complet
