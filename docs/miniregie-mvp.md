# MiniRégie TV — Spécification MVP

> IAD Louvain-la-Neuve · JAM Multimédia 48h · Version 2.0 · Mars 2026

---

## Principes directeurs

**Prêt le jour J.** Le MVP n'est pas un prototype — c'est la version de production pour la JAM. La robustesse prime sur la complétude.

**Toutes les apps sont égales.** Il n'y a pas d'apps "spéciales". Chaque app est un programme autonome qui consomme le pool et pilote le layout. Le Broadcast Manager les traite de façon identique — même cycle de vie, même contrat d'interface.

**Le pool est neutre.** Le Pool Manager stocke et score mécaniquement. L'intelligence éditoriale est dans les apps et leur configuration, pas dans le stockage.

**Le smartphone ne sait rien du broadcast.** Le client participant est un formulaire d'upload stateless. Toute logique de validation et de contrôle d'accès est côté serveur.

---

## Architecture générale

```
┌─────────────────────────────────────────────────────┐
│                   Node.js Server                     │
│                                                      │
│   Pool Manager          Broadcast Manager            │
│   (scoring, queue)      (scheduler, transitions)     │
│                                                      │
│   NarratorEngine        Participants                 │
│   (JOSÉ)                (OAuth Google)               │
│                                                      │
│              Socket.io / HTTP                        │
└──────┬───────────────┬──────────────┬───────────────┘
       │               │              │
  Broadcast       Admin Client   Participant Client
  Client (TV)     (web)          (smartphone /go)
```

**Stack technique :** Node.js · Express · Socket.io · GSAP · Multer · PocketBase

---

## 1. Pool Manager

Le Pool Manager est la source de vérité unique pour le contenu. Il ne sait pas ce qui s'affiche — il sait ce qui est disponible et à quel score.

### 1.1 Types de médias acceptés (MVP)

| Type | Source | Contraintes |
|---|---|---|
| `photo` | Upload participant | ≤ 10 MB, JPEG/PNG |
| `gif` | Upload participant ou Enrich depuis `link` Giphy | ≤ 10 MB, GIF |
| `note` | Saisie participant | ≤ 280 caractères |
| `clip` | Upload participant | ≤ 50 MB, MP4/MOV/WebM, durée ≤ 60s |
| `link` | URL participant — reclassifié par Enrich | URL `https` valide |
| `youtube` | Reclassifié depuis `link` par Enrich | ID YouTube extractible |
| `interview` | Upload participant via workflow dédié `/go` | Bundle multi-segments, MP4 |
| `ticker` | NarratorEngine uniquement | Message défilant, jamais soumis par participant |

### 1.2 Modèle MediaItem

```
MediaItem {
  id          : uuid
  type        : 'photo' | 'gif' | 'note' | 'clip' | 'link' | 'youtube' | 'interview' | 'ticker'
  content     : { … }         // structure par type — voir pool-manager-requirements.md
  priority    : number (0–1000)
  submittedAt : timestamp
  displayCount: number        // calculé depuis MediaEvents
  lastDisplayedAt : timestamp | null
  status      : 'pending' | 'ready' | 'evicted'
  pinned      : boolean
  author      : {
    participantId : string    // ref Participant.id — 'system:admin' ou 'system:narrator' pour injections système
    displayName   : string    // snapshot à la soumission
    team          : string
    role          : string
  }
}
```

### 1.3 Scoring

Le score final d'un item détermine sa position dans la queue. Il est recalculé à chaque appel à `nextItem()`.

```
score = priority
      + freshnessScore
      - (displayCount × 40)
      - (skippedCount × 120)
```

**freshnessScore :**

| Âge de l'item | Score |
|---|---|
| < 2 min (chaud) | +80 |
| < 15 min (tiède) | +30 |
| < 1h (froid) | 0 |
| > 1h (glacial) | −50 |

**Priorités de base :**

| Type | Priorité |
|---|---|
| `photo`, `gif`, `note`, `clip`, `link`, `youtube` | 100 |
| `interview` | 200 |
| Item épinglé par admin | 999 |
| `ticker` (NarratorEngine) | 80 |
| Item évincé | exclu du scoring |

### 1.4 Pipeline d'ingestion

Toute soumission passe par ce pipeline avant d'entrer dans le pool.

```
RAW INPUT
  ↓
SANITIZE   — type MIME, taille, format selon le type
  ↓
GUARD      — statut JAM, rate limit (1 / 30s par participantId)
             quota clips : 3 par participantId sur toute la JAM
  ↓
item créé en status: 'pending' → "En régie !" envoyé au participant
  ↓ (asynchrone)
RESOLVE    — sauvegarde fichiers, vérification YouTube/Giphy, ffprobe clips
  ↓
ENRICH     — reclassification link→youtube|gif, dédoublonnage, règles Gims
  ↓
status: 'ready'
```

Les uploads `interview` et les injections `system:narrator` sont **exemptés** du Guard (statut JAM et rate limit).

### 1.5 API Pool (interne, consommée par les apps)

```
pool.nextItem(filters?)          → MediaItem | null
pool.addItem(raw)                → MediaItem | Error
pool.evict(id, reason)           → void
pool.pin(id)                     → void
pool.getQueue(filters?)          → MediaItem[]
pool.getItems(filters)           → MediaItem[]
pool.markDisplayed(id, appId)    → void
pool.markSkipped(id, appId)      → void
pool.markHeld(id, appId, ms)     → void
```

---

## 2. Broadcast Manager

Le Broadcast Manager est le chef d'orchestre de l'affichage. Il décide quelle app est active, quand elle démarre, et comment elle se termine.

### 2.1 Responsabilités

- Maintenir l'app active dans le `GlobalState`
- Gérer les transitions entre apps (avec View Transition API)
- Exécuter le planning d'apps (triggers temporels)
- Recevoir les déclenchements manuels depuis l'admin
- Garantir l'idempotence : un double-déclenchement ne produit pas deux transitions

### 2.2 GlobalState (broadcasté via Socket.io)

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
    fresh         : number,        // items < 15min
    queueSnapshot : MediaItem[]    // top 5, pour l'admin
  }
}
```

### 2.3 Contrat d'une App

Toutes les apps implémentent la même interface. Le Broadcast Manager n'a pas besoin de connaître l'intérieur d'une app.

```javascript
App {
  id          : string
  outroMode   : 'sequential' | 'concurrent' | 'none'

  load(signal: AbortSignal) : void
  play()                    : void
  stop()                    : Promise<void>
  remove()                  : void
  onPoolUpdate(item)        : void
}
```

### 2.4 Triggers

**Market** — exécution immédiate. Émis par l'admin ou par un événement système (`JAM_START`, `JAM_END`).

**Limit** — conditionnel, évalué en continu par le scheduler.

```javascript
{ type: 'time', at: 'absolute', value: '2026-03-01T09:00:00' }
{ type: 'time', at: 'H+', value: 24 * 60 * 60 * 1000 }
{ type: 'time', at: 'T-', value: 10 * 60 * 1000 }
```

### 2.5 Planning d'apps

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

## 3. Les Apps

Toutes les apps sont égales. Chacune est un module indépendant. Le Broadcast Manager ne connaît que leur contrat (`load`, `play`, `stop`, `remove`, `onPoolUpdate`).

---

### App 1 — `pre-jam-idle`

**Rôle :** écran d'attente avant le lancement de la JAM.

**Déclenchement :** active au démarrage du serveur, jusqu'à `JAM_START`.

**Contenu affiché :**
- Titre de la JAM (configurable)
- Heure de lancement (compte à rebours simple jusqu'au start)
- QR code pointant vers `/go` (inactif — soumissions refusées pendant cet état)

**Interactions :**
- Aucune soumission acceptée (le Pool Manager rejette avec message "JAM pas encore lancée")
- L'admin peut forcer la transition vers `countdown-to-jam`

---

### App 2 — `countdown-to-jam`

**Rôle :** lancement de la JAM, énergie maximale.

**Déclenchement :** `JAM_START` (market ou automatique).

**Durée :** configurable, typiquement 5–10 minutes.

**Contenu affiché :**
- Compte à rebours inversé depuis le lancement (H+00:00 qui monte)
- Message d'encouragement de début (texte configurable)
- Animation d'entrée — énergie max

**Fin :** transition automatique vers `jam-mode` après la durée configurée.

**Interactions :**
- Les soumissions sont désormais acceptées
- `onPoolUpdate` ignoré — cette app n'affiche pas le pool

---

### App 3 — `jam-mode`

**Rôle :** app principale pendant les 48h. Affiche le pool en continu.

**Déclenchement :** automatique après `countdown-to-jam`. Actif la majorité du temps.

**Contenu affiché — deux couches simultanées :**

**Couche countdown** (permanente dans `persistent-layer`) — évolue selon la phase :

| Temps restant | Comportement |
|---|---|
| > 2h | Compact, coin supérieur droit |
| T−2h | Grossit progressivement |
| T−1h | Dominant, prend 50% de l'écran |
| T−10min | Plein écran, rouge |

**Couche soumissions** — items du pool sélectionnés par score :
- `photo`, `gif` : affichés 15–30s, plein écran ou composition avec note
- `clip` : lecture, durée = content.duration (plancher 10s)
- `note` : affichée 10–20s, typographie large
- `youtube` : lecture dans player intégré, durée de la vidéo
- `link` : thumbnail bonne résolution → layout VISUAL_WITH_CAPTION ; sinon → NOTE_CARD (titre + description + domaine)
- `content.caption` présent sur photo/gif/clip/link/youtube → layout `*_WITH_CAPTION` automatique

**QR code** : affiché en permanence dans `persistent-layer`.

**Interactions :**
- Admin peut skip, evict, ou pinner un item
- Admin peut déclencher manuellement `micro-trottoir`

---

### App 4 — `micro-trottoir`

**Rôle :** émission dédiée aux interviews participants. S'intercale 3 fois dans les 48h.

**Déclenchement :** planifié (H+12, H+30, T−4) ou market admin.

**Voir `micro-trottoir-spec.md` pour la spécification complète.**

---

### App 5 — `end-of-countdown`

**Rôle :** moment du freeze. Posez les claviers.

**Déclenchement :** `JAM_END` (automatique à T−0 ou market admin).

**Contenu affiché :**
- Countdown figé sur 00:00:00
- Message de fin configurable ("POSEZ LES CLAVIERS")
- Animation de freeze

**Interactions :**
- Toutes les soumissions refusées (Pool Manager rejette avec message "JAM terminée")
- Aucun item du pool affiché

**Fin :** transition automatique vers `post-jam-idle` après durée configurable (ex: 5 min).

---

### App 6 — `post-jam-idle`

**Rôle :** écran de fin, après le freeze.

**Déclenchement :** automatique après `end-of-countdown`.

**Contenu affiché :**
- Message de félicitations (configurable)
- Statistiques de la JAM : nombre de soumissions, durée
- Éventuellement : mosaïque statique des photos soumises (si disponible)

**Interactions :**
- Aucune soumission acceptée
- L'admin peut déclencher une app custom depuis l'interface

---

### Apps custom (non définies)

Le Broadcast Manager supporte des apps supplémentaires non définies dans ce document. Elles sont injectées via le planning JSON ou déclenchées manuellement depuis l'admin. Elles respectent le même contrat et sont traitées de façon identique par le Broadcast Manager.

---

## 4. Client Admin

Interface web de contrôle. Accessible depuis un ordinateur ou un smartphone.

### 4.1 Gestion de l'état global

- Démarrer / arrêter la JAM (déclenche `JAM_START` / `JAM_END`)
- Voir l'app active et le temps restant dans la JAM
- Déclencher manuellement n'importe quelle app (market trigger)
- Visualiser le planning d'apps et les prochains triggers

### 4.2 Modération du pool

- Liste des items en queue (top 20, triés par score)
- Par item : skip (cooldown 5 min), evict (retire définitivement), pin (priorité max)
- **Panic** (`Escape`) : retour immédiat à `jam-mode`, queue inchangée

### 4.3 Upload interview

- Workflow dédié : upload vidéo progressif, segments, identification du sujet
- L'item entre dans le pool avec priorité 200 et type `interview`
- Exempté du Guard (statut JAM et rate limit)

### 4.4 Modération participants

- Recherche par nom / équipe
- Ban silencieux : soumissions rejetées sans notification au participant
- Unban

### 4.5 Dashboard de nuit

Vue minimaliste pour une lecture en un coup d'œil depuis le téléphone :

| Indicateur | État nominal |
|---|---|
| Serveur | ● OK |
| App active | `jam-mode` |
| Clients TV connectés | ≥ 1 |
| Items en queue | > 0 |
| Espace disque | < 80% |
| JAM | RUNNING |

---

## 5. Client Participant `/go`

PWA stateless. OAuth Google obligatoire. URL : `miniregie.iad.be/go`.

### 5.1 Authentification

Connexion via Google OAuth. Session 48h. Le fingerprint appareil est remplacé par un `participantId` stable.

### 5.2 Onboarding (première connexion uniquement)

- `displayName` pré-rempli depuis OAuth, non modifiable
- `role` attribué automatiquement depuis `roles.json` (40–60 entrées)
- `team` optionnel

### 5.3 Actions disponibles

- **Lien ou vidéo** : URL quelconque — unfurl OpenGraph + reclassification par Enrich
- **Photo ou GIF** : sélection depuis galerie ou caméra
- **Message** : champ texte 280 caractères max
- **Clip vidéo** : enregistrement ou galerie, max 60s
- **Répondre à une question** : workflow interview multi-segments

### 5.4 Feedback

- Envoi en cours : spinner (texte/lien) ou barre de progression (fichiers)
- Succès : "✓ En régie !" — retour accueil automatique après 3s
- Erreur serveur : message verbatim ("JAM pas encore lancée", "Réessaie dans 30s", "Clip trop long")
- Erreur réseau : "Connexion perdue. Réessaie."

### 5.5 Ban silencieux

Participant banni : soumissions rejetées silencieusement, client reçoit "En régie !" normalement. Aucune alerte au participant.

---

## 6. Hors périmètre MVP

- Robot Arduino et webcam
- YouTube en background d'ambiance (distinct du YouTube participant)
- Mosaïque automatique générée
- Système de votes sur les questions
- Transcodage ou resize asynchrone
- Thumbnail générée pour les clips
- Reprise d'upload interrompue
- Réconciliation de comptes OAuth cross-provider
- Modification du profil depuis `/go` après onboarding
- Notification au participant quand sa soumission est diffusée
- Proof of play complet
- Suppression automatique des soumissions d'un participant banni
- Export données participant post-JAM

---

## 7. Exigences non fonctionnelles

- **Résilience** : le serveur redémarre via PM2 en < 5s. Le GlobalState est persisté toutes les 30s dans `state.json` et rechargé au démarrage.
- **Déconnexion réseau** : le broadcast client affiche le dernier état connu. Reconnexion automatique avec backoff exponentiel.
- **Idempotence** : tout déclenchement dupliqué (double-clic admin, événement réseau) ne produit pas deux transitions.
- **Panic button** : fonctionne en toutes circonstances, sans exception.
- **Quota disque** : uploads refusés si disque > 95%. Admin alerté à 80%.
- **Répétition générale** : obligatoire 48h avant la JAM.
