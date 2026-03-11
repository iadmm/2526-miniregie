# Pool Manager — Requirements
> MiniRégie TV · IAD Louvain-la-Neuve · JAM Multimédia 48h  
> Version 3.0 · Mars 2026

---

## 1. Responsabilités et principes

Le Pool Manager est la **source de vérité unique** pour le contenu. Il stocke, score et expose les médias soumis pendant la JAM. Il ne sait pas ce qui s'affiche — il sait ce qui est disponible et à quel score.

Trois principes fondamentaux :

**Le pool est neutre.** L'intelligence éditoriale est dans les apps et les règles Enrich, pas dans le stockage. Le Pool Manager ne prend aucune décision éditoriale de lui-même.

**Le score n'est jamais stocké.** Il est calculé à la volée à chaque appel à `nextItem()`. Seuls `priority` et `status` sont des champs intentionnellement persistés sur le `MediaItem`.

**Tout événement est tracé.** Chaque action significative sur un item produit un `MediaEvent`. C'est la source de vérité pour les stats, le scoring et l'audit post-JAM.

---

## 2. Modèle de données

### 2.1 MediaItem

```
MediaItem {
  id          : uuid
  type        : 'photo' | 'gif' | 'note' | 'clip' | 'link' | 'youtube' | 'interview' | 'ticker'
  content     : { … }         // structure par type — voir §2.3
  priority    : number        // 80 | 100 | 200 | 999 — seul champ de scoring stocké
  status      : 'pending' | 'ready' | 'evicted'
  pinned      : boolean
  submittedAt : timestamp     // timestamp serveur, assigné à l'ingestion synchrone
  author      : {
    participantId : string    // ref Participant.id
                              // réservés : 'system:admin', 'system:narrator'
    displayName   : string    // snapshot à la soumission, jamais mis à jour rétroactivement
    team          : string
    role          : string
  }
}
```

`displayedCount`, `skippedCount` et `lastDisplayedAt` sont des valeurs **calculées à la volée** depuis les `MediaEvent`. Elles ne sont pas stockées sur le `MediaItem`.

### 2.2 MediaEvent

Journal exhaustif du cycle de vie de chaque item.

```
MediaEvent {
  id        : uuid
  itemId    : ref MediaItem
  type      : 'displayed' | 'skipped' | 'held' | 'pinned' | 'evicted' | 'enriched'
  appId     : string | null
  payload   : object | null
  createdAt : timestamp
}
```

**Payload par type :**

| Type | Payload |
|---|---|
| `displayed` | `{ appId }` |
| `skipped` | `{ appId }` |
| `held` | `{ appId, duration: number }` — ms effectivement passés en régime hold |
| `pinned` | `{ adminId? }` |
| `evicted` | `{ reason: 'manual' \| 'post-pin' \| 'unresolvable', adminId? }` |
| `enriched` | `{ rule: string, originalData: object }` |

### 2.3 MediaItem.content — par type

```javascript
// photo, gif
{ url: string, caption: string | null }                    // caption ≤ 120 car.

// note
{ text: string }                                           // ≤ 280 car.

// clip
{ url: string, duration: number, mimeType: string, caption: string | null }

// link (avant Enrich ou si Enrich ne reclassifie pas)
{
  url         : string,
  title       : string | null,
  description : string | null,   // ≤ 200 car.
  thumbnail   : string | null,   // chemin local après téléchargement
  siteName    : string | null,
  caption     : string | null
}

// youtube (après enrich-youtube)
{
  url       : string,
  youtubeId : string,
  title     : string,
  duration  : number,            // secondes
  thumbnail : string,
  caption   : string | null
}

// interview
{
  segments: [{
    question : string,
    video    : string | null,    // chemin local ≤ 60s
    duration : number | null,    // ffprobe
    textOnly : string | null,    // ≤ 280 car.
    photos   : string[],         // 0–3 chemins locaux liés à CE segment
  }],                            // 1 à 5 segments
  subject: {
    type          : 'self' | 'participant' | 'manual',
    participantId : string | null,
    displayName   : string,
    team          : string,
    role          : string,
  }
}

// ticker (NarratorEngine uniquement)
{ text: string, label?: string }   // label override ex: "URGENT"
```

Les photos d'un segment `interview` ne sont **pas** des `MediaItem` indépendants — pas de score, pas de passage dans `jam-mode`.

### 2.4 Modèle Participant

Collection PocketBase `participants`.

```javascript
Participant {
  id            : uuid
  oauthId       : string          // unicité sur (oauthProvider, oauthId)
  oauthProvider : string          // 'google' — seul provider MVP
  email         : string
  displayName   : string
  team          : string
  role          : string          // généré depuis roles.json si non renseigné
  avatarUrl     : string | null
  firstSeenAt   : timestamp
  lastSeenAt    : timestamp
  banned        : boolean
  bannedAt      : timestamp | null
  bannedBy      : string | null
  banReason     : string | null   // interne, jamais exposé au participant
}
```

---

## 3. Scoring

### 3.1 Formule

Le score est calculé uniquement au moment de `nextItem()` ou `getQueue()`, jamais stocké.

```
score = priority
      + freshnessScore(submittedAt, now)
      - (displayedCount × 40)
      - (skippedCount × 120)
```

```
displayedCount = COUNT(MediaEvent WHERE itemId = X AND type = 'displayed')
skippedCount   = COUNT(MediaEvent WHERE itemId = X AND type = 'skipped')
```

Les événements `held` sont **invisibles à la formule de score** — un item en régime hold n'est pas pénalisé.

### 3.2 FreshnessScore

| Âge depuis `submittedAt` | Score |
|---|---|
| < 2 min | +80 |
| < 15 min | +30 |
| < 1h | 0 |
| ≥ 1h | −50 |

### 3.3 Priorités de base

| Cas | `priority` |
|---|---|
| `photo`, `gif`, `note`, `clip`, `link`, `youtube` | 100 |
| `interview` | 200 |
| Item épinglé via `pin()` | 999 |
| `ticker` (NarratorEngine) | 80 |

### 3.4 Filtres d'exclusion durs

Avant tout calcul de score, `nextItem()` exclut :

- Les items avec `status ≠ 'ready'`
- Les items `ticker` (filtre dur — jamais dans `nextItem()`, gérés par TickerEngine)
- Les items dont `lastDisplayedAt > now - 5min` (cooldown)

`lastDisplayedAt` est la date du `MediaEvent` le plus récent de type `displayed` ou `skipped` pour l'item.

---

## 4. Pipeline d'ingestion

### 4.1 Phase synchrone — répond au client

```
RAW INPUT → SANITIZE → GUARD → item créé en 'pending' → "En régie !"
```

**SANITIZE** — validation technique stricte selon le type :

| Type | Contrôles |
|---|---|
| `photo` | MIME réel : `image/jpeg`, `image/png`. Taille ≤ 10 MB |
| `gif` | MIME réel : `image/gif`. Taille ≤ 10 MB |
| `note` | Longueur ≤ 280 car. après trim. Non vide |
| `clip` | MIME réel : `video/mp4`, `video/quicktime`, `video/webm`. Taille ≤ 50 MB. Durée ≤ 60s via `ffprobe`. Rejet : `"Clip trop long (Xs), maximum 60 secondes."` |
| `link` | URL `https` valide, ≤ 2048 car. HEAD request timeout 3s. Unfurl OpenGraph synchrone (`og:title`, `og:description`, `og:image`, `og:site_name`) + fallback `<title>` / `<meta name="description">`. Thumbnail non téléchargée à ce stade |
| `interview` | Traitement via endpoint dédié avec upload progressif. MIME : `video/mp4`. Taille ≤ 500 MB par segment vidéo |

Attribution des métadonnées à cette étape : `id`, `submittedAt`, `author` (snapshot depuis Participant), `priority` de base, `status: 'pending'`, `pinned: false`.

**GUARD** — deux vérifications dans l'ordre :

**Statut JAM** : si `jam.status ≠ 'running'` :
- `idle` → `"La JAM n'est pas encore lancée"`
- `ended` → `"La JAM est terminée"`

**Rate limit et quota** :
- Max 1 soumission par `participantId` par 30 secondes. Rejet : `"Trop de soumissions, réessaie dans Xs"`
- Max 3 clips par `participantId` sur toute la JAM. Rejet : `"Tu as atteint la limite de clips"`
- Participant `banned = true` : rejet silencieux — client reçoit "En régie !" normalement

Les uploads `interview` et les injections `system:narrator` sont **exemptés** du Guard.

### 4.2 Phase asynchrone — traitement en arrière-plan

```
RESOLVE → POOL → ENRICH → status: 'ready'
                        ou
RESOLVE échoue → status: 'evicted' + MediaEvent { type: 'evicted', reason: 'unresolvable' }
```

**RESOLVE** — vérification et enrichissement selon le type :

| Type | Action |
|---|---|
| `photo`, `gif` | Sauvegarde physique sur disque |
| `note` | Aucune action (contenu déjà en base) |
| `clip` | Sauvegarde sur disque + `duration` via `ffprobe` |
| `link` | Téléchargement et stockage du thumbnail (timeout 5s, max 2 MB). Échec non bloquant |
| `youtube` | Appel API YouTube Data v3 : vérification accessibilité, titre, durée, thumbnail HD. Si inaccessible → éviction immédiate |
| `interview` | Sauvegarde vidéo + photos liées. Protocol d'upload progressif (voir §4.3) |

**POOL** — vérification espace disque (si upload fichier) :
- Disque > 95% → éviction + alerte admin
- Sinon → `status: 'ready'`

**ENRICH** — étape finale. Chaque règle qui modifie un item écrit un `MediaEvent { type: 'enriched' }`.

**Règles Enrich :**

| Règle | Déclencheur | Action |
|---|---|---|
| `enrich-youtube` | `link` avec domaine `youtube.com` ou `youtu.be` | Appel API YouTube Data v3. Extrait `videoId`, titre, durée, thumbnail HD. Si inaccessible → éviction. Reclassifie `link` → `youtube` |
| `enrich-giphy` | `link` avec domaine `giphy.com` ou `gph.is` | Appel API Giphy (clé publique, 1000 req/h). Télécharge GIF ≤ 10 MB. Si échec → éviction. Reclassifie `link` → `gif` |
| `enrich-link-dedup` | Même `content.url` déjà présent dans le pool (query params ignorés) | Dégrade progressivement `priority` selon le nombre d'occurrences |
| `gims-replacement` | `youtubeId` correspond à une vidéo de Gims | Remplace le `youtubeId` par un épisode de Chasse et Pêche. Données originales dans `payload` du MediaEvent |

### 4.3 Protocol d'upload interview

```
POST /go/upload/video  →  { uploadId: uuid }   ← démarre dès sélection fichier
POST /go/upload/submit { uploadId, segments[], subject }  →  MediaItem | Error
```

`uploadId` en mémoire — expire si `submit` absent dans un délai raisonnable. Fichier orphelin nettoyé au redémarrage.

---

## 5. Comportement du pin

Le pin est une **interruption ponctuelle**, pas un boost durable.

`pin(id)` :
1. Passe `priority` à 999 sur le `MediaItem`
2. Passe `pinned` à `true`
3. Si un autre item était déjà épinglé, son `pinned` repasse à `false` sans éviction
4. Écrit un `MediaEvent { type: 'pinned' }`

`markDisplayed(itemId, appId)` sur un item épinglé :
1. Écrit un `MediaEvent { type: 'displayed' }`
2. Déclenche automatiquement `evict(itemId, 'post-pin')`

---

## 6. API interne

### `pool.addItem(raw)`
Phase synchrone du pipeline. Retourne le `MediaItem` créé avec `status: 'pending'`, ou une `Error`.

### `pool.nextItem(filters?)`
Calcule les scores à la volée, applique les filtres d'exclusion durs (cooldown, statut, type ticker), retourne l'item avec le score le plus élevé. Retourne `null` si aucun item disponible.

```
filters? {
  types?          : MediaItem['type'][]
  submittedAfter? : timestamp
}
```

### `pool.markDisplayed(itemId, appId)`
Écrit un `MediaEvent { type: 'displayed' }`. Si l'item a `pinned: true`, déclenche automatiquement `pool.evict(itemId, 'post-pin')`.

### `pool.markSkipped(itemId, appId)`
Écrit un `MediaEvent { type: 'skipped' }`.

### `pool.markHeld(itemId, appId, durationMs)`
Écrit un `MediaEvent { type: 'held', payload: { duration: durationMs } }`. Invisible au calcul de score — un item en hold n'est pas pénalisé.

### `pool.pin(id)`
Passe `priority` à 999 et `pinned` à `true`. Retire le pin de tout autre item épinglé. Écrit un `MediaEvent { type: 'pinned' }`.

### `pool.evict(id, reason)`
Passe `status` à `evicted` et `pinned` à `false`. Écrit un `MediaEvent { type: 'evicted', payload: { reason } }`.

### `pool.getQueue(filters?)`
Retourne les items `ready` triés par score décroissant, calculé à la volée. Les `ticker` sont exclus sauf si explicitement demandés. Lecture non-destructive.

```javascript
filters? {
  types?           : MediaItem['type'][]
  excludeTypes?    : MediaItem['type'][]
  submittedAfter?  : timestamp
  submittedBefore? : timestamp
  minPriority?     : number
  withCooldown?    : boolean   // défaut: true
  scoring?         : boolean   // défaut: true — si false, tri par submittedAt ASC
}
```

### `pool.getItems(filters)`
Retourne une liste filtrée d'items `ready`, sans scoring ni cooldown. Usage : `micro-trottoir` pour sa sélection chronologique.

```
filters {
  types?          : MediaItem['type'][]
  submittedAfter? : timestamp
  sort?           : 'submittedAt ASC' | 'submittedAt DESC'
}
```

---

## 7. Persistance

PocketBase est la couche de persistance. Collections : `media_items`, `media_events`, `participants`.

Les fichiers physiques (`photo`, `gif`, `clip`, `interview`) sont stockés sur disque dans un répertoire dédié. L'URL relative dans `content.url` est stable entre les redémarrages.

---

## 8. Surveillance

| Seuil disque | Action |
|---|---|
| > 80% | Événement `DISK_WARNING` vers le client admin |
| > 95% | Éviction de l'item en cours d'upload, alerte admin |

Le Pool Manager alimente les champs `pool` du `GlobalState` :

```
pool: {
  total         : COUNT(status = 'ready')
  fresh         : COUNT(status = 'ready' AND submittedAt > now - 15min)
  queueSnapshot : top 5 par score (items 'ready', hors ticker)
}
```

---

## 9. API participants

```javascript
participants.list(query?)    → Participant[]   // filtre displayName + team
participants.get(id)         → Participant | null
participants.upsert(oauth)   → Participant
participants.ban(id, reason) → void
participants.unban(id)       → void

GET /api/participants?q=thomas
→ [ { id, displayName, team, role, avatarUrl } ]
// jamais exposé : oauthId, email, firstSeenAt, banReason
```

---

## 10. User stories

### Participant
- En tant que participant, je soumets une photo depuis mon smartphone et je reçois "En régie !" immédiatement, sans attendre le traitement.
- En tant que participant, si je soumets trop vite, je reçois un message m'indiquant combien de secondes attendre.
- En tant que participant, si la JAM n'est pas ouverte, je reçois un message explicite.
- En tant que participant, si ma vidéo YouTube est inaccessible, elle n'apparaît pas à l'écran sans que j'en sois notifié.
- En tant que participant, si je suis banni, je reçois "En régie !" sans jamais le savoir.

### Admin
- En tant qu'admin, je vois la queue en temps réel avec les scores et je peux skipper, évincer ou épingler n'importe quel item.
- En tant qu'admin, quand j'épingle un item, il s'affiche au prochain cycle et disparaît automatiquement après diffusion.
- En tant qu'admin, je peux uploader une interview qui entre dans le pool avec priorité élevée, indépendamment du statut de la JAM.
- En tant qu'admin, je peux consulter l'historique complet d'un item depuis les logs.

### App (consommateur)
- En tant qu'app, j'appelle `nextItem()` avec mes propres filtres et je reçois l'item le mieux scoré.
- En tant qu'app, je signale explicitement chaque affichage, skip ou hold via les méthodes `mark*`.
- En tant qu'app `micro-trottoir`, j'accède aux interviews de la dernière fenêtre horaire via `getItems()` sans interférer avec `jam-mode`.

---

## 11. Hors périmètre Pool Manager

- Transcodage ou redimensionnement des médias
- Modération préalable des soumissions
- Logique de sélection éditoriale (responsabilité des Apps)
- Connaissance de l'app active ou de l'état du broadcast
- Notification au participant si sa vidéo YouTube est rejetée en asynchrone
- Proof of play complet
- GIFs Tenor ou autres non-Giphy (traités comme `link` générique)
