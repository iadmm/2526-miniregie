# micro-trottoir — Spécification technique
> MiniRégie TV · IAD Louvain-la-Neuve · JAM Multimédia 48h
> Version 1.0 · Mars 2026

---

## 1. Concept

Un journaliste (ou n'importe quel participant) circule dans les salles, filme des clips courts et les soumet via `/go`. L'app `micro-trottoir` s'intercale dans le planning trois fois dans les 48h et diffuse les interviews dans une émission dédiée.

Le mot "interview" n'apparaît pas dans l'interface participant. L'utilisateur répond à une question — la mise en scène à l'écran est la surprise. Inspiré de Motto (Vincent Morisset / ONF).

---

## 2. Positionnement dans le système

`micro-trottoir` est une app au sens du Broadcast Manager — elle implémente le même contrat que toutes les autres (`load`, `play`, `stop`, `remove`, `onPoolUpdate`). Elle consomme des items de type `interview` depuis le pool.

**Déclenchements planifiés :**

```json
{ "at": "H+12:00:00", "app": "micro-trottoir" },
{ "at": "H+30:00:00", "app": "micro-trottoir" },
{ "at": "T-04:00:00", "app": "micro-trottoir" }
```

**Mode dégradé :** si aucun interview disponible dans la fenêtre, l'app signale `signalReady()` immédiatement et s'auto-termine → retour instantané vers `jam-mode` sans aucune interruption visible.

---

## 3. Sélection des items

```javascript
// H+12 et H+30 : fenêtre 4h
pool.getItems({
  types         : ['interview'],
  submittedAfter: now - 4 * 3_600_000,
  sort          : 'submittedAt ASC'
})

// T−4h : fenêtre élargie 8h
pool.getItems({
  types         : ['interview'],
  submittedAfter: now - 8 * 3_600_000,
  sort          : 'submittedAt ASC'
})
```

Les interviews sont évincés du pool après diffusion (`pool.markDisplayed()` → éviction `post-display`) pour ne pas repasser lors d'une diffusion ultérieure.

---

## 4. Structure d'une séquence

```
[Intro animée]
  "MICRO-TROTTOIR / Dans les coulisses de la JAM"
  durée : ~3–5s

Pour chaque interview :
  Pour chaque segment :
    [Question]     — plein écran, 3s
    [Réponse]      — vidéo plein écran (durée réelle) ou texte NOTE_CARD 8s
                     bandeau bas : displayName · team · role
    [Photos liées] — 5s chacune, même bandeau, 0–3 photos

[Outro]
  "Retour en régie"
  transition → jam-mode (wipe horizontal inverse, 0.6s)
```

---

## 5. Affichage écran

```
╔══════════════════════════════════════════════════════╗
║                                                      ║
║              [ segment vidéo / texte ]               ║
║                                                      ║
║  ▌ Léa Dupont                                        ║
║    Développeuse full-stack / Équipe 7                ║
╚══════════════════════════════════════════════════════╝
```

Bandeau bas : `subject.displayName` + `subject.team` + `subject.role`.
Si `name` est vide → pas de bandeau.
Si `role` vide mais `name` renseigné → nom seul.

Le champ `role` est un espace éditorial de 60 caractères :
- "Chef de projet / Dort debout depuis 9h"
- "A trouvé le bug. C'était une virgule."
- "Statut : fonctionnel"
- "Ne souhaite pas commenter"

---

## 6. Modèle interview (rappel)

```javascript
// MediaItem.content pour type: 'interview'
{
  segments: [{
    question : string,           // question posée
    video    : string | null,    // chemin local, ≤ 60s
    duration : number | null,    // ffprobe
    textOnly : string | null,    // ≤ 280 car. si réponse écrite
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
```

---

## 7. Interface `/go` — Workflow Reporter Involontaire

### 7.1 Point d'entrée — Carte-question

```
┌─────────────────────────────────┐
│                                 │
│   Vous avez dormi combien       │
│   d'heures ?                    │
│                                 │
│   ·  ·  ·  ●  ·                 │  ← swipeable
├─────────────────────────────────┤
│   🎥 Filmer    ✏️ Écrire        │
└─────────────────────────────────┘
```

25 questions issues du kit micro-trottoir (5 blocs × 5 questions). Typo 28–32px. Swipe gauche/droite entre les questions. Questions récemment répondues (< 2h) déprioritisées en fin de liste (mémoire serveur, non persistée).

### 7.2 Répondre par vidéo

Question affichée en surtitre pendant l'enregistrement (lisible à voix haute ou à montrer). Fin → prévisualisation + "Utiliser" / "Reprendre". Upload démarre en arrière-plan dès la sélection du fichier.

### 7.3 Répondre par texte

Question en surtitre. Champ textarea 0/280 en dessous.

### 7.4 Après une réponse

```
┌─────────────────────────────────┐
│   [ preview vidéo ou texte ]    │
│   + Ajouter une photo           │  ← 0–3 photos par segment
├─────────────────────────────────┤
│   Autre question   Terminer →   │
└─────────────────────────────────┘
```

"Autre question" → nouvelle carte (pas déjà répondue dans ce bundle). Max 5 segments.

### 7.5 Signature — en dernier

```
┌─────────────────────────────────┐
│   C'est qui qui répond ?        │
│   ┌─────────────────────────┐   │
│   │ ●  Moi — Marie Dupont   │   │  ← sélectionné par défaut
│   └─────────────────────────┘   │
│   ┌─────────────────────────┐   │
│   │ ○  Quelqu'un d'autre    │   │
│   └─────────────────────────┘   │
├─────────────────────────────────┤
│      Envoyer à la régie         │
└─────────────────────────────────┘
```

**"Moi"** → profil OAuth, aucune saisie. → `subject.type: 'self'`

**"Quelqu'un d'autre"** → sélecteur avec recherche temps réel (nom + équipe). → `subject.type: 'participant'`

**Fallback "Introduire manuellement"** → nom + rôle libres, 60 car. chacun, ne crée pas de Participant. → `subject.type: 'manual'`

### 7.6 Confirmation

```
┌─────────────────────────────────┐
│   ✓  En régie !                 │
│   Tu passeras peut-être         │
│   bientôt à l'écran.            │
├─────────────────────────────────┤
│  Encore une question            │
│  Retour à l'accueil             │
└─────────────────────────────────┘
```

---

## 8. Protocol d'upload

```
POST /go/upload/video  →  { uploadId: uuid }   ← démarre dès sélection fichier
POST /go/upload/submit { uploadId, segments[], subject }  →  MediaItem | Error
```

`uploadId` en mémoire serveur — expire si `submit` absent dans un délai raisonnable. Fichier orphelin nettoyé au redémarrage.

---

## 9. Kit micro-trottoir — Questions pré-faites

### Bloc 1 — L'état des troupes
- "C'est quoi votre projet, en une phrase ?"
- "Vous avez dormi combien d'heures ?"
- "Sur une échelle de 1 à 10, vous en êtes où ?"
- "C'est quoi la prochaine étape ?"
- "Qu'est-ce qui a failli partir à la poubelle ce matin ?"

### Bloc 2 — La JAM en conditions
- "Qu'est-ce qui vous a le plus surpris depuis le début ?"
- "Votre meilleure décision depuis hier ?"
- "Votre pire décision depuis hier ?"
- "C'est quoi le truc que vous avez appris que vous ne saviez pas faire ?"
- "Est-ce qu'il y a eu un moment où vous avez failli tout recommencer ?"

### Bloc 3 — L'absurde sérieux
- "Si votre projet était un plat, ce serait quoi ?"
- "Qu'est-ce que vous regrettez de ne pas avoir pris avec vous ?"
- "Vous avez un message pour votre vous d'il y a 24h ?"
- "José vous observe. Comment vous sentez-vous ?"
- "Vous pensez que votre équipe va gagner ? Mentez pas."

### Bloc 4 — Fin de JAM (T−6h et moins)
- "Qu'est-ce qui manque encore pour que ce soit fini ?"
- "C'est quoi la chose dont vous êtes le plus fier·e ?"
- "Qu'est-ce que vous allez faire dans exactement deux heures ?"
- "Si vous pouviez changer une chose depuis le début, ce serait quoi ?"
- "Un mot pour qualifier cette JAM jusqu'ici ?"

### Bloc 5 — Questions José
- "José a analysé votre activité. Il a des questions. Avez-vous des réponses ?"
- "Est-ce que votre projet va changer le monde ? Développez."
- "On vous a observé·e à 3h47 du matin. Que faisiez-vous ?"
- "Avez-vous quelque chose à déclarer ?"
- "José vous observe. Comment vous sentez-vous ?" *(doublon intentionnel — deux fois plus de chances)*

---

## 10. Hors périmètre

- Transcodage ou normalisation des vidéos
- Thumbnail générée pour les clips
- Reprise d'upload interrompue
- Questions d'interview personnalisables par l'admin en live
- Notification au participant quand son interview est diffusée
- Canal journaliste dédié (accès identique à tous les participants)
